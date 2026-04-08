<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Models\Document;
use App\Services\DoclingService;
use App\Services\DocumentTypeDetector;
use App\Services\FieldMapper;
use App\Services\ExtractionScorer;
use App\Services\PdfAnalyzerService;
use App\Services\BalanceExtractorService;
use App\Services\OpenRouterService;
use App\Services\PiiPatterns;
use App\Services\McaAiService;
use App\Services\TransactionClassificationService;

class ProcessPdfExtraction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public int $backoff = 60; // seconds between retries (exponential: 60, 120, 240...)
    public int $timeout = 900;

    private string $jobId;
    private string $filePath;
    private ?int $documentId;
    private ?int $batchId;

    public function __construct(string $jobId, string $filePath, ?int $documentId = null, ?int $batchId = null)
    {
        $this->jobId = $jobId;
        $this->filePath = $filePath;
        $this->documentId = $documentId;
        $this->batchId = $batchId;
    }

    public function handle(
        DoclingService $doclingService,
        DocumentTypeDetector $typeDetector,
        FieldMapper $fieldMapper,
        ExtractionScorer $scorer,
        PdfAnalyzerService $analyzer,
        BalanceExtractorService $balanceExtractor,
        OpenRouterService $openRouterService,
        McaAiService $mcaAiService,
        TransactionClassificationService $txnClassifier
    ): void {
        try {
            $this->updateProgress('extracting', 'Extracting text from PDF...', 10);

            // Check cache with stampede protection using lock
            $contentHash = $this->getContentHash();
            $cacheKey = "pdf_cache_{$contentHash}";

            try {
                $lock = Cache::lock("lock_{$cacheKey}", 30);

                if ($lock->get()) {
                    // Double-check cache inside lock
                    if ($cached = Cache::get($cacheKey)) {
                        $this->updateProgress('cache_hit', 'Using cached result...', 100);
                        $this->handleCachedResult($cached);
                        $lock->release();
                        return;
                    }
                    $lock->release();
                }
            } catch (\Exception $e) {
                // Lock acquisition failed, continue without cache protection
                Log::warning('Cache lock failed, proceeding without cache', [
                    'cache_key' => $cacheKey,
                    'error' => $e->getMessage(),
                ]);
            }

            // Mark document as processing if we have a document ID
            if ($this->documentId) {
                $document = Document::find($this->documentId);
                if ($document) {
                    $document->markAsProcessing();
                }
            }

            $extractResult = $doclingService->extractText($this->filePath);

            if (!$extractResult['success']) {
                $this->failJob('Extraction failed: ' . ($extractResult['error'] ?? 'Unknown error'));
                return;
            }

            $markdown = $extractResult['text'];
            $ocrText = $extractResult['ocr_text'] ?? '';
            $pageCount = $extractResult['page_count'] ?? 1;

            // Combine docling text with OCR text from images
            $fullMarkdown = $markdown;
            if (!empty($ocrText)) {
                $fullMarkdown = $markdown . "\n\n## Image OCR Content\n\n" . $ocrText;
            }

            $this->updateProgress('detecting_type', 'Detecting document type...', 35);

            $docType = $typeDetector->detect($fullMarkdown);

            $this->updateProgress('mapping_fields', 'Mapping key details...', 55);

            $keyDetails = $fieldMapper->map($fullMarkdown, $docType['type']);

            $this->updateProgress('analyzing_quality', 'Analyzing extraction quality...', 75);

            $hasPii = $analyzer->checkPiiIndicators($fullMarkdown);
            $piiPatterns = PiiPatterns::ALL;
            $piiDetected = $hasPii ? array_keys($piiPatterns) : [];

            $scoreResult = $scorer->score($fullMarkdown, $pageCount, $piiDetected, $piiPatterns);

            // Part 4: Balance Extraction
            $this->updateProgress('extracting_balances', 'Extracting balances...', 80);
            $balances = $balanceExtractor->extractBalances($fullMarkdown);

            // AI Analysis via OpenRouter
            $this->updateProgress('ai_analysis', 'Running AI analysis...', 85);
            $aiAnalysis = $openRouterService->analyzeDocument(
                $fullMarkdown,
                $docType,
                $keyDetails,
                $balances
            );

            // Fallback: If AI analysis failed or returned null transaction_summary,
            // compute basic transaction totals from extracted transactions
            if (!$aiAnalysis['success'] ||
                !isset($aiAnalysis['analysis']['transaction_summary']) ||
                $aiAnalysis['analysis']['transaction_summary']['credit_count'] === null) {
                $txnSummary = $mcaAiService->extractTransactionSummary($fullMarkdown);
                // Apply fallback only when AI analysis succeeded but returned null summary
                // (otherwise we don't have a valid analysis object to attach it to)
                if ($aiAnalysis['success'] && isset($aiAnalysis['analysis'])) {
                    $aiAnalysis['analysis']['transaction_summary'] = $txnSummary;
                    $aiAnalysis['fallback_transaction_summary'] = true;
                }
            }

            // MCA Detection (hybrid pre-filter + AI)
            $this->updateProgress('mca_detection', 'Detecting MCA transactions...', 92);
            $mcaFindings = $mcaAiService->detect($fullMarkdown, $keyDetails, $balances);

            // Transaction Classification (RETURN, WIRE, INTERNAL_TRANSFER, etc.)
            $this->updateProgress('txn_classification', 'Classifying transactions...', 95);
            $transactionClassification = $txnClassifier->detect($fullMarkdown);

            $this->updateProgress('complete', 'Done', 100);

            $result = [
                'markdown' => $fullMarkdown,
                'ocr_text' => $ocrText,
                'document_type' => $docType,
                'key_details' => $keyDetails,
                'scores' => $scoreResult['scores'],
                'pii_breakdown' => $scoreResult['pii_breakdown'],
                'recommendations' => $scoreResult['recommendations'],
                'balances' => $balances,
                'ai_analysis' => $aiAnalysis,
                'mca_findings' => $mcaFindings,
                'transaction_classification' => $transactionClassification,
                'page_count' => $pageCount,
            ];

            // Store in Cache (for frontend polling compatibility)
            Cache::put("extraction_result_{$this->jobId}", $result, now()->addHours(24));

            // Store in PDF content cache for future identical PDFs
            $this->storeInCache($contentHash, $result);

            // Store in database if we have a document ID
            if ($this->documentId) {
                $document = Document::find($this->documentId);
                if ($document) {
                    $document->markAsComplete([
                        'document_type' => $docType['type'],
                        'markdown' => $fullMarkdown,
                        'key_details' => $keyDetails,
                        'scores' => $scoreResult['scores'],
                        'pii_breakdown' => $scoreResult['pii_breakdown'],
                        'recommendations' => $scoreResult['recommendations'],
                        'balances' => $balances,
                        'ai_analysis' => $aiAnalysis,
                        'mca_findings' => $mcaFindings,
                        'transaction_classification' => $transactionClassification,
                        'page_count' => $pageCount,
                    ]);
                }
            }

            // Update batch progress if we have a batch ID
            if ($this->batchId) {
                $batch = \App\Models\Batch::find($this->batchId);
                if ($batch) {
                    $batch->incrementCompleted();
                }
            }

            $this->updateProgressComplete($result);

        } catch (\Exception $e) {
            Log::error('ProcessPdfExtraction failed: ' . $e->getMessage());
            $this->failJob($e->getMessage());
            throw $e;  // Re-throw so Laravel marks job as failed and retries
        }
    }

    private function updateProgress(string $stage, string $label, int $percent): void
    {
        $data = [
            'job_id' => $this->jobId,
            'status' => 'processing',
            'stage' => $stage,
            'stage_label' => $label,
            'progress_percent' => $percent,
            'current_markdown' => null,
            'result' => null,
        ];

        Cache::put("extraction_progress_{$this->jobId}", $data, now()->addHours(24));
    }

    private function updateProgressComplete(array $result): void
    {
        $data = [
            'job_id' => $this->jobId,
            'status' => 'complete',
            'stage' => 'complete',
            'stage_label' => 'Done',
            'progress_percent' => 100,
            'current_markdown' => null,
            'result' => $result,
        ];

        Cache::put("extraction_progress_{$this->jobId}", $data, now()->addHours(24));
    }

    private function failJob(string $error): void
    {
        // Mark document as failed if we have a document ID
        if ($this->documentId) {
            $document = Document::find($this->documentId);
            if ($document) {
                $document->markAsFailed($error);
            }
        }

        // Update batch progress even on failure (failed counts toward completion)
        if ($this->batchId) {
            $batch = \App\Models\Batch::find($this->batchId);
            if ($batch) {
                $batch->incrementCompleted();
            }
        }

        $data = [
            'job_id' => $this->jobId,
            'status' => 'failed',
            'stage' => 'failed',
            'stage_label' => 'Failed',
            'progress_percent' => 0,
            'current_markdown' => null,
            'result' => null,
            'error' => $error,
        ];

        Cache::put("extraction_progress_{$this->jobId}", $data, now()->addHours(24));
    }

    /**
     * Calculate content hash from file path for cache key
     */
    private function getContentHash(): string
    {
        // File must exist before we can hash it
        if (!file_exists($this->filePath)) {
            throw new \RuntimeException("PDF file not found: {$this->filePath}");
        }

        return md5_file($this->filePath);
    }

    /**
     * Handle cached extraction result
     */
    private function handleCachedResult(array $cached): void
    {
        $result = $cached['result'] ?? [];
        $result['cached'] = true;

        // Store in Cache for frontend polling
        Cache::put("extraction_result_{$this->jobId}", $result, now()->addHours(24));

        // Store in database if we have a document ID
        if ($this->documentId) {
            $document = Document::find($this->documentId);
            if ($document) {
                $document->markAsComplete([
                    'document_type' => $result['document_type'] ?? null,
                    'markdown' => $result['markdown'] ?? null,
                    'key_details' => $result['key_details'] ?? null,
                    'scores' => $result['scores'] ?? null,
                    'pii_breakdown' => $result['pii_breakdown'] ?? null,
                    'recommendations' => $result['recommendations'] ?? null,
                    'balances' => $result['balances'] ?? null,
                    'ai_analysis' => $result['ai_analysis'] ?? null,
                    'mca_findings' => $result['mca_findings'] ?? null,
                    'transaction_classification' => $result['transaction_classification'] ?? null,
                    'page_count' => $result['page_count'] ?? null,
                ]);
            }
        }

        // Update batch progress if we have a batch ID
        if ($this->batchId) {
            $batch = \App\Models\Batch::find($this->batchId);
            if ($batch) {
                $batch->incrementCompleted();
            }
        }

        $this->updateProgressComplete($result);
    }

    /**
     * Store result in cache for future use
     */
    private function storeInCache(string $contentHash, array $result): void
    {
        $cacheKey = "pdf_cache_{$contentHash}";

        try {
            $lock = Cache::lock("lock_{$cacheKey}", 30);

            if ($lock->get()) {
                Cache::put($cacheKey, [
                    'content_hash' => $contentHash,
                    'result' => $result,
                    'cached_at' => now()->toIso8601String(),
                ], now()->addDays(7)); // Cache for 7 days
                $lock->release();
            }
        } catch (\Exception $e) {
            // Cache store failed, log but don't fail the job
            Log::warning('Failed to store PDF in cache', [
                'cache_key' => $cacheKey,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
