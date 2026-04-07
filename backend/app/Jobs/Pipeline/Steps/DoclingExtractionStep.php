<?php

namespace App\Jobs\Pipeline\Steps;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;
use App\Services\Interfaces\ExtractionServiceInterface;

class DoclingExtractionStep implements PipelineStepInterface
{
    public function __construct(
        private ExtractionServiceInterface $extractionService
    ) {}

    public function handle(PipelineContext $context, callable $updateProgress): void
    {
        $updateProgress('extracting', 'Extracting text from PDF...', 10);

        $result = $this->extractionService->extractText($context->filePath);

        if (!$result['success']) {
            $context->error = 'Extraction failed: ' . ($result['error'] ?? 'Unknown error');
            return;
        }

        $context->markdown = $result['text'];
        $context->ocrText = $result['ocr_text'] ?? '';
        $context->pageCount = $result['page_count'] ?? 1;

        // Combine docling text with OCR text from images
        if (!empty($context->ocrText)) {
            $context->markdown .= "\n\n## Image OCR Content\n\n" . $context->ocrText;
        }
    }

    public function getName(): string
    {
        return 'docling_extraction';
    }
}
