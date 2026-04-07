<?php

namespace App\Jobs\Pipeline;

use App\Jobs\Pipeline\Steps\AiAnalysisStep;
use App\Jobs\Pipeline\Steps\BalanceExtractionStep;
use App\Jobs\Pipeline\Steps\DoclingExtractionStep;
use App\Jobs\Pipeline\Steps\FieldMappingStep;
use App\Jobs\Pipeline\Steps\PiiDetectionStep;
use App\Jobs\Pipeline\Steps\ScoringStep;
use App\Jobs\Pipeline\Steps\TypeDetectionStep;
use App\Models\Document;
use App\Services\Analysis\BalanceExtractorService;
use App\Services\Analysis\DocumentTypeDetector;
use App\Services\Analysis\ExtractionScorer;
use App\Services\Extraction\FieldMapper;
use App\Services\Interfaces\ExtractionServiceInterface;
use App\Services\Interfaces\AiServiceInterface;
use App\Services\Ai\McaAiService;
use App\Services\Classification\McaDetectionService;
use App\Services\Analysis\PdfAnalyzerService;
use App\Services\Classification\TransactionClassificationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Orchestrates the PDF extraction pipeline by executing steps in order.
 */
class PdfExtractionPipeline
{
    /** @var array<string, PipelineStepInterface> */
    private array $steps = [];

    public function __construct(
        private ExtractionServiceInterface $extractionService,
        private DocumentTypeDetector $typeDetector,
        private FieldMapper $fieldMapper,
        private PdfAnalyzerService $analyzerService,
        private BalanceExtractorService $balanceExtractor,
        private AiServiceInterface $aiService,
        private McaAiService $mcaAiService,
        private TransactionClassificationService $txnClassifier,
        private ExtractionScorer $scorer
    ) {
        $this->registerSteps();
    }

    private function registerSteps(): void
    {
        $this->steps = [
            'docling' => new DoclingExtractionStep($this->extractionService),
            'type_detection' => new TypeDetectionStep($this->typeDetector),
            'field_mapping' => new FieldMappingStep($this->fieldMapper),
            'scoring' => new ScoringStep($this->scorer),
            'pii_detection' => new PiiDetectionStep($this->analyzerService),
            'balance_extraction' => new BalanceExtractionStep($this->balanceExtractor),
            'ai_analysis' => new AiAnalysisStep($this->aiService, $this->mcaAiService),
        ];
    }

    /**
     * Execute the pipeline and return the result array.
     */
    public function execute(
        string $jobId,
        string $filePath,
        ?int $documentId = null,
        ?int $batchId = null
    ): array {
        $context = new PipelineContext(
            jobId: $jobId,
            filePath: $filePath,
            documentId: $documentId,
            batchId: $batchId
        );

        $updateProgress = fn(string $stage, string $label, int $percent) =>
            $this->updateProgress($context, $stage, $label, $percent);

        // Check cache with stampede protection
        $cachedResult = $this->checkCache($context);
        if ($cachedResult !== null) {
            $this->handleCachedResult($context, $cachedResult, $updateProgress);
            return $context->toResultArray();
        }

        // Mark document as processing
        if ($context->documentId) {
            $document = Document::find($context->documentId);
            $document?->markAsProcessing();
        }

        // Execute each step
        foreach ($this->steps as $step) {
            if ($context->error !== null) {
                break;
            }
            $step->handle($context, $updateProgress);
        }

        if ($context->error !== null) {
            $this->failJob($context);
            return [];
        }

        // Post-processing: MCA detection and transaction classification
        $this->runPostProcessing($context, $updateProgress);

        // Store result
        $result = $context->toResultArray();
        $this->storeInCache($context, $result);

        // Persist to database
        $this->persistToDatabase($context, $result);

        $this->updateProgressComplete($context);

        return $result;
    }

    private function runPostProcessing(PipelineContext $context, callable $updateProgress): void
    {
        // MCA Detection
        $updateProgress('mca_detection', 'Detecting MCA transactions...', 92);
        $context->mcaFindings = $this->mcaAiService->detect(
            $context->markdown,
            $context->keyDetails,
            $context->balances
        );

        // Transaction Classification
        $updateProgress('txn_classification', 'Classifying transactions...', 95);
        $context->transactionClassification = $this->txnClassifier->detect($context->markdown);
    }

    private function checkCache(PipelineContext $context): ?array
    {
        $contentHash = $this->getContentHash($context->filePath);
        $cacheKey = "pdf_cache_{$contentHash}";

        try {
            $lock = Cache::lock("lock_{$cacheKey}", 30);
            if ($lock->get()) {
                $cached = Cache::get($cacheKey);
                $lock->release();
                return $cached;
            }
        } catch (\Exception $e) {
            Log::warning('Cache lock failed', ['cache_key' => $cacheKey, 'error' => $e->getMessage()]);
        }

        return null;
    }

