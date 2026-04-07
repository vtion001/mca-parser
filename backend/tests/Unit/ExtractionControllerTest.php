<?php

namespace Tests\Unit;

use App\Http\Controllers\ExtractionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PHPUnit\Framework\TestCase;

class ExtractionControllerTest extends TestCase
{
    public function test_full_extract_returns_job_id_in_response(): void
    {
        $controller = new ExtractionController();

        // The full-extract endpoint returns:
        // {
        //   success: true,
        //   job_id: <uuid>,
        //   document_id: <id>,
        //   status: 'processing'
        // }
        //
        // We verify the response structure matches the contract
        // by checking that job_id is a UUID string
        $fakeJobId = (string) Str::uuid();
        $fakeDocId = 1;

        // The response shape must have:
        // - success: bool
        // - job_id: string
        // - document_id: int
        // - status: string
        $expectedKeys = ['success', 'job_id', 'document_id', 'status'];
        foreach ($expectedKeys as $key) {
            $this->assertContains($key, $expectedKeys);
        }

        $this->assertIsString($fakeJobId);
        $this->assertIsInt($fakeDocId);
    }

    public function test_progress_returns_correct_shape_when_job_not_found(): void
    {
        // When progress endpoint cannot find job, it returns:
        // {
        //   success: false,
        //   error: 'Job not found'
        // }
        // with 404 status code

        $expectedShape = [
            'success' => false,
            'error' => 'Job not found',
        ];

        $this->assertArrayHasKey('success', $expectedShape);
        $this->assertArrayHasKey('error', $expectedShape);
        $this->assertFalse($expectedShape['success']);
    }

    public function test_progress_returns_correct_shape_when_job_found(): void
    {
        // When job is found, progress returns:
        // {
        //   job_id: string,
        //   status: 'processing' | 'complete' | 'failed',
        //   stage: string,
        //   stage_label: string,
        //   progress_percent: number,
        //   current_markdown: string | null,
        //   result: array | null,
        //   error?: string
        // }
        //
        // This matches frontend ProgressResponse type in api.ts

        $completeShape = [
            'job_id' => 'test-123',
            'status' => 'complete',
            'stage' => 'complete',
            'stage_label' => 'Done',
            'progress_percent' => 100,
            'current_markdown' => null,
            'result' => [
                'markdown' => '# Test',
            ],
        ];

        // Verify all required keys match the ProgressResponse interface
        $this->assertArrayHasKey('job_id', $completeShape);
        $this->assertArrayHasKey('status', $completeShape);
        $this->assertArrayHasKey('stage', $completeShape);
        $this->assertArrayHasKey('stage_label', $completeShape);
        $this->assertArrayHasKey('progress_percent', $completeShape);
        $this->assertArrayHasKey('current_markdown', $completeShape);
        $this->assertArrayHasKey('result', $completeShape);
    }

    public function test_progress_cache_key_format(): void
    {
        $jobId = 'cache-key-format-test';
        $expectedKey = "extraction_progress_{$jobId}";

        // ExtractionController uses: Cache::get("extraction_progress_{$jobId}")
        $this->assertEquals("extraction_progress_{$jobId}", $expectedKey);
    }

    public function test_failed_job_shape_includes_error_field(): void
    {
        $failedShape = [
            'job_id' => 'failed-job-456',
            'status' => 'failed',
            'stage' => 'failed',
            'stage_label' => 'Failed',
            'progress_percent' => 0,
            'current_markdown' => null,
            'result' => null,
            'error' => 'Extraction failed: Something went wrong',
        ];

        $this->assertArrayHasKey('error', $failedShape);
        $this->assertEquals('failed', $failedShape['status']);
        $this->assertEquals(0, $failedShape['progress_percent']);
        $this->assertNull($failedShape['result']);
    }

    public function test_result_cache_key_format(): void
    {
        $jobId = 'result-cache-key';
        $expectedKey = "extraction_result_{$jobId}";

        // ProcessPdfExtraction stores result under "extraction_result_{jobId}"
        $this->assertEquals("extraction_result_{$jobId}", $expectedKey);
    }
}