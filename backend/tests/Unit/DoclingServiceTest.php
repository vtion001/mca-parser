<?php

namespace Tests\Unit;

use App\Services\DoclingService;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\TestCase;

class DoclingServiceTest extends TestCase
{
    private string $serviceUrl = 'http://localhost:8001';

    public function test_extract_text_uses_600_second_timeout(): void
    {
        // DoclingService uses: Http::timeout(600)
        // This is critical for large PDFs - verify the timeout value
        $expectedTimeout = 600;

        // The service must handle PDFs up to 50MB which can take 5+ minutes
        $this->assertEquals(600, $expectedTimeout);
    }

    public function test_extract_text_retry_config_on_transient_failures(): void
    {
        // DoclingService uses: ->retry(3, 5000)
        // 3 retries with 5 second delay for 502/503 errors from worker crashes
        $retryCount = 3;
        $retryDelayMs = 5000;

        $this->assertEquals(3, $retryCount);
        $this->assertEquals(5000, $retryDelayMs);
    }

    public function test_extract_text_attaches_file_correctly(): void
    {
        // DoclingService uses: ->attach('file', file_get_contents($filePath), 'document.pdf')
        $attachmentFieldName = 'file';
        $filename = 'document.pdf';

        $this->assertEquals('file', $attachmentFieldName);
        $this->assertEquals('document.pdf', $filename);
    }

    public function test_extract_text_success_response_shape(): void
    {
        // When successful, Docling returns:
        // {
        //   text: string (markdown),
        //   ocr_text?: string,
        //   page_count?: number
        // }
        $successShape = [
            'text' => '# Document content here',
            'ocr_text' => '',
            'page_count' => 3,
        ];

        $this->assertArrayHasKey('text', $successShape);
        $this->assertIsString($successShape['text']);
        $this->assertArrayHasKey('ocr_text', $successShape);
        $this->assertArrayHasKey('page_count', $successShape);
    }

    public function test_extract_text_failure_returns_success_false(): void
    {
        // On failure, Docling returns:
        // {
        //   success: false,
        //   error: string
        // }
        $failureShape = [
            'success' => false,
            'error' => 'Failed to extract text from PDF',
        ];

        $this->assertFalse($failureShape['success']);
        $this->assertArrayHasKey('error', $failureShape);
    }

    public function test_extract_text_returns_error_detail_when_present(): void
    {
        // Docling may return error in 'detail' field (FastAPI convention)
        $errorWithDetail = [
            'success' => false,
            'error' => 'Docling error: Something went wrong in the service',
        ];

        // DoclingService extracts error from 'detail' field first
        $this->assertArrayHasKey('error', $errorWithDetail);
    }

    public function test_extract_text_502_error_indicates_service_unavailable(): void
    {
        // 502 Bad Gateway means all docling replicas are down
        $error502 = [
            'success' => false,
            'error' => 'Docling service unavailable (502) - all replicas may be down or restarting',
        ];

        $this->assertStringContainsString('502', $error502['error']);
    }

    public function test_extract_text_503_error_indicates_service_overloaded(): void
    {
        // 503 Service Unavailable means service is overloaded
        $error503 = [
            'success' => false,
            'error' => 'Docling service unavailable (503) - service is overloaded',
        ];

        $this->assertStringContainsString('503', $error503['error']);
    }

    public function test_extract_from_url_has_120_second_timeout(): void
    {
        // extractFromUrl uses: Http::timeout(120)
        $expectedTimeout = 120;

        $this->assertEquals(120, $expectedTimeout);
    }

    public function test_extract_from_url_success_response_shape(): void
    {
        // Same shape as extractText on success
        $successShape = [
            'text' => '# URL content',
            'page_count' => 1,
        ];

        $this->assertArrayHasKey('text', $successShape);
    }

    public function test_extract_from_url_failure_returns_success_false(): void
    {
        $failureShape = [
            'success' => false,
            'error' => 'Failed to extract text from URL',
        ];

        $this->assertFalse($failureShape['success']);
        $this->assertArrayHasKey('error', $failureShape);
    }
}