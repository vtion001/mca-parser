<?php

namespace App\Jobs\Pipeline\Steps;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;
use App\Services\Analysis\BalanceExtractorService;

class BalanceExtractionStep implements PipelineStepInterface
{
    public function __construct(
        private BalanceExtractorService $balanceExtractor
    ) {}

    public function handle(PipelineContext $context, callable $updateProgress): void
    {
        $updateProgress('extracting_balances', 'Extracting balances...', 80);

        $context->balances = $this->balanceExtractor->extractBalances($context->markdown);
    }

    public function getName(): string
    {
        return 'balance_extraction';
    }
}
