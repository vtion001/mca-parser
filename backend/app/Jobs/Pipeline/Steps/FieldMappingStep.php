<?php

namespace App\Jobs\Pipeline\Steps;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;
use App\Services\Extraction\FieldMapper;

class FieldMappingStep implements PipelineStepInterface
{
    public function __construct(
        private FieldMapper $fieldMapper
    ) {}

    public function handle(PipelineContext $context, callable $updateProgress): void
    {
        $updateProgress('mapping_fields', 'Mapping key details...', 55);

        $context->keyDetails = $this->fieldMapper->map(
            $context->markdown,
            $context->documentType['type']
        );
    }

    public function getName(): string
    {
        return 'field_mapping';
    }
}
