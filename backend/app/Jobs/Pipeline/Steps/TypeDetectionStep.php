<?php

namespace App\Jobs\Pipeline\Steps;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;
use App\Services\Analysis\DocumentTypeDetector;

class TypeDetectionStep implements PipelineStepInterface
{
    public function __construct(
        private DocumentTypeDetector $typeDetector
    ) {}

    public function handle(PipelineContext $context, callable $updateProgress): void
    {
        $updateProgress('detecting_type', 'Detecting document type...', 35);

        $context->documentType = $this->typeDetector->detect($context->markdown);
    }

    public function getName(): string
    {
        return 'type_detection';
    }
}
