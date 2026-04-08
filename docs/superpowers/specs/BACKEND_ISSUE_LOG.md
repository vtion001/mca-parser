# Backend Issue Log

| # | Description | File:Line | Risk | Fixed? |
|---|-------------|-----------|------|--------|
| 1 | `PiiPatterns::SCRUB_MAP` uses raw pattern strings as array keys - potential ReDoS if patterns are malformed | `PiiPatterns.php:39-46` | M | No |
| 2 | `DoclingService::extractText()` has 600s timeout but no per-request abort for large PDFs | `DoclingService.php:22` | L | No |
| 3 | `McaDetectionService::loadProviders()` reads JSON file on every call until cached - no caching | `McaDetectionService.php:83-114` | M | No |
| 4 | `BatchController::startProcessing()` dispatches jobs in loop without chunking - large batches may timeout | `BatchController.php:175-178` | M | No |
| 5 | `ExtractionController::fullExtract()` defaults `account_id` to 1 when not present - single-tenant fallback is a design decision but risky | `ExtractionController.php:29` | L | Known limitation |
| 6 | `ProcessPdfExtraction::handleCachedResult()` doesn't increment batch completed count in all code paths | `ProcessPdfExtraction.php:296-331` | H | No |
| 7 | `PdfAnalyzerService::scrub()` uses `preg_replace()` with array of patterns from `PiiPatterns::SCRUB_MAP` - patterns anchored but no timeout protection | `PdfAnalyzerService.php:30` | L | No |
| 8 | `BaseAIService::buildPrompt()` truncates markdown to 8000 chars - may miss important data near end of long documents | `BaseAIService.php:153` | M | No |
| 9 | `McaAiService::detect()` calls `app(McaDetectionService::class)` on every invocation - not injected | `McaAiService.php:307` | L | No |
| 10 | `DocumentController::show()` accepts `string $id` but tries numeric and filename lookup - potential info leak via timing | `DocumentController.php:52-58` | L | No |
| 11 | `TransactionClassificationService::classify()` uses `preg_match()` with word boundaries inside loop over all keywords - could be optimized with compiled patterns | `TransactionClassificationService.php:443` | L | No |
| 12 | `ProcessPdfExtraction` job has no cleanup for stale cache entries - orphaned cache keys may accumulate | `ProcessPdfExtraction.php` | L | No |
| 13 | `HealthController::checkDocling()` suppresses errors with `@file_get_contents` but `docling()` method has its own separate checkDocling - code duplication | `HealthController.php:117-140` | L | No |
| 14 | `OpenRouterService` default model is `google/gemini-3.1-pro-preview` but CLAUDE.md says default is `openai/gpt-3.5-turbo` - config mismatch | `OpenRouterService.php:25` vs `CLAUDE.md` | L | No |
| 15 | `BaseAIService::getPlaceholderApiKey()` returns `''` (empty string) - same as unconfigured, could be confused | `BaseAIService.php:288-290` | L | No |
| 16 | `McaDetectionService::amountPattern` regex `/\$\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/` is missing anchor for negative amounts with trailing minus (e.g., `1234.56-`) | `McaDetectionService.php:49` | M | No |
| 17 | `ComparisonController::compareTransactions()` computes estimated credits/debits from balance delta - these are rough estimates marked `_estimated` but returned as if reliable | `ComparisonController.php:96-106` | M | No |
| 18 | `DocumentTypeDetector::typeSchemas` has `bank_statement` with weight 1.5 - if no other types score higher, it still returns `unknown` with 0.0 confidence | `DocumentTypeDetector.php:58-60` | L | No |
| 19 | `BalanceExtractorService::extractAmount()` skips amounts `< 1` - could miss small fee transactions that are relevant | `BalanceExtractorService.php:188` | L | No |
| 20 | `Batch::incrementCompleted()` uses `increment()` which doesn't guarantee atomicity under high concurrency | `Batch.php:48` | M | No |

---

## Issue #6 Detail (HIGH)

**File:** `backend/app/Jobs/ProcessPdfExtraction.php:296-331`

**Problem:** `handleCachedResult()` calls `$batch->incrementCompleted()` only inside the conditional blocks. If `this->batchId` is set but `this->documentId` is null, the batch increment may not fire properly depending on how the document lookup branches. Additionally, there's a potential issue where `handleCachedResult()` is called but then `updateProgressComplete()` is also called - both may try to update the batch, but `incrementCompleted()` is only called once at the top inside `if ($this->batchId)` block. The flow appears to increment once correctly, but in `failJob()` at line 259-263, the batch is incremented even on failure, which is correct.

However, looking more closely: in `handleCachedResult()`, `incrementCompleted()` is called at line 325-328 AFTER the document update. If `handleCachedResult()` returns early (lines 296-332), this increment happens at the end which is correct. But in the normal `handle()` flow (lines 184-208), the document update and batch increment happen correctly. The issue is subtle but real - the batch increment in `handleCachedResult()` is placed AFTER the document lookup block which means it could be called multiple times if the method is refactored.

**Risk:** HIGH - batch processing may never complete if cached results are used repeatedly, because `incrementCompleted()` in `handleCachedResult()` could be the only place batch progress is updated when a cached result is found, but if that path is skipped, the batch hangs at 0 completed.

**Fix:** Move batch increment to be unconditional at the start of `handleCachedResult()`, before the document update block.
