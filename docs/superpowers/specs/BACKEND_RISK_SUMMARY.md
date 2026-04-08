# Backend Risk Summary

## HIGH Risk (Must Fix Immediately)

| Issue | Description | File |
|-------|-------------|------|
| #6 | `handleCachedResult()` - batch increment may be skipped or called multiple times in edge cases, causing batch processing to hang at partial completion | `ProcessPdfExtraction.php:296-331` |

---

## MEDIUM Risk (Fix Next Sprint)

| Issue | Description | File |
|-------|-------------|------|
| #3 | `McaDetectionService::loadProviders()` reads JSON from disk on every call with no caching beyond in-memory | `McaDetectionService.php:83-114` |
| #4 | `BatchController::startProcessing()` dispatches jobs in loop without chunking - large batches may cause worker timeout | `BatchController.php:175-178` |
| #8 | `BaseAIService::buildPrompt()` truncates markdown to 8000 chars - may miss important data in long documents | `BaseAIService.php:153` |
| #16 | `McaDetectionService::amountPattern` regex doesn't handle trailing minus for negative amounts (e.g., `1234.56-`) | `McaDetectionService.php:49` |
| #17 | `ComparisonController::compareTransactions()` returns rough estimates as if reliable (marked `_estimated`) | `ComparisonController.php:96-106` |
| #20 | `Batch::incrementCompleted()` not atomic under high concurrency | `Batch.php:48` |
| #1 | `PiiPatterns::SCRUB_MAP` uses raw pattern strings as array keys - potential ReDoS if patterns are malformed | `PiiPatterns.php:39-46` |

---

## LOW Risk (Should Fix Eventually)

| Issue | Description | File |
|-------|-------------|------|
| #2 | `DoclingService::extractText()` has 600s timeout but no per-request abort for large PDFs | `DoclingService.php:22` |
| #5 | `ExtractionController::fullExtract()` defaults `account_id` to 1 when not present | `ExtractionController.php:29` |
| #7 | `PdfAnalyzerService::scrub()` uses `preg_replace()` with array - no timeout protection | `PdfAnalyzerService.php:30` |
| #9 | `McaAiService::detect()` uses `app()` instead of DI | `McaAiService.php:307` |
| #10 | `DocumentController::show()` timing difference between numeric/filename lookup | `DocumentController.php:52-58` |
| #11 | `TransactionClassificationService::classify()` could use pre-compiled patterns | `TransactionClassificationService.php:443` |
| #12 | `ProcessPdfExtraction` - no cleanup for stale cache entries | `ProcessPdfExtraction.php` |
| #13 | `HealthController::checkDocling()` code duplication between `ready()` and `docling()` | `HealthController.php` |
| #14 | `OpenRouterService` default model mismatch between code (`gemini`) and docs (`gpt-3.5`) | `OpenRouterService.php:25` |
| #15 | `BaseAIService::getPlaceholderApiKey()` returns empty string - confusing | `BaseAIService.php:288-290` |
| #18 | `DocumentTypeDetector` returns `unknown` with 0.0 confidence even when bank_statement is detected | `DocumentTypeDetector.php:58-60` |
| #19 | `BalanceExtractorService::extractAmount()` skips amounts < 1 - may miss small fee transactions | `BalanceExtractorService.php:188` |

---

## Architectural Insights

### 1. Deep Service Chain in ProcessPdfExtraction
The `ProcessPdfExtraction` job orchestrates **9 services** in a linear pipeline. Each service is called sequentially, making the job slow (total ~85% progress before AI analysis). If any service fails, the entire job fails.

### 2. AI as a First-Class Citizen
AI services (`OpenRouterService`, `McaAiService`) are central to the pipeline, not optional polish. `BaseAIService` provides graceful fallback when AI is unavailable, which is good resilience design.

### 3. Cache Stampede Protection
`ProcessPdfExtraction` uses `Cache::lock()` for stampede protection on the content-hash cache. This is properly implemented with fallback when lock acquisition fails.

### 4. Dual Data Persistence
Results are stored both in **Redis Cache** (for frontend polling) and **Supabase PostgreSQL** (for persistence). This dual-write could lead to divergence if one write succeeds and the other fails.

### 5. Job Retry with Backoff
`ProcessPdfExtraction` has `$tries = 5` and `$backoff = 60` (exponential: 60, 120, 240...). This is good resilience for transient failures.

### 6. MCA Detection is Hybrid
The MCA detection architecture combines:
- Rule-based pre-filter (`McaDetectionService`) with keyword scoring and provider matching
- Fuzzy abbreviation matching with equivalence groups
- AI review of borderline candidates (`McaAiService::analyzeCandidates()`)

This is a sophisticated multi-stage approach.

### 7. Multi-Tenancy via Middleware
Account isolation is handled by `AccountMiddleware` (reads `X-Account-ID` header). The `forAccount()` scope on models enforces the join. This is clean but depends on the middleware being properly configured.

### 8. Synchronous vs Async Split
- **Sync:** `PdfController::upload/analyze/scrub` - direct Docling calls, returns text immediately
- **Async:** `ExtractionController::fullExtract` - dispatches job, returns job_id for polling

This split is intentional and sensible for UX.
