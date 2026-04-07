<?php

namespace Tests\Jobs\Pipeline;

use App\Jobs\Pipeline\PipelineContext;
use PHPUnit\Framework\TestCase;

class PipelineContextTest extends TestCase
{
    public function test_constructor_with_all_defaults(): void
    {
        $context = new PipelineContext(
            jobId: 'job-123',
            filePath: '/path/to/file.pdf'
        );

        $this->assertSame('job-123', $context->jobId);
        $this->assertSame('/path/to/file.pdf', $context->filePath);
        $this->assertNull($context->documentId);
        $this->assertNull($context->batchId);
        $this->assertSame('', $context->markdown);
        $this->assertSame('', $context->ocrText);
        $this->assertSame(1, $context->pageCount);
        $this->assertSame(['type' => 'unknown', 'confidence' => 0.0], $context->documentType);
        $this->assertSame([], $context->keyDetails);
        $this->assertSame([
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ], $context->balances);
        $this->assertSame([
            'completeness' => 0.0,
            'quality' => 0.0,
            'pii_detection' => 0.0,
            'overall' => 0.0,
        ], $context->scores);
        $this->assertSame([], $context->piiBreakdown);
        $this->assertSame([], $context->recommendations);
        $this->assertSame([], $context->aiAnalysis);
        $this->assertSame([], $context->mcaFindings);
        $this->assertSame([], $context->transactionClassification);
        $this->assertFalse($context->cached);
        $this->assertNull($context->error);
    }

    public function test_constructor_with_overrides(): void
    {
        $context = new PipelineContext(
            jobId: 'job-456',
            filePath: '/path/to/doc.pdf',
            documentId: 10,
            batchId: 5,
            markdown: '# Test PDF',
            ocrText: 'OCR content',
            pageCount: 3,
            documentType: ['type' => 'bank_statement', 'confidence' => 0.95],
            keyDetails: ['account' => '123456789'],
            balances: [
                'beginning_balance' => ['amount' => 1000.00, 'keyword' => 'previous balance', 'raw_text' => 'Previous Balance: $1,000.00'],
                'ending_balance' => ['amount' => 2000.00, 'keyword' => 'ending balance', 'raw_text' => 'Ending Balance: $2,000.00'],
            ],
            scores: [
                'completeness' => 0.8,
                'quality' => 0.9,
                'pii_detection' => 0.5,
                'overall' => 0.73,
            ],
            piiBreakdown: ['ssn', 'email'],
            recommendations: ['Consider adding more details'],
            aiAnalysis: ['success' => true, 'analysis' => ['summary' => 'test']],
            mcaFindings: [['is_mca' => true, 'amount' => 500.00]],
            transactionClassification: ['type' => 'bank_statement'],
            cached: true,
            error: null
        );

        $this->assertSame('job-456', $context->jobId);
        $this->assertSame('/path/to/doc.pdf', $context->filePath);
        $this->assertSame(10, $context->documentId);
        $this->assertSame(5, $context->batchId);
        $this->assertSame('# Test PDF', $context->markdown);
        $this->assertSame('OCR content', $context->ocrText);
        $this->assertSame(3, $context->pageCount);
        $this->assertSame(['type' => 'bank_statement', 'confidence' => 0.95], $context->documentType);
        $this->assertSame(['account' => '123456789'], $context->keyDetails);
        $this->assertSame(1000.00, $context->balances['beginning_balance']['amount']);
        $this->assertSame(0.8, $context->scores['completeness']);
        $this->assertSame(['ssn', 'email'], $context->piiBreakdown);
        $this->assertTrue($context->cached);
    }

    public function test_to_result_array_output_shape(): void
    {
        $context = new PipelineContext(
            jobId: 'job-789',
            filePath: '/path/to/file.pdf',
            markdown: '# Bank Statement',
            ocrText: 'Some OCR text',
            pageCount: 5,
            documentType: ['type' => 'bank_statement', 'confidence' => 0.88],
            keyDetails: ['bank' => 'Test Bank'],
            balances: [
                'beginning_balance' => ['amount' => 500.00, 'keyword' => 'prev', 'raw_text' => 'Prev Balance: $500'],
                'ending_balance' => ['amount' => 750.00, 'keyword' => 'end', 'raw_text' => 'End Balance: $750'],
            ],
            scores: [
                'completeness' => 0.7,
                'quality' => 0.85,
                'pii_detection' => 0.6,
                'overall' => 0.72,
            ],
            piiBreakdown: ['email'],
            recommendations: ['recommendation1'],
            aiAnalysis: ['success' => true],
            mcaFindings: [['transaction' => 'mca1']],
            transactionClassification: ['classified' => true],
            cached: false
        );

        $result = $context->toResultArray();

        $this->assertIsArray($result);
        $this->assertArrayHasKey('markdown', $result);
        $this->assertArrayHasKey('ocr_text', $result);
        $this->assertArrayHasKey('document_type', $result);
        $this->assertArrayHasKey('key_details', $result);
        $this->assertArrayHasKey('scores', $result);
        $this->assertArrayHasKey('pii_breakdown', $result);
        $this->assertArrayHasKey('recommendations', $result);
        $this->assertArrayHasKey('balances', $result);
        $this->assertArrayHasKey('ai_analysis', $result);
        $this->assertArrayHasKey('mca_findings', $result);
        $this->assertArrayHasKey('transaction_classification', $result);
        $this->assertArrayHasKey('page_count', $result);
        $this->assertArrayHasKey('cached', $result);

        $this->assertSame('# Bank Statement', $result['markdown']);
        $this->assertSame('Some OCR text', $result['ocr_text']);
        $this->assertSame(5, $result['page_count']);
        $this->assertSame(['type' => 'bank_statement', 'confidence' => 0.88], $result['document_type']);
        $this->assertSame(['bank' => 'Test Bank'], $result['key_details']);
        $this->assertSame(0.7, $result['scores']['completeness']);
        $this->assertSame(['email'], $result['pii_breakdown']);
        $this->assertFalse($result['cached']);
    }

    public function test_to_result_array_contains_correct_defaults(): void
    {
        $context = new PipelineContext(
            jobId: 'job-empty',
            filePath: '/path/to/empty.pdf'
        );

        $result = $context->toResultArray();

        $this->assertSame('', $result['markdown']);
        $this->assertSame('', $result['ocr_text']);
        $this->assertSame(1, $result['page_count']);
        $this->assertSame(['type' => 'unknown', 'confidence' => 0.0], $result['document_type']);
        $this->assertSame([], $result['key_details']);
        $this->assertSame([], $result['pii_breakdown']);
        $this->assertSame([], $result['recommendations']);
        $this->assertSame([], $result['ai_analysis']);
        $this->assertSame([], $result['mca_findings']);
        $this->assertFalse($result['cached']);
    }
}
