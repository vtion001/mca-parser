<?php

namespace Tests\Jobs\Pipeline;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;
use App\Jobs\Pipeline\Steps\DoclingExtractionStep;
use App\Jobs\Pipeline\Steps\TypeDetectionStep;
use App\Jobs\Pipeline\Steps\FieldMappingStep;
use App\Jobs\Pipeline\Steps\ScoringStep;
use App\Jobs\Pipeline\Steps\PiiDetectionStep;
use App\Jobs\Pipeline\Steps\BalanceExtractionStep;
use App\Jobs\Pipeline\Steps\AiAnalysisStep;
use App\Services\Interfaces\ExtractionServiceInterface;
use App\Services\Interfaces\AiServiceInterface;
use App\Services\Analysis\DocumentTypeDetector;
use App\Services\Analysis\BalanceExtractorService;
use App\Services\Analysis\ExtractionScorer;
use App\Services\Analysis\PdfAnalyzerService;
use App\Services\Extraction\FieldMapper;
use App\Services\Ai\McaAiService;
use Mockery;
use Mockery\MockInterface;
use PHPUnit\Framework\TestCase;

/**
 * Verifies that all pipeline steps implement PipelineStepInterface correctly.
 * Uses real service instances for steps that don't need specific mock behavior,
 * and Mockery mocks for steps where we need to verify specific interactions.
 */
class PipelineStepInterfaceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_docling_extraction_step_implements_interface(): void
    {
        $mockService = $this->createMockExtractionService();
        $step = new DoclingExtractionStep($mockService);
        $this->assertInstanceOf(PipelineStepInterface::class, $step);
    }

    public function test_type_detection_step_implements_interface(): void
    {
        // Use real instance since DocumentTypeDetector has no external dependencies
        $realDetector = new DocumentTypeDetector();
        $step = new TypeDetectionStep($realDetector);
        $this->assertInstanceOf(PipelineStepInterface::class, $step);
    }

    public function test_field_mapping_step_implements_interface(): void
    {
        $mockMapper = $this->createMockFieldMapper();
        $step = new FieldMappingStep($mockMapper);
        $this->assertInstanceOf(PipelineStepInterface::class, $step);
    }

    public function test_scoring_step_implements_interface(): void
    {
        $mockScorer = $this->createMockScorer();
        $step = new ScoringStep($mockScorer);
        $this->assertInstanceOf(PipelineStepInterface::class, $step);
    }

    public function test_pii_detection_step_implements_interface(): void
    {
        $mockAnalyzer = $this->createMockAnalyzer();
        $step = new PiiDetectionStep($mockAnalyzer);
        $this->assertInstanceOf(PipelineStepInterface::class, $step);
    }

    public function test_balance_extraction_step_implements_interface(): void
    {
        // Use real instance since BalanceExtractorService is a simple service
        $realExtractor = new BalanceExtractorService();
        $step = new BalanceExtractionStep($realExtractor);
        $this->assertInstanceOf(PipelineStepInterface::class, $step);
    }

    public function test_ai_analysis_step_implements_interface(): void
    {
        $mockAiService = $this->createMockAiService();
        $mockMcaAiService = $this->createMockMcaAiService();
        $step = new AiAnalysisStep($mockAiService, $mockMcaAiService);
        $this->assertInstanceOf(PipelineStepInterface::class, $step);
    }

    public function test_all_steps_have_handle_method(): void
    {
        $steps = $this->createAllSteps();
        foreach ($steps as $step) {
            $this->assertTrue(
                method_exists($step, 'handle'),
                get_class($step) . ' must have handle() method'
            );
        }
    }

    public function test_all_steps_have_get_name_method(): void
    {
        $steps = $this->createAllSteps();
        foreach ($steps as $step) {
            $this->assertTrue(
                method_exists($step, 'getName'),
                get_class($step) . ' must have getName() method'
            );
        }
    }

    public function test_all_steps_handle_accepts_context_and_callback(): void
    {
        $steps = $this->createAllSteps();
        foreach ($steps as $step) {
            $context = new PipelineContext(jobId: 'test', filePath: '/test.pdf');
            $called = false;
            $callback = function () use (&$called) { $called = true; };

            $step->handle($context, $callback);
            $this->assertTrue($called, get_class($step) . ' handle() must invoke callback');
        }
    }

    public function test_all_steps_get_name_returns_string(): void
    {
        $steps = $this->createAllSteps();
        foreach ($steps as $step) {
            $name = $step->getName();
            $this->assertIsString($name, get_class($step) . ' getName() must return string');
            $this->assertNotEmpty($name, get_class($step) . ' getName() must not return empty string');
        }
    }

    public function test_docling_extraction_step_name(): void
    {
        $step = new DoclingExtractionStep($this->createMockExtractionService());
        $this->assertSame('docling_extraction', $step->getName());
    }

    public function test_type_detection_step_name(): void
    {
        $step = new TypeDetectionStep(new DocumentTypeDetector());
        $this->assertSame('type_detection', $step->getName());
    }

    public function test_field_mapping_step_name(): void
    {
        $step = new FieldMappingStep($this->createMockFieldMapper());
        $this->assertSame('field_mapping', $step->getName());
    }

    public function test_scoring_step_name(): void
    {
        $step = new ScoringStep($this->createMockScorer());
        $this->assertSame('scoring', $step->getName());
    }

    public function test_pii_detection_step_name(): void
    {
        $step = new PiiDetectionStep($this->createMockAnalyzer());
        $this->assertSame('pii_detection', $step->getName());
    }

    public function test_balance_extraction_step_name(): void
    {
        $step = new BalanceExtractionStep(new BalanceExtractorService());
        $this->assertSame('balance_extraction', $step->getName());
    }

    public function test_ai_analysis_step_name(): void
    {
        $step = new AiAnalysisStep(
            $this->createMockAiService(),
            $this->createMockMcaAiService()
        );
        $this->assertSame('ai_analysis', $step->getName());
    }

    private function createAllSteps(): array
    {
        return [
            new DoclingExtractionStep($this->createMockExtractionService()),
            new TypeDetectionStep(new DocumentTypeDetector()),
            new FieldMappingStep($this->createMockFieldMapper()),
            new ScoringStep($this->createMockScorer()),
            new PiiDetectionStep($this->createMockAnalyzer()),
            new BalanceExtractionStep(new BalanceExtractorService()),
            new AiAnalysisStep(
                $this->createMockAiService(),
                $this->createMockMcaAiService()
            ),
        ];
    }

    private function createMockExtractionService(): MockInterface
    {
        $mock = Mockery::mock(ExtractionServiceInterface::class);
        $mock->shouldReceive('extractText')
            ->andReturn([
                'success' => true,
                'text' => 'content',
                'ocr_text' => '',
                'page_count' => 1,
            ]);
        return $mock;
    }

    private function createMockFieldMapper(): MockInterface
    {
        $mock = Mockery::mock(FieldMapper::class);
        $mock->shouldReceive('map')
            ->andReturn([]);
        return $mock;
    }

    private function createMockScorer(): MockInterface
    {
        $mock = Mockery::mock(ExtractionScorer::class);
        $mock->shouldReceive('score')
            ->andReturn([
                'scores' => ['completeness' => 0.0, 'quality' => 0.0, 'pii_detection' => 0.0, 'overall' => 0.0],
                'pii_breakdown' => [],
                'recommendations' => [],
            ]);
        return $mock;
    }

    private function createMockAnalyzer(): MockInterface
    {
        $mock = Mockery::mock(PdfAnalyzerService::class);
        $mock->shouldReceive('checkPiiIndicators')
            ->andReturn(false);
        return $mock;
    }

    private function createMockAiService(): MockInterface
    {
        $mock = Mockery::mock(AiServiceInterface::class);
        $mock->shouldReceive('analyzeDocument')
            ->andReturn([
                'success' => true,
                'analysis' => ['transaction_summary' => ['credit_count' => 1]],
            ]);
        return $mock;
    }

    private function createMockMcaAiService(): MockInterface
    {
        $mock = Mockery::mock(McaAiService::class);
        $mock->shouldReceive('extractTransactionSummary')->andReturn(['credit_count' => 0]);
        $mock->shouldReceive('detect')->andReturn(['transactions' => [], 'summary' => []]);
        return $mock;
    }
}
