<?php

namespace App\Services\Interfaces;

use App\Jobs\Pipeline\PipelineContext;

/**
 * Interface for PDF text extraction service.
 */
interface ExtractionServiceInterface
{
    /**
     * Extract text content from a PDF file.
     *
     * @param string $filePath Path to the PDF file
     * @return array{
     *     success: bool,
     *     text?: string,
     *     ocr_text?: string,
     *     page_count?: int,
     *     error?: string
     * }
     */
    public function extractText(string $filePath): array;
}
