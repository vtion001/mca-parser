<?php

namespace Tests\Jobs\Pipeline;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\Steps\AiAnalysisStep;
use App\Services\Interfaces\AiServiceInterface;
use App\Services\Ai\McaAiService;
use App\Services\Analysis\DocumentTypeDetector;
use App\Services\Analysis\BalanceExtractorService;
use App\Services\Analysis\ExtractionScorer;
use App\Services\Analysis\PdfAnalyzerService;
use App\Services\Extraction\FieldMapper;
use App\Services\Interfaces\ExtractionServiceInterface;
use Mockery;
use Mockery\MockInterface;
use PHPUnit\Framework\TestCase;

/**
 * Tests for AiAnalysisStep behavior.
 */
class AiAnalysisStepTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_calls_ai_service_analyze_document(): void
    {
        $mockAiService = Mockery::mock(AiServiceInterface::class);
        $mockAiService->shouldReceive('analyzeDocument')
            ->once()
            ->with(
                'Sample markdown',
                ['type' => 'bank_statement', 'confidence' => 0.9],
                ['key' => 'value'],
                ['beginning_balance' => ['amount' => 100.00]]
            )
            ->andReturn([
                'success' => true,
                'analysis' => [
                    'transaction_summary' => [
                        'credit_count' => 5,
                        'debit_count' => 3,
                        'total_credits' => 1000.00,
                        'total_debits' => 500.00,
                    ],
                ],
            ]);

        $mockMcaAiService = $this->createMockMcaAiService();
        $mockMcaAiService->shouldReceive('extractTransactionSummary')
            ->andReturn(['credit_count' => 0]);

        $step = new AiAnalysisStep($mockAiService, $mockMcaAiService);
        $context = new PipelineContext(
            jobId: 'test-job',
            filePath: '/path/to/test.pdf',
            markdown: 'Sample markdown',
            documentType: ['type' => 'bank_statement', 'confidence' => 0.9],
            keyDetails: ['key' => 'value'],
            balances: ['beginning_balance' => ['amount' => 100.00]]
        );

        $updateProgressCalled = false;
        $step->handle($context, function () use (&$updateProgressCalled) {
            $updateProgressCalled = true;
        });

        $this->assertTrue($updateProgressCalled);
        $this->assertSame(5, $context->aiAnalysis['analysis']['transaction_summary']['credit_count']);
    }

    public function test_triggers_fallback_when_credit_count_is_zero(): void
    {
        $mockAiService = Mockery::mock(AiServiceInterface::class);
        $mockAiService->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn([
                'success' => true,
                'analysis' => [
                    'transaction_summary' => [
                        'credit_count' => 0,
                        'debit_count' => 0,
                    ],
                ],
            ]);

        $computedSummary = [
            'credit_count' => 3,
            'debit_count' => 2,
            'total_credits' => 300.00,
            'total_debits' => 150.00,
        ];

        $mockMcaAiService = $this->createMockMcaAiService();
        $mockMcaAiService->shouldReceive('extractTransactionSummary')
            ->once()
            ->with('markdown content')
            ->andReturn($computedSummary);

        $step = new AiAnalysisStep($mockAiService, $mockMcaAiService);
        $context = new PipelineContext(
            jobId: 'test-job',
            filePath: '/path/to/test.pdf',
            markdown: 'markdown content',
            documentType: ['type' => 'unknown'],
            keyDetails: [],
            balances: []
        );

        $step->handle($context, fn() => null);

        $this->assertTrue($context->aiAnalysis['fallback_transaction_summary']);
        $this->assertSame($computedSummary, $context->aiAnalysis['analysis']['transaction_summary']);
    }

    public function test_triggers_fallback_when_ai_analysis_failed(): void
    {
        $mockAiService = Mockery::mock(AiServiceInterface::class);
        $mockAiService->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn([
                'success' => false,
                'error' => 'AI service unavailable',
            ]);

        $computedSummary = [
            'credit_count' => 2,
            'debit_count' => 1,
            'total_credits' => 200.00,
            'total_debits' => 50.00,
        ];

        $mockMcaAiService = $this->createMockMcaAiService();
        $mockMcaAiService->shouldReceive('extractTransactionSummary')
            ->once()
            ->andReturn($computedSummary);

        $step = new AiAnalysisStep($mockAiService, $mockMcaAiService);
        $context = new PipelineContext(
            jobId: 'test-job',
            filePath: '/path/to/test.pdf',
            markdown: 'content',
            documentType: ['type' => 'unknown'],
            keyDetails: [],
            balances: []
        );

        $step->handle($context, fn() => null);

        $this->assertSame($computedSummary, $context->aiAnalysis['analysis']['transaction_summary']);
    }

    public function test_triggers_fallback_when_transaction_summary_is_null(): void
    {
        $mockAiService = Mockery::mock(AiServiceInterface::class);
        $mockAiService->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn([
                'success' => true,
                'analysis' => [
                ],
            ]);

        $mockMcaAiService = $this->createMockMcaAiService();
        $mockMcaAiService->shouldReceive('extractTransactionSummary')
            ->once()
            ->andReturn(['credit_count' => 1]);

        $step = new AiAnalysisStep($mockAiService, $mockMcaAiService);
        $context = new PipelineContext(
            jobId: 'test-job',
            filePath: '/path/to/test.pdf',
            markdown: 'content',
            documentType: ['type' => 'unknown'],
            keyDetails: [],
            balances: []
        );

        $step->handle($context, fn() => null);

        $this->assertArrayHasKey('fallback_transaction_summary', $context->aiAnalysis);
    }

    public function test_does_not_trigger_fallback_when_credit_count_is_positive(): void
    {
        $mockAiService = Mockery::mock(AiServiceInterface::class);
        $mockAiService->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn([
                'success' => true,
                'analysis' => [
                    'transaction_summary' => [
                        'credit_count' => 5,
                        'debit_count' => 3,
                    ],
                ],
            ]);

        $mockMcaAiService = $this->createMockMcaAiService();
        $mockMcaAiService->shouldNotReceive('extractTransactionSummary');

        $step = new AiAnalysisStep($mockAiService, $mockMcaAiService);
        $context = new PipelineContext(
            jobId: 'test-job',
            filePath: '/path/to/test.pdf',
            markdown: 'content',
            documentType: ['type' => 'unknown'],
            keyDetails: [],
            balances: []
        );

        $step->handle($context, fn() => null);

        $this->assertArrayNotHasKey('fallback_transaction_summary', $context->aiAnalysis);
    }

    public function test_get_name_returns_correct_step_name(): void
    {
        $mockAiService = Mockery::mock(AiServiceInterface::class);
        $mockMcaAiService = $this->createMockMcaAiService();
        $step = new AiAnalysisStep($mockAiService, $mockMcaAiService);

        $this->assertSame('ai_analysis', $step->getName());
    }

    private function createMockMcaAiService(): MockInterface
    {
        return Mockery::mock(McaAiService::class);
    }
}
