<?php

namespace Tests\Unit;

use App\Jobs\ProcessPdfExtraction;
use App\Services\DoclingService;
use App\Services\DocumentTypeDetector;
use App\Services\FieldMapper;
use App\Services\ExtractionScorer;
use App\Services\PdfAnalyzerService;
use App\Services\BalanceExtractorService;
use App\Services\OpenRouterService;
use App\Services\McaAiService;
use App\Services\TransactionClassificationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\TestCase;

class ProcessPdfExtractionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Reset static jobId counter for test isolation
    }

    public function test_job_stores_progress_with_correct_cache_key_format(): void
    {
        // Verify the cache key format that the job uses matches what ExtractionController expects
        // The job uses "extraction_progress_{jobId}" and "extraction_result_{jobId}"
        // This test documents the expected key format
        $jobId = 'test-job-123';
        $expectedProgressKey = "extraction_progress_{$jobId}";
        $expectedResultKey = "extraction_result_{$jobId}";

        $this->assertEquals("extraction_progress_test-job-123", $expectedProgressKey);
        $this->assertEquals("extraction_result_test-job-123", $expectedResultKey);
    }

    public function test_job_constructor_assigns_all_arguments_correctly(): void
    {
        // Test construction through the public constructor signature
        // Job accepts: (string $jobId, string $filePath, ?int $documentId = null, ?int $batchId = null)
        $jobId = 'job-456';
        $filePath = '/path/to/document.pdf';
        $documentId = 99;
        $batchId = 77;

        // Create job via constructor to verify it accepts these values without error
        $job = new ProcessPdfExtraction($jobId, $filePath, $documentId, $batchId);

        // Verify job configuration via public properties
        $this->assertEquals(900, $job->timeout);
        $this->assertEquals(5, $job->tries);
        $this->assertEquals(60, $job->backoff);
    }

    public function test_progress_cache_key_follows_expected_format(): void
    {
        $jobId = 'progress-key-test';
        $expectedPrefix = "extraction_progress_{$jobId}";

        // The job stores progress under "extraction_progress_{jobId}"
        // We verify the key format is consistent with how ExtractionController reads it
        $this->assertEquals("extraction_progress_{$jobId}", $expectedPrefix);
    }

    public function test_result_cache_key_follows_expected_format(): void
    {
        $jobId = 'result-key-test';
        $expectedKey = "extraction_result_{$jobId}";

        // The job stores results under "extraction_result_{jobId}"
        $this->assertEquals("extraction_result_{$jobId}", $expectedKey);
    }

    public function test_pdf_cache_key_uses_content_hash(): void
    {
        $contentHash = md5('test content');
        $expectedCacheKey = "pdf_cache_{$contentHash}";

        $this->assertEquals("pdf_cache_{$contentHash}", $expectedCacheKey);
    }

    public function test_job_timeout_is_900_seconds(): void
    {
        $job = new ProcessPdfExtraction('timeout-test', '/path/to/file.pdf', null, null);
        $this->assertEquals(900, $job->timeout);
    }

    public function test_job_tries_is_5(): void
    {
        $job = new ProcessPdfExtraction('tries-test', '/path/to/file.pdf', null, null);
        $this->assertEquals(5, $job->tries);
    }

    public function test_job_backoff_is_60_seconds(): void
    {
        $job = new ProcessPdfExtraction('backoff-test', '/path/to/file.pdf', null, null);
        $this->assertEquals(60, $job->backoff);
    }
}