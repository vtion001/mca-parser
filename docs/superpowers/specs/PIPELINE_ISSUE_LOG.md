# Pipeline Issue Log

Issues found during Phase 1 audit of pipeline and specialized services.

---

## #1 — AiAnalysisStep: Logic inversion on fallback condition

**File:** `backend/app/Jobs/Pipeline/Steps/AiAnalysisStep.php:32-34`

**Description:**
```php
$needsFallback = !$context->aiAnalysis['success']
    || $txnSummary === null
    || ($txnSummary['credit_count'] === null || $txnSummary['credit_count'] === 0);
```
The fallback triggers when `$txnSummary['credit_count'] === 0`, but credit_count=0 is a valid result (a statement with only debits, or a blank period). The fallback should only trigger when `credit_count` is **missing** (`null`), not when it's zero.

**Risk:** MEDIUM — Will unnecessarily compute transaction summaries for legitimate zero-credit statements, and overwrite AI results that have `credit_count=0` with computed values that could be wrong.

**Fixed?** No.

---

## #2 — AiAnalysisStep: Fallback only runs when AI partially succeeds

**File:** `backend/app/Jobs/Pipeline/Steps/AiAnalysisStep.php:37-44`

**Description:**
```php
if ($needsFallback) {
    $computedSummary = $this->mcaAiService->extractTransactionSummary($context->markdown);
    if ($context->aiAnalysis['success'] && isset($context->aiAnalysis['analysis'])) {
        $context->aiAnalysis['analysis']['transaction_summary'] = $computedSummary;
        $context->aiAnalysis['fallback_transaction_summary'] = true;
    } elseif (!$context->aiAnalysis['success']) {
        $context->aiAnalysis['analysis']['transaction_summary'] = $computedSummary;
    }
}
```
When `!$context->aiAnalysis['success']` (AI completely failed), the computed summary is attached to `aiAnalysis['analysis']['transaction_summary']` but `aiAnalysis['success']` remains `false`. The caller receives `success: false` with partial data — ambiguous whether the analysis actually succeeded.

**Risk:** MEDIUM — Callers cannot easily distinguish "AI failed but we have computed fallback" from "AI failed with no data".

**Fixed?** No.

---

## #3 — PiiDetectionStep: Discards ScoringStep's detailed pii_breakdown

**File:** `backend/app/Jobs/Pipeline/Steps/PiiDetectionStep.php:20-27`

**Description:**
`PiiDetectionStep` overwrites `$context->piiBreakdown` with `array_keys(PiiPatterns::ALL)` — a simple list of pattern names — replacing whatever `ScoringStep` computed (a detailed array with `found` boolean and `label` per pattern). The order matters: `PiiDetectionStep` runs **before** `ScoringStep`, so when `ScoringStep` runs it builds a fresh `piiBreakdown` from scratch anyway. But if the pipeline order ever changes, or if another step populates `piiBreakdown` before `PiiDetectionStep` runs, that data is lost.

**Risk:** LOW — Pipeline order is fixed. Logic works as designed.

**Fixed?** No (but not urgent).

---

## #4 — Cache stampede: lock release on exception path

**File:** `backend/app/Jobs/Pipeline/PdfExtractionPipeline.php:142-146`

**Description:**
```php
$lock = Cache::lock("lock_{$cacheKey}", 30);
if ($lock->get()) {
    $cached = Cache::get($cacheKey);
    $lock->release();  // ← if Cache::get() throws, lock holds for 30s
    return $cached;
}
```
If `Cache::get()` throws after the lock is acquired but before `release()` is called, the lock is held for the full 30-second TTL. Other requests wanting to populate the same cache key will block or fail for up to 30 seconds.

**Risk:** MEDIUM — Transient failures (Redis timeout, network blips) could cause lock contention. Concurrent PDF extractions of the same file would fail.

**Fixed?** No.

---

## #5 — DoclingService: 3 retries at 5s each may not be enough

**File:** `backend/app/Services/DoclingService.php:22-23`

**Description:**
```php
$response = Http::timeout(600)
    ->retry(3, 5000)
    ->attach('file', file_get_contents($filePath), 'document.pdf')
    ->post($this->serviceUrl . '/extract');
```
The retry loop handles transient 502s from worker crashes with only 5 seconds between attempts. If all 5 docling replicas restart simultaneously (e.g., node failure, rolling deploy), all 3 retries could hit 502s before the service recovers. The job-level retry (`$tries=5`) will eventually re-queue, but users wait longer.

**Risk:** MEDIUM — Cluster-wide restart events could cause prolonged failures despite overall resilience.

**Fixed?** No.

---

## #6 — BalanceExtractorService: Amount regex allows catastrophic backtracking

**File:** `backend/app/Services/BalanceExtractorService.php:49`

**Description:**
```php
private string $amountPattern = '/-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-?/';
```
This pattern uses nested quantifiers (`(?:\.\d{1,2})?-?`). While not catastrophic for typical input (single-line amounts), the combination of `(?:\.\d{1,2})?` followed by `-?` and the outer `-?` creates ambiguous matching at end of string. The `-?` after optional decimal creates backtracking when amounts don't end with a minus.

