<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Services\DoclingService;
use App\Services\DocumentTypeDetector;
use App\Services\FieldMapper;
use App\Services\ExtractionScorer;
use App\Services\PdfAnalyzerService;

class ProcessPdfExtraction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 300;

    private string $jobId;
    private string $filePath;

    public function __construct(string $jobId, string $filePath)
    {
        $this->jobId = $jobId;
        $this->filePath = $filePath;
    }

    public function handle(
        DoclingService $doclingService,
        DocumentTypeDetector $typeDetector,
        FieldMapper $fieldMapper,
        ExtractionScorer $scorer,
        PdfAnalyzerService $analyzer
    ): void {
        try {
            $this->updateProgress('extracting', 'Extracting text from PDF...', 10);

            $extractResult = $doclingService->extractText($this->filePath);

            if (!$extractResult['success']) {
                $this->failJob('Extraction failed: ' . ($extractResult['error'] ?? 'Unknown error'));
                return;
            }

            $markdown = $extractResult['text'];
            $pageCount = $extractResult['page_count'] ?? 1;

            $this->updateProgress('detecting_type', 'Detecting document type...', 35);

            $docType = $typeDetector->detect($markdown);

            $this->updateProgress('mapping_fields', 'Mapping key details...', 55);

            $keyDetails = $fieldMapper->map($markdown, $docType['type']);

            $this->updateProgress('analyzing_quality', 'Analyzing extraction quality...', 75);

            $piiDetected = $analyzer->checkPiiIndicators($markdown);
            $piiPatterns = $this->getPiiPatterns();

            $scoreResult = $scorer->score($markdown, $pageCount, $piiDetected ? ['pii'] : [], $piiPatterns);

            $this->updateProgress('complete', 'Done', 100);

            $result = [
                'markdown' => $markdown,
                'document_type' => $docType,
                'key_details' => $keyDetails,
                'scores' => $scoreResult['scores'],
                'recommendations' => $scoreResult['recommendations'],
                'page_count' => $pageCount,
            ];

            Cache::put("extraction_result_{$this->jobId}", $result, now()->addHours(24));

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

    private function getPiiPatterns(): array
    {
        return [
            '/\d{3}-\d{2}-\d{4}/',
            '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/',
            '/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/',
        ];
    }
}
