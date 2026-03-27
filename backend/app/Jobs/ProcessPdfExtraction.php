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

class ProcessPdfExtraction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 300;

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
        OpenRouterService $openRouterService
    ): void {
        try {
            $this->updateProgress('extracting', 'Extracting text from PDF...', 10);

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

            $piiPatterns = $this->getPiiPatterns();
            $piiDetected = $this->detectPiiPatterns($fullMarkdown, $piiPatterns);

            $scoreResult = $scorer->score($fullMarkdown, $pageCount, $piiDetected, $piiPatterns);

            // Part 4: Balance Extraction
            $this->updateProgress('extracting_balances', 'Extracting balances...', 80);
            $balances = $balanceExtractor->extractBalances($fullMarkdown);

            // AI Analysis via OpenRouter
            $this->updateProgress('ai_analysis', 'Running AI analysis...', 90);
            $aiAnalysis = $openRouterService->analyzeDocument(
                $fullMarkdown,
                $docType,
                $keyDetails,
                $balances
            );

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
                'page_count' => $pageCount,
            ];

            // Store in Cache (for frontend polling compatibility)
            Cache::put("extraction_result_{$this->jobId}", $result, now()->addHours(24));

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
                        'page_count' => $pageCount,
                    ]);
                }
            }

            $this->updateProgressComplete($result);

        } catch (\Exception $e) {
            Log::error('ProcessPdfExtraction failed: ' . $e->getMessage());
            $this->failJob($e->getMessage());
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
     * Get PII detection patterns with labels
     */
    private function getPiiPatterns(): array
    {
        return [
            'ssn' => '/\d{3}-\d{2}-\d{4}/',
            'email' => '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/',
            'phone' => '/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/',
        ];
    }

    /**
     * Detect which PII patterns match in the text
     * Returns array of pattern names that were found (e.g., ['ssn', 'email'])
     */
    private function detectPiiPatterns(string $text, array $patterns): array
    {
        $detected = [];

        foreach ($patterns as $name => $pattern) {
            if (preg_match($pattern, $text)) {
                $detected[] = $name;
            }
        }

        return $detected;
    }
}
