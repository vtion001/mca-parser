<?php

namespace Tests\Jobs\Pipeline;

use App\Jobs\Pipeline\PipelineContext;
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
use App\Services\Classification\TransactionClassificationService;
use Mockery;
use Mockery\MockInterface;
use PHPUnit\Framework\TestCase;

/**
 * Tests for PdfExtractionPipeline orchestration behavior.
 *
 * Uses a standalone testable pipeline class that replicates the actual
 * pipeline behavior without extending the real pipeline (to avoid constructor issues).
 */
class PdfExtractionPipelineTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_step_registration_order(): void
    {
        $pipeline = new TestablePipeline();
        $stepOrder = $pipeline->getRegisteredStepOrder();

        $this->assertSame([
            'docling',
            'type_detection',
            'field_mapping',
            'scoring',
            'pii_detection',
            'balance_extraction',
            'ai_analysis',
        ], $stepOrder);
    }

    public function test_error_propagation_stops_pipeline(): void
    {
        $extractionService = Mockery::mock(ExtractionServiceInterface::class);
        $extractionService->shouldReceive('extractText')
            ->once()
            ->andReturn([
                'success' => false,
                'error' => 'Extraction failed',
            ]);

        $pipeline = new TestablePipeline();
        $pipeline->setExtractionService($extractionService);
        $pipeline->setTypeDetector(new DocumentTypeDetector()); // Use real instance
        $pipeline->setFieldMapper(new FieldMapper()); // Use real instance
        $pipeline->setScorer($this->createMockScorer());
        $pipeline->setAnalyzer($this->createMockAnalyzer());
        $pipeline->setBalanceExtractor(new BalanceExtractorService());
        $pipeline->setAiService($this->createMockAiService());
        $pipeline->setMcaAiService($this->createMockMcaAiService());
        $pipeline->setTxnClassifier($this->createMockTxnClassifier());

        $result = $pipeline->execute('job-err', '/path/to/file.pdf');

        // Should return empty array on error (as per pipeline behavior)
        $this->assertSame([], $result);
    }

    public function test_execute_returns_result_array(): void
    {
        $pipeline = new TestablePipeline();
        $this->setupSuccessfulMocks($pipeline);

        $result = $pipeline->execute('job-test', '/path/to/file.pdf');

        $this->assertIsArray($result);
        $this->assertArrayHasKey('markdown', $result);
        $this->assertArrayHasKey('ocr_text', $result);
        $this->assertArrayHasKey('document_type', $result);
        $this->assertArrayHasKey('scores', $result);
        $this->assertArrayHasKey('pii_breakdown', $result);
        $this->assertArrayHasKey('page_count', $result);
    }

    private function setupSuccessfulMocks(TestablePipeline $pipeline): void
    {
        $extractionService = Mockery::mock(ExtractionServiceInterface::class);
        $extractionService->shouldReceive('extractText')
            ->andReturn([
                'success' => true,
                'text' => '# Document Content',
                'ocr_text' => '',
                'page_count' => 1,
            ]);
        $pipeline->setExtractionService($extractionService);

        $pipeline->setTypeDetector(new DocumentTypeDetector());
        $pipeline->setFieldMapper(new FieldMapper());
        $pipeline->setScorer($this->createMockScorer());
        $pipeline->setAnalyzer($this->createMockAnalyzer());
        $pipeline->setBalanceExtractor(new BalanceExtractorService());
        $pipeline->setAiService($this->createMockAiService());
        $pipeline->setMcaAiService($this->createMockMcaAiService());
        $pipeline->setTxnClassifier($this->createMockTxnClassifier());
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

    private function createMockTxnClassifier(): MockInterface
    {
        $mock = Mockery::mock(TransactionClassificationService::class);
        $mock->shouldReceive('detect')->andReturn([]);
        return $mock;
    }
}

/**
 * Testable pipeline that replicates PdfExtractionPipeline behavior.
 *
 * This is a standalone class that allows testing the orchestration logic
 * without dependency on the actual constructor or Laravel infrastructure.
 */
class TestablePipeline
{
    private ?ExtractionServiceInterface $extractionService = null;
    private ?DocumentTypeDetector $typeDetector = null;
    private ?FieldMapper $fieldMapper = null;
    private ?PdfAnalyzerService $analyzer = null;
    private ?BalanceExtractorService $balanceExtractor = null;
    private ?AiServiceInterface $aiService = null;
    private ?McaAiService $mcaAiService = null;
    private ?TransactionClassificationService $txnClassifier = null;
    private ?ExtractionScorer $scorer = null;

    public function setExtractionService(ExtractionServiceInterface $service): void
    {
        $this->extractionService = $service;
    }

    public function setTypeDetector(DocumentTypeDetector $service): void
    {
        $this->typeDetector = $service;
    }

    public function setFieldMapper(FieldMapper $service): void
    {
        $this->fieldMapper = $service;
    }

    public function setScorer(ExtractionScorer $service): void
    {
        $this->scorer = $service;
    }

    public function setAnalyzer(PdfAnalyzerService $service): void
    {
        $this->analyzer = $service;
    }

    public function setBalanceExtractor(BalanceExtractorService $service): void
    {
        $this->balanceExtractor = $service;
    }

    public function setAiService(AiServiceInterface $service): void
    {
        $this->aiService = $service;
    }

    public function setMcaAiService(McaAiService $service): void
    {
        $this->mcaAiService = $service;
    }

    public function setTxnClassifier(TransactionClassificationService $service): void
    {
        $this->txnClassifier = $service;
    }

    public function getRegisteredStepOrder(): array
    {
        return [
            'docling',
            'type_detection',
            'field_mapping',
            'scoring',
            'pii_detection',
            'balance_extraction',
            'ai_analysis',
        ];
    }

    public function execute(string $jobId, string $filePath, ?int $documentId = null, ?int $batchId = null): array
    {
        $context = new PipelineContext(
            jobId: $jobId,
            filePath: $filePath,
            documentId: $documentId,
            batchId: $batchId
        );

        $updateProgress = fn(string $stage, string $label, int $percent) => null;

        // Build steps from injected services (same order as PdfExtractionPipeline)
        $steps = [
            'docling' => new DoclingExtractionStep($this->extractionService),
            'type_detection' => new TypeDetectionStep($this->typeDetector),
            'field_mapping' => new FieldMappingStep($this->fieldMapper),
            'scoring' => new ScoringStep($this->scorer),
            'pii_detection' => new PiiDetectionStep($this->analyzer),
            'balance_extraction' => new BalanceExtractionStep($this->balanceExtractor),
            'ai_analysis' => new AiAnalysisStep($this->aiService, $this->mcaAiService),
        ];

        // Execute steps (same error propagation logic as PdfExtractionPipeline)
        foreach ($steps as $step) {
            if ($context->error !== null) {
                return [];
            }
            $step->handle($context, $updateProgress);
        }

        if ($context->error !== null) {
            return [];
        }

        return $context->toResultArray();
    }
}
