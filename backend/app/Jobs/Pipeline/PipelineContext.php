<?php

namespace App\Jobs\Pipeline;

/**
 * Result object passed between pipeline steps.
 */
class PipelineContext
{
    public function __construct(
        public string $jobId,
        public string $filePath,
        public ?int $documentId = null,
        public ?int $batchId = null,
        // Extraction results
        public string $markdown = '',
        public string $ocrText = '',
        public int $pageCount = 1,
        // Processing results
        public array $documentType = ['type' => 'unknown', 'confidence' => 0.0],
        public array $keyDetails = [],
        public array $balances = [
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ],
        public array $scores = [
            'completeness' => 0.0,
            'quality' => 0.0,
            'pii_detection' => 0.0,
            'overall' => 0.0,
        ],
        public array $piiBreakdown = [],
        public array $recommendations = [],
        public array $aiAnalysis = [],
        public array $mcaFindings = [],
        public array $transactionClassification = [],
        public bool $cached = false,
        public ?string $error = null,
    ) {}

    public function toResultArray(): array
    {
        return [
            'markdown' => $this->markdown,
            'ocr_text' => $this->ocrText,
            'document_type' => $this->documentType,
            'key_details' => $this->keyDetails,
            'scores' => $this->scores,
            'pii_breakdown' => $this->piiBreakdown,
            'recommendations' => $this->recommendations,
            'balances' => $this->balances,
            'ai_analysis' => $this->aiAnalysis,
            'mca_findings' => $this->mcaFindings,
            'transaction_classification' => $this->transactionClassification,
            'page_count' => $this->pageCount,
            'cached' => $this->cached,
        ];
    }
}
