<?php

namespace App\Jobs\Pipeline\Steps;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;
use App\Services\Analysis\PdfAnalyzerService;
use App\Services\Patterns\PiiPatterns;

class PiiDetectionStep implements PipelineStepInterface
{
    public function __construct(
        private PdfAnalyzerService $analyzerService
    ) {}

    public function handle(PipelineContext $context, callable $updateProgress): void
    {
        $updateProgress('pii_detection', 'Detecting PII...', 65);

        $hasPii = $this->analyzerService->checkPiiIndicators($context->markdown);
        $piiPatterns = PiiPatterns::ALL;

        if ($hasPii) {
            $context->piiBreakdown = array_keys($piiPatterns);
        } else {
            $context->piiBreakdown = [];
        }
    }

    public function getName(): string
    {
        return 'pii_detection';
    }
}
