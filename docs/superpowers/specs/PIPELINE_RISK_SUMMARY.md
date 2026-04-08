# Pipeline Risk Summary

Grouped by severity from Phase 1 audit.

---

## HIGH — Must Fix Immediately

*None found.* No critical security vulnerabilities or data corruption risks identified in the pipeline or services.

---

## MEDIUM — Fix Next Sprint

### Issue 1: AiAnalysisStep fallback triggers on credit_count=0 (valid value)
**File:** `backend/app/Jobs/Pipeline/Steps/AiAnalysisStep.php:32-34`

A bank statement with zero credits (e.g., a month with only debits) is a valid document. The condition `$txnSummary['credit_count'] === 0` causes the fallback to fire and overwrite the AI-provided analysis with a computed summary. This means the AI's qualification score, risk indicators, and other structured analysis are silently discarded and replaced with less capable computed data.

**Fix:** Change to `$txnSummary['credit_count'] === null` — only trigger fallback when the value is missing, not when it's zero.

---

### Issue 2: AiAnalysisStep ambiguous success state after fallback
**File:** `backend/app/Jobs/Pipeline/Steps/AiAnalysisStep.php:37-44`

When AI fails completely (`!$context->aiAnalysis['success']`), the computed transaction summary is attached but `success` remains `false`. Callers receive contradictory signals — there's data but the operation "failed". The fallback path when AI partially succeeds sets `fallback_transaction_summary = true`, but the no-AI path does not clearly signal that data was recovered.

**Fix:** When fallback computed summary is attached in the `!$context->aiAnalysis['success']` branch, consider setting `success: true` and `analysis_source: 'fallback'` to clearly communicate data availability.

---

### Issue 4: Cache lock leak on exception in checkCache()
**File:** `backend/app/Jobs/Pipeline/PdfExtractionPipeline.php:142-146`

If `Cache::get()` throws after the lock is acquired, the lock is held for the full 30-second TTL. Concurrent requests for the same PDF will block waiting for the lock, potentially causing cascading failures during Redis instability.

**Fix:** Wrap `Cache::get()` in try-catch and release lock in a `finally` block:
```php
try {
    $cached = Cache::get($cacheKey);
} finally {
    $lock->release();
}
```

---

### Issue 5: Docling retries (3x at 5s) may be insufficient
**File:** `backend/app/Services/DoclingService.php:22-23`

A rolling deploy or node failure that restarts all 5 docling replicas simultaneously will cause all 3 retries to fail before the service recovers. The job-level retry handles this, but user-perceived latency is increased.

**Fix:** Increase retry count to 5 and/or add exponential backoff (e.g., `retry(5, [1000, 5000, 15000, 30000])`).

---

### Issue 6: Amount regex nested quantifier backtracking risk
**File:** `backend/app/Services/BalanceExtractorService.php:49`

The pattern `/ -?\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-? /` uses nested quantifiers with alternation. While not catastrophic for typical single-line amounts, malformed input with long digit sequences and trailing punctuation could trigger pathological backtracking.

**Fix:** Use atomic grouping or possessive quantifiers to prevent backtracking, or simplify the pattern with separate cases for each format:
```php
'/(?-?\$(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?(?:-?|$))/'
```

---

### Issue 7: Payment processor MCA exclusion too strict
**File:** `backend/app/Services/McaDetectionService.php:259-263`

Payment processors (Stripe, Square, etc.) are hard-excluded unless they exactly match an entry in `mcaProductPatterns`. Variants like "STRIPE CAP", "SQ CAPITAL", "PAYPAL WC" would be incorrectly excluded. The list also only has 4 entries — many merchant financing products are not covered.

**Fix:** Use looser matching on the MCA product patterns list. Add a second-tier check: if a processor name is found and the transaction contains MCA indicators (advance, capital, funding, loan), re-consider it.

---

### Issue 10: No circuit breaker on AI service calls
**File:** `backend/app/Services/BaseAIService.php:77-90`

Every request that hits the AI service during an outage attempts the API call, fails, and falls back — adding ~120ms latency per request with no benefit. A circuit breaker that transitions to "degraded mode" after N consecutive failures (skipping API calls entirely for a cooldown period) would improve user experience during prolonged outages.

**Fix:** Add consecutive failure counter + threshold in `BaseAIService`. When threshold is exceeded, skip `callApi()` and immediately return fallback. Reset on success.

---

## LOW — Should Fix Eventually

### Issue 3: PiiDetectionStep overwrites piiBreakdown (order-dependent)
Pipeline order is fixed and logic is correct, but fragile if step order changes.

### Issue 8: Unanchored regex in field mapping
Patterns match anywhere in text — usually fine but could cause issues with duplicate labels.

### Issue 9: PipelineContext error property is mutable
Accidental `null` overwrite by any step would silently short-circuit pipeline.

### Issue 11: No timeout on Cache::put operations
Could block worker thread if Redis is slow.

---

## Architectural Insights

### 1. Fallback Cascade Pattern
`AiAnalysisStep` implements a two-tier fallback:
1. `OpenRouterService::analyzeDocument()` → `BaseAIService::analyzeDocument()` → `getFallbackAnalysis()`
2. If AI fails OR returns `credit_count === 0` → `McaAiService::extractTransactionSummary()`

This is a deliberate resilience pattern — the system degrades gracefully rather than failing hard. However, Issue #1 means `credit_count=0` is incorrectly treated as a failure trigger.

### 2. Stampede Protection
`PdfExtractionPipeline::checkCache()` uses `Cache::lock()` before `Cache::get()` — only one worker computes the result while others wait. However, the lock is only released in the happy path (Issue #4).

### 3. Hybrid MCA Detection
`McaAiService::detect()` combines pre-filtering (`McaDetectionService`) with AI review (`analyzeCandidates()`). Pre-filter sends borderline candidates to AI; high-confidence hits (≥0.7) skip AI entirely. This keeps AI costs low while maintaining accuracy on ambiguous cases.

### 4. Transaction Counting Fallback
`McaDetectionService::extractTransactionSummary()` is used as a fallback when AI is unavailable. It counts transactions by scanning markdown line-by-line, extracting amounts/dates/descriptions. This is a pure regex pattern-matcher with no understanding of table structure — could produce inaccurate counts from poorly formatted statements.

### 5. Stub Class Pattern
All services in `App\Services\Analysis\` and `App\Services\Extraction\` and `App\Services\Patterns\` are stubs that extend the root namespace originals. This is a Mockery compatibility shim — allows step classes to import from sub-namespaces while the actual implementation lives at the top level. If Mockery weren't needed, these stubs would be unnecessary.

### 6. No Transaction Atomicity
Pipeline steps execute sequentially without any rollback mechanism. If a step partially mutates `$context` and then fails, prior state is not recovered. This is acceptable given the context object is designed for aggregation, but worth noting for future reliability requirements.

---

## Statistics

| Category | Count |
|----------|-------|
| Files audited | 33 |
| Pipeline step classes | 7 |
| Core service classes | 12 |
| Field mapper utilities | 4 |
| Interfaces | 2 |
| Total issues found | 11 |
| HIGH severity | 0 |
| MEDIUM severity | 7 |
| LOW severity | 4 |