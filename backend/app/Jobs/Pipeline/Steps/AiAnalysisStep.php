<?php

namespace App\Jobs\Pipeline\Steps;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;
use App\Services\Interfaces\AiServiceInterface;
use App\Services\Ai\McaAiService;

class AiAnalysisStep implements PipelineStepInterface
{
    public function __construct(
        private AiServiceInterface $aiService,
        private McaAiService $mcaAiService
    ) {}

    public function handle(PipelineContext $context, callable $updateProgress): void
    {
        $updateProgress('ai_analysis', 'Running AI analysis...', 85);

        $context->aiAnalysis = $this->aiService->analyzeDocument(
            $context->markdown,
            $context->documentType,
            $context->keyDetails,
            $context->balances
        );

        // Fallback: If AI analysis failed or returned null/zero transaction counts,
        // compute basic transaction totals from extracted transactions.
        // AI may return credit_count=0 when it couldn't detect any — also trigger fallback.
        $txnSummary = $context->aiAnalysis['analysis']['transaction_summary'] ?? null;
        $needsFallback = !$context->aiAnalysis['success']
            || $txnSummary === null
            || ($txnSummary['credit_count'] === null || $txnSummary['credit_count'] === 0);

        if ($needsFallback) {
            $computedSummary = $this->mcaAiService->extractTransactionSummary($context->markdown);
            if ($context->aiAnalysis['success'] && isset($context->aiAnalysis['analysis'])) {
                $context->aiAnalysis['analysis']['transaction_summary'] = $computedSummary;
                $context->aiAnalysis['fallback_transaction_summary'] = true;
            } elseif (!$context->aiAnalysis['success']) {
                // AI completely failed — still attach the computed summary so caller has data
                $context->aiAnalysis['analysis']['transaction_summary'] = $computedSummary;
            }
        }
    }

    public function getName(): string
    {
        return 'ai_analysis';
    }
}
