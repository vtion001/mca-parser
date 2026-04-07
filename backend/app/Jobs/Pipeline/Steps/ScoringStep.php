<?php

namespace App\Jobs\Pipeline\Steps;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;
use App\Services\Analysis\ExtractionScorer;
use App\Services\Patterns\PiiPatterns;

class ScoringStep implements PipelineStepInterface
{
    public function __construct(
        private ExtractionScorer $scorer
    ) {}

    public function handle(PipelineContext $context, callable $updateProgress): void
    {
        $updateProgress('analyzing_quality', 'Analyzing extraction quality...', 75);

        $scoreResult = $this->scorer->score(
            $context->markdown,
            $context->pageCount,
            $context->piiBreakdown,
            PiiPatterns::ALL
        );

        $context->scores = $scoreResult['scores'];
        $context->piiBreakdown = $scoreResult['pii_breakdown'];
        $context->recommendations = $scoreResult['recommendations'];
    }

    public function getName(): string
    {
        return 'scoring';
    }
}