**Risk:** MEDIUM (ReDoS) — Malformed input (e.g., `1,234,567,890.12-` or very long digit strings) could trigger excessive backtracking. However, the regex is applied per-line via `preg_match_all()` in `extractAmount()`, limiting exposure to individual lines.

**Fixed?** No.

---

## #7 — McaDetectionService: scoreTransaction() ignores candidates with 0.0

**File:** `backend/app/Services/McaDetectionService.php:259-263`

**Description:**
```php
if (!$isMcaProduct) {
    foreach ($this->excludedProcessors as $processor) {
        if (strpos($descLower, $processor) !== false) {
            return 0.0;  // Immediately disqualifies Stripe/Square/etc.
        }
    }
}
```
Payment processors are hard-excluded unless they match an MCA product pattern. But Stripe Capital, Square Capital, and PayPal Working Capital are identified via exact string match in `mcaProductPatterns`. If a transaction says "STRIPE CAP" (no space, no "capital"), it would be excluded despite being a real MCA.

**Risk:** MEDIUM — Common abbreviation variants could cause false negatives for payment-processor MCA products.

**Fixed?** No.

---

## #8 — FieldMapper: Regex with unanchored pattern may cause issues

**File:** `backend/app/Services/FieldMapper.php:116-119`

**Description:**
```php
if (str_starts_with($pattern, '/') && preg_match('#^/.+/[a-z]*$#i', $pattern)) {
    $regex = substr($pattern, 1, -1);
    if (preg_match('#' . $regex . '#', $text, $matches)) {  // unanchored!
```
The regex extracted from `/pattern/` is used without anchoring (`#` delimiter but no `^` or `$`). This means patterns like `/Beginning Balance/` match anywhere in the text, which is usually fine — but for field extraction contexts, this could match the wrong line when multiple similar labels exist.

**Risk:** LOW — Field context is extracted from the line containing the match via `strrpos` + `strpos` back to line boundaries.

**Fixed?** No.

---

## #9 — PipelineContext: Error property mutated mid-pipeline

**File:** `backend/app/Jobs/Pipeline/PipelineContext.php:38`

**Description:**
`PipelineContext::$error` is a public nullable string that gets set by any step (`$context->error = '...'`) and then checked in the pipeline loop:
```php
foreach ($this->steps as $step) {
    if ($context->error !== null) { break; }
    $step->handle($context, $updateProgress);
}
```
While this works, it violates the principle of least surprise for a "context" object. A step could accidentally set error when it shouldn't, silently short-circuiting downstream steps.

**Risk:** LOW — Steps would need to accidentally set error string non-null.

**Fixed?** No.

---

## #10 — Missing: No circuit breaker on AI service calls

**File:** `backend/app/Services/BaseAIService.php:77-90`

**Description:**
`analyzeDocument()` catches all exceptions and returns fallback, but there's no tracking of consecutive failures. A prolonged AI API outage means every request attempts the API call, fails, then falls back — adding latency without adding value. No consecutive failure counter or "degraded" state.

**Risk:** MEDIUM — Unnecessary latency during prolonged AI outages.

**Fixed?** No.

---

## #11 — Missing: No timeout on Cache::put operations

**File:** `backend/app/Jobs/Pipeline/PdfExtractionPipeline.php:246-268`

**Description:**
`Cache::put()` calls (progress updates, final results) have no timeout specified. If Redis is slow or unreachable, these calls could block the worker thread. The progress callback fires from every step, so blocking on `Cache::put` could significantly slow down fast extractions.

**Risk:** LOW — Laravel Cache uses Redis by default; network issues would affect all cache operations equally.

**Fixed?** No.

---

## Summary

| # | Description | File:Line | Risk |
|---|-------------|-----------|------|
| 1 | Fallback triggers on credit_count=0 (valid value) | AiAnalysisStep.php:32-34 | MEDIUM |
| 2 | Fallback overwrites success=false with partial data | AiAnalysisStep.php:37-44 | MEDIUM |
| 3 | PiiDetectionStep overwrites piiBreakdown (order-dependent) | PiiDetectionStep.php:20-27 | LOW |
| 4 | Lock not released if Cache::get() throws | PdfExtractionPipeline.php:142-146 | MEDIUM |
| 5 | Docling retries may be insufficient for cluster restarts | DoclingService.php:22-23 | MEDIUM |
| 6 | Amount regex has nested quantifier backtracking risk | BalanceExtractorService.php:49 | MEDIUM |
| 7 | Payment processor MCA exclusion too strict | McaDetectionService.php:259-263 | MEDIUM |
| 8 | Unanchored regex in field mapping | FieldMapper.php:116-119 | LOW |
| 9 | Error property mutation mid-pipeline | PipelineContext.php:38 | LOW |
| 10 | No AI service circuit breaker | BaseAIService.php:77-90 | MEDIUM |
| 11 | No timeout on Cache::put operations | PdfExtractionPipeline.php:246-268 | LOW |

**Total issues: 11 | HIGH: 0 | MEDIUM: 7 | LOW: 4**