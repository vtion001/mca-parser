# PDF Extraction Pipeline Runbook

## Overview

MCA PDF Scrubber has **two pipeline implementations**:

1. **`ProcessPdfExtraction`** (active) — A Laravel queue job with a linear 9-step flow. Used by `ExtractionController::fullExtract()`.
2. **`PdfExtractionPipeline`** (dead code) — A step-based class with 7 steps. Never wired to a controller. Has better architecture but is currently unreachable.

This runbook covers both, but operational guidance applies primarily to `ProcessPdfExtraction`.

---

## The 9-Step Extraction Flow (ProcessPdfExtraction)

Executed when `POST /api/v1/pdf/full-extract` is called:

```
Step 1: Cache Check (10%)
  └─ checkCache() → Cache::lock(30s TTL) + Cache::get(pdf_cache_{md5})
      ├─ Cache HIT  → handleCachedResult() → updateProgressComplete(100%) → return early
      └─ Cache MISS → proceed to extraction

Step 2: Document Status (10%)
  └─ Document::markAsProcessing() if documentId present

Step 3: Docling Text Extraction (10%)
  └─ doclingService.extractText(filePath)
      ├─ HTTP POST to docling-lb:8001/extract
      ├─ timeout: 600s, retries: 3x at 5s intervals on 502
      ├─ Returns: { success, text, ocr_text?, page_count?, error? }
      └─ If !success → failJob(error) → return

Step 4: Document Type Detection (35%)
  └─ typeDetector.detect(fullMarkdown) → { type, confidence }

Step 5: Field Mapping (55%)
  └─ fieldMapper.map(fullMarkdown, docType) → keyDetails[]

Step 6: PII Detection + Scoring (75%)
  └─ analyzer.checkPiiIndicators(fullMarkdown) → bool
  └─ scorer.score(markdown, pageCount, piiPatterns) → scores, pii_breakdown, recommendations
  └─ piiDetected = hasPii ? array_keys(PiiPatterns::ALL) : []

Step 7: Balance Extraction (80%)
  └─ balanceExtractor.extractBalances(fullMarkdown) → { beginning_balance, ending_balance }

Step 8: AI Analysis (85%)
  └─ openRouterService.analyzeDocument(...)
      ├─ If success + valid credit_count > 0 → use AI result
      └─ If credit_count=0 OR success=false → mcaAiService.extractTransactionSummary() fallback

Step 9: MCA Detection (92%)
  └─ mcaAiService.detect(markdown, keyDetails, balances) → mcaFindings[]

Step 10: Transaction Classification (95%)
  └─ txnClassifier.detect(fullMarkdown) → transactionClassification[]

Step 11: Completion
  ├─ updateProgressComplete(result)
  ├─ Cache::put("extraction_result_{jobId}", result, 24h)
  ├─ storeInCache(contentHash, result) — PDF hash cache, 7-day TTL
  ├─ Document::markAsComplete(result)
  └─ Batch::incrementCompleted()
```

---

## The 7-Step Pipeline (PdfExtractionPipeline — Dead Code)

**Note:** This pipeline is registered but never called. It exists as architectural dead code.

```
1. DoclingExtractionStep       (extraction)
2. TypeDetectionStep           (type detection)
3. FieldMappingStep            (field mapping)
4. ScoringStep                 (quality scoring)
5. PiiDetectionStep            (PII detection — overwrites piiBreakdown)
6. BalanceExtractionStep       (balance extraction)
7. AiAnalysisStep              (AI analysis + fallback)
```

Post-processing (after the loop):
- MCA Detection (via `mcaAiService->detect()`)
- Transaction Classification (via `txnClassifier->detect()`)

---

## Adding a New Pipeline Step

### To PdfExtractionPipeline (Dead Code Path)

1. Create a new class in `backend/app/Jobs/Pipeline/Steps/` implementing `PipelineStepInterface`:

```php
<?php
namespace App\Jobs\Pipeline\Steps;

use App\Jobs\Pipeline\PipelineContext;
use App\Jobs\Pipeline\PipelineStepInterface;

class MyNewStep implements PipelineStepInterface
{
    public function handle(PipelineContext $context, callable $updateProgress): void
    {
        $updateProgress('my_step', 'Doing my step...', 50);
        // Modify $context fields as needed
        $context->myField = 'computed value';
    }

    public function getName(): string
    {
        return 'my_step';
    }
}
```

2. Register the step in `PdfExtractionPipeline::registerSteps()`:

```php
private function registerSteps(): void
{
    $this->steps = [
        'docling' => new DoclingExtractionStep($this->extractionService),
        'type_detection' => new TypeDetectionStep($this->typeDetector),
        'field_mapping' => new FieldMappingStep($this->fieldMapper),
        'scoring' => new ScoringStep($this->scorer),
        'pii_detection' => new PiiDetectionStep($this->analyzerService),
        'balance_extraction' => new BalanceExtractionStep($this->balanceExtractor),
        'ai_analysis' => new AiAnalysisStep($this->aiService, $this->mcaAiService),
        'my_step' => new MyNewStep(),  // Add here
    ];
}
```