    private function handleCachedResult(
        PipelineContext $context,
        array $cached,
        callable $updateProgress
    ): void {
        $result = $cached['result'] ?? [];
        $context->cached = true;
        $context->markdown = $result['markdown'] ?? '';
        $context->ocrText = $result['ocr_text'] ?? '';
        $context->documentType = $result['document_type'] ?? ['type' => 'unknown', 'confidence' => 0.0];
        $context->keyDetails = $result['key_details'] ?? [];
        $context->scores = $result['scores'] ?? [];
        $context->piiBreakdown = $result['pii_breakdown'] ?? [];
        $context->recommendations = $result['recommendations'] ?? [];
        $context->balances = $result['balances'] ?? [];
        $context->aiAnalysis = $result['ai_analysis'] ?? [];
        $context->mcaFindings = $result['mca_findings'] ?? [];
        $context->pageCount = $result['page_count'] ?? 1;

        $this->persistToDatabase($context, $result);
        $this->updateProgressComplete($context);
    }

    private function storeInCache(PipelineContext $context, array $result): void
    {
        $contentHash = $this->getContentHash($context->filePath);
        $cacheKey = "pdf_cache_{$contentHash}";

        try {
            $lock = Cache::lock("lock_{$cacheKey}", 30);
            if ($lock->get()) {
                Cache::put($cacheKey, [
                    'content_hash' => $contentHash,
                    'result' => $result,
                    'cached_at' => now()->toIso8601String(),
                ], now()->addDays(7));
                $lock->release();
            }
        } catch (\Exception $e) {
            Log::warning('Failed to store PDF in cache', [
                'cache_key' => $cacheKey,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function persistToDatabase(PipelineContext $context, array $result): void
    {
        if (!$context->documentId) {
            return;
        }

        $document = Document::find($context->documentId);
        if (!$document) {
            return;
        }

        $document->markAsComplete([
            'document_type' => $context->documentType['type'] ?? null,
            'markdown' => $context->markdown,
            'key_details' => $context->keyDetails,
            'scores' => $context->scores,
            'pii_breakdown' => $context->piiBreakdown,
            'recommendations' => $context->recommendations,
            'balances' => $context->balances,
            'ai_analysis' => $context->aiAnalysis,
            'mca_findings' => $context->mcaFindings,
            'page_count' => $context->pageCount,
        ]);

        // Update batch progress
        if ($context->batchId) {
            $batch = \App\Models\Batch::find($context->batchId);
            $batch?->incrementCompleted();
        }
    }

    private function getContentHash(string $filePath): string
    {
        if (!file_exists($filePath)) {
            throw new \RuntimeException("PDF file not found: {$filePath}");
        }
        return md5_file($filePath);
    }

    private function updateProgress(
        PipelineContext $context,
        string $stage,
        string $label,
        int $percent
    ): void {
        Cache::put("extraction_progress_{$context->jobId}", [
            'job_id' => $context->jobId,
            'status' => 'processing',
            'stage' => $stage,
            'stage_label' => $label,
            'progress_percent' => $percent,
            'current_markdown' => null,
            'result' => null,
        ], now()->addHours(24));
    }

    private function updateProgressComplete(PipelineContext $context): void
    {
        $result = $context->toResultArray();
        Cache::put("extraction_progress_{$context->jobId}", [
            'job_id' => $context->jobId,
            'status' => 'complete',
            'stage' => 'complete',
            'stage_label' => 'Done',
            'progress_percent' => 100,
            'current_markdown' => null,
            'result' => $result,
        ], now()->addHours(24));

        // Also store final result for frontend polling
        Cache::put("extraction_result_{$context->jobId}", $result, now()->addHours(24));
    }

    private function failJob(PipelineContext $context): void
    {
        if ($context->documentId) {
            $document = Document::find($context->documentId);
            $document?->markAsFailed($context->error ?? 'Unknown error');
        }

        if ($context->batchId) {
            $batch = \App\Models\Batch::find($context->batchId);
            $batch?->incrementCompleted();
        }

        Cache::put("extraction_progress_{$context->jobId}", [
            'job_id' => $context->jobId,
            'status' => 'failed',
            'stage' => 'failed',
            'stage_label' => 'Failed',
            'progress_percent' => 0,
            'current_markdown' => null,
            'result' => null,
            'error' => $context->error,
        ], now()->addHours(24));
    }
}
