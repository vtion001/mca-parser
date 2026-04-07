<?php

namespace Tests\Jobs\Pipeline;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\Steps\DoclingExtractionStep;
use App\Services\Interfaces\ExtractionServiceInterface;
use Mockery;
use Mockery\MockInterface;
use PHPUnit\Framework\TestCase;

/**
 * Tests for DoclingExtractionStep behavior.
 */
class DoclingExtractionStepTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_calls_extraction_service_extract_text(): void
    {
        $mockService = Mockery::mock(ExtractionServiceInterface::class);
        $mockService->shouldReceive('extractText')
            ->once()
            ->with('/path/to/test.pdf')
            ->andReturn([
                'success' => true,
                'text' => '# Document Content',
                'ocr_text' => '',
                'page_count' => 3,
            ]);

        $step = new DoclingExtractionStep($mockService);
        $context = new PipelineContext(jobId: 'test-job', filePath: '/path/to/test.pdf');

        $updateProgressCalled = false;
        $step->handle($context, function () use (&$updateProgressCalled) {
            $updateProgressCalled = true;
        });

        $this->assertSame('# Document Content', $context->markdown);
        $this->assertSame('', $context->ocrText);
        $this->assertSame(3, $context->pageCount);
        $this->assertTrue($updateProgressCalled);
    }

    public function test_appends_ocr_to_markdown_when_ocr_text_present(): void
    {
        $mockService = Mockery::mock(ExtractionServiceInterface::class);
        $mockService->shouldReceive('extractText')
            ->once()
            ->andReturn([
                'success' => true,
                'text' => '# Main Content',
                'ocr_text' => 'Text from scanned page',
                'page_count' => 2,
            ]);

        $step = new DoclingExtractionStep($mockService);
        $context = new PipelineContext(jobId: 'test-job', filePath: '/path/to/test.pdf');

        $step->handle($context, fn() => null);

        $this->assertStringContainsString('# Main Content', $context->markdown);
        $this->assertStringContainsString('## Image OCR Content', $context->markdown);
        $this->assertStringContainsString('Text from scanned page', $context->markdown);
    }

    public function test_does_not_append_ocr_when_ocr_text_empty(): void
    {
        $mockService = Mockery::mock(ExtractionServiceInterface::class);
        $mockService->shouldReceive('extractText')
            ->once()
            ->andReturn([
                'success' => true,
                'text' => '# Main Content',
                'ocr_text' => '',
                'page_count' => 1,
            ]);

        $step = new DoclingExtractionStep($mockService);
        $context = new PipelineContext(jobId: 'test-job', filePath: '/path/to/test.pdf');

        $step->handle($context, fn() => null);

        $this->assertSame('# Main Content', $context->markdown);
        $this->assertSame('', $context->ocrText);
    }

    public function test_sets_error_when_extraction_fails(): void
    {
        $mockService = Mockery::mock(ExtractionServiceInterface::class);
        $mockService->shouldReceive('extractText')
            ->once()
            ->andReturn([
                'success' => false,
                'error' => 'PDF could not be parsed',
            ]);

        $step = new DoclingExtractionStep($mockService);
        $context = new PipelineContext(jobId: 'test-job', filePath: '/path/to/test.pdf');

        $step->handle($context, fn() => null);

        $this->assertSame('Extraction failed: PDF could not be parsed', $context->error);
    }

    public function test_defaults_page_count_to_one_when_not_in_response(): void
    {
        $mockService = Mockery::mock(ExtractionServiceInterface::class);
        $mockService->shouldReceive('extractText')
            ->once()
            ->andReturn([
                'success' => true,
                'text' => 'Content only',
            ]);

        $step = new DoclingExtractionStep($mockService);
        $context = new PipelineContext(jobId: 'test-job', filePath: '/path/to/test.pdf');

        $step->handle($context, fn() => null);

        $this->assertSame(1, $context->pageCount);
    }

    public function test_get_name_returns_correct_step_name(): void
    {
        $mockService = Mockery::mock(ExtractionServiceInterface::class);
        $step = new DoclingExtractionStep($mockService);

        $this->assertSame('docling_extraction', $step->getName());
    }

    public function test_populates_context_markdown_from_extraction(): void
    {
        $mockService = Mockery::mock(ExtractionServiceInterface::class);
        $mockService->shouldReceive('extractText')
            ->once()
            ->andReturn([
                'success' => true,
                'text' => 'Extracted PDF text content',
                'ocr_text' => '',
                'page_count' => 5,
            ]);

        $step = new DoclingExtractionStep($mockService);
        $context = new PipelineContext(jobId: 'test-job', filePath: '/path/to/test.pdf');

        $step->handle($context, fn() => null);

        $this->assertSame('Extracted PDF text content', $context->markdown);
        $this->assertSame(5, $context->pageCount);
    }

    public function test_populates_context_ocr_text_from_extraction(): void
    {
        $mockService = Mockery::mock(ExtractionServiceInterface::class);
        $mockService->shouldReceive('extractText')
            ->once()
            ->andReturn([
                'success' => true,
                'text' => 'Main text',
                'ocr_text' => 'OCR from images',
                'page_count' => 1,
            ]);

        $step = new DoclingExtractionStep($mockService);
        $context = new PipelineContext(jobId: 'test-job', filePath: '/path/to/test.pdf');

        $step->handle($context, fn() => null);

        $this->assertSame('OCR from images', $context->ocrText);
    }
}