3. Add the step to `TestablePipeline::getRegisteredStepOrder()` in the test file for consistency.

### To ProcessPdfExtraction (Active Path)

The active path is a linear job, not step-based. To add a new step:

1. Insert new logic in `ProcessPdfExtraction::handle()` between existing steps.
2. Update the progress percentage to reflect the new step position.
3. If the new step should write to the cache, call `updateProgress()` with a new stage name.
4. Update `CRITICAL_PATHS.md` to document the new step.

---

## Triggering Manual Re-Extraction

### Via API (Single Document)

```bash
# Re-upload the PDF to get a new extraction
POST /api/v1/pdf/full-extract
Content-Type: multipart/form-data
Authorization: Bearer <token>
X-Account-ID: <account_id>

file: <pdf_file>
```

This creates a new job and returns a new `job_id`. The original document is not modified.

### Via Database (Force Re-Extract)

```sql
-- Mark document as pending so it can be re-processed
UPDATE documents SET status = 'pending' WHERE id = <document_id>;

-- Then dispatch a new job (via tinker or a custom artisan command)
php artisan tinker
>>> App\Jobs\ProcessPdfExtraction::dispatch(
>>>     'new-job-id',
>>>     App\Models\Document::find(<document_id>)->file_path,
>>>     <document_id>
>>> );
```

### Via Cache Invalidation

To force re-extraction (skip cache):

```sql
-- Delete the PDF content cache entry
DELETE FROM cache WHERE key = 'pdf_cache_{md5_of_file}';

-- Also delete progress and result cache
DELETE FROM cache WHERE key = 'extraction_progress_{job_id}';
DELETE FROM cache WHERE key = 'extraction_result_{job_id}';
```

---

## Cache Key Format and TTL

| Key Pattern | TTL | Written By | Read By |
|-------------|-----|------------|---------|
| `pdf_cache_{md5_file}` | 7 days | ProcessPdfExtraction, PdfExtractionPipeline | ProcessPdfExtraction (checkCache) |
| `extraction_progress_{jobId}` | 24 hours | ProcessPdfExtraction (updateProgress) | ExtractionController::progress() |
| `extraction_result_{jobId}` | 24 hours | ProcessPdfExtraction (updateProgressComplete) | Frontend polling |
| `lock_{cacheKey}` | 30 seconds | Both pipelines (stampede protection) | Both pipelines |

---

## What Happens When a Step Fails

### Exception Thrown

Any unhandled exception in `ProcessPdfExtraction::handle()` is caught by the outer try/catch:

```php
} catch (\Exception $e) {
    Log::error('ProcessPdfExtraction failed: ' . $e->getMessage());
    $this->failJob($e->getMessage());
}
// Exception NOT re-thrown — Laravel considers job complete
```

**Critical:** The exception is caught but NOT re-thrown. Laravel's queue worker marks the job as acknowledged (complete). The job will NOT retry automatically. This is a known bug that causes silent data loss if `Document::markAsComplete()` throws.

### Step Sets `$context->error`

Only `DoclingExtractionStep` sets `$context->error`. After the step loop:

```php
foreach ($this->steps as $step) {
    if ($context->error !== null) { break; }  // Short-circuits loop
    $step->handle($context, $updateProgress);
}
if ($context->error !== null) {
    $this->failJob($context);  // Routes to failJob()
}
```

### failJob() Behavior

```
1. Document::markAsFailed($context->error) if documentId present
2. Batch::incrementCompleted() (failed docs count toward batch completion)
3. Cache::put("extraction_progress_{jobId}", { status: 'failed', error: ... }, 24h)
```

---

## Job Configuration

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `$tries` | 5 | Job will be attempted 5 times before being marked failed |
| `$backoff` | 60 | Seconds between retries (exponential: 60, 120, 240, 480, 960s) |
| `$timeout` | 900 | 15 minutes max execution time |

Retry triggers:
- HTTP timeout from DoclingService (600s)
- Exception thrown in any step
- Docling returning `success: false`

Retry does NOT trigger:
- `credit_count=0` fallback (non-exception path)
- AI service failure (handled gracefully with fallback)

---

## Redis/Cache Failure Behavior

All cache operations are wrapped in try/catch. If Redis is unavailable:

| Operation | Behavior |
|-----------|----------|
| Progress read (poll) | Returns null → frontend gets 404 |
| Result read | Returns null (DB may have final result via `markAsComplete`) |
| Progress write | Fails silently (frontend gets stale progress) |
| Result write | Fails silently (result in DB, frontend retrieves via polling result endpoint) |
| Stampede lock | `Cache::lock()->get()` throws → proceeds without lock, may cause cache stampede |
| Cache::put (result) | Fails silently |

The PDF content hash cache (`pdf_cache_{md5}`) is the most critical — if Redis is down, every identical PDF is re-extracted rather than served from cache.
