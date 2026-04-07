<?php

namespace App\Jobs\Pipeline;

/**
 * Base interface for pipeline steps.
 */
interface PipelineStepInterface
{
    /**
     * Execute the step and update the context.
     *
     * @param PipelineContext $context The pipeline context
     * @param callable $updateProgress Progress callback fn(stage, label, percent)
     * @return void
     */
    public function handle(PipelineContext $context, callable $updateProgress): void;

    /**
     * Get the step name for progress reporting.
     */
    public function getName(): string;
}
