# Critical Paths

Multi-project deep-dive analysis of the highest-risk code paths in MCA PDF Scrubber.

---

## Path-2-PDF-Upload

> **Owner:** Backend / Queue Infrastructure
> **Risk Rating:** HIGH — data loss potential on Docling/Redis failure
> **Last Updated:** 2026-04-08

---

### 1. CALL_FLOW_TRACE

#### Entry Point: `POST /api/v1/pdf/full-extract`

**Controller:** `ExtractionController::fullExtract()` (`backend/app/Http/Controllers/ExtractionController.php:20-58`)

```
Request: POST /api/v1/pdf/full-extract (multipart/form-data, file)
  ├─ Validation: file required | mimes:pdf | max:51200 (50MB)
  ├─ Auth: X-Account-ID header (defaults to 1 if missing, per comment line 29)
  ├─ Storage: file saved → Storage::disk('local')->putFileAs('pdfs', $file, $uuid.'.pdf')
  ├─ Document::create() — STATUS_PENDING, account_id, filename, file_path
  ├─ Str::uuid() → jobId
  └─ ProcessPdfExtraction::dispatch(jobId, filePath, documentId) — QUEUED (async)

Response: { success: true, job_id: "<uuid>", document_id: <int>, status: "processing" }
```

**Critical architectural note:** Two pipeline paths exist. The `PdfExtractionPipeline` class (7-step pipeline with step interface) is **registered but never called** from any controller. The active path is `ProcessPdfExtraction` job directly. See Section 5.

---

#### Queued Job: `ProcessPdfExtraction::handle()` (`ProcessPdfExtraction.php:45-216`)
**Config:** `$tries=5`, `$backoff=60` (exponential: 60/120/240/480/960s), `$timeout=900`

```
job.handle()
  │
  ├─ [10%] checkCache() — stampede protection via Cache::lock (30s TTL)
  │           └─ Cache::get("pdf_cache_{contentHash}") — if hit:
  │               → handleCachedResult() — restores all fields from cache
  │               → updateProgressComplete(100%)
  │               → persistToDatabase()
  │               → Batch::incrementCompleted()
  │               → return (skips all extraction)
  │
  ├─ [10%] Document::markAsProcessing() — if documentId present
  │
  ├─ [10%] doclingService.extractText(filePath)
  │           ├─ HTTP POST to docling-lb:8001/extract
  │           ├─ timeout: 600s, retries: 3× at 5s intervals on 502
  │           ├─ Returns: { success, text, ocr_text?, page_count?, error? }
  │           └─ If !success → failJob(error) → return
  │
  ├─ [35%] typeDetector.detect(fullMarkdown) → { type, confidence }
  │
  ├─ [55%] fieldMapper.map(fullMarkdown, docType) → keyDetails[]
  │
  ├─ [75%] analyzer.checkPiiIndicators(fullMarkdown) → bool
  │           ├─ scorer.score(markdown, pageCount, piiPatterns) → scores, pii_breakdown, recommendations
  │           └─ piiDetected = hasPii ? array_keys(PiiPatterns::ALL) : []
  │
  ├─ [80%] balanceExtractor.extractBalances(fullMarkdown) → { beginning_balance, ending_balance }
  │
  ├─ [85%] openRouterService.analyzeDocument(...)
  │           ├─ If AI returns success:false OR transaction_summary null OR credit_count=0:
  │           └─ mcaAiService.extractTransactionSummary() → fallback attached
  │
  ├─ [92%] mcaAiService.detect(markdown, keyDetails, balances) → mcaFindings[]
  │
  ├─ [95%] txnClassifier.detect(fullMarkdown) → transactionClassification[]
  │
  ├─ [100%] updateProgressComplete(result)
  │
  ├─ Cache::put("extraction_result_{jobId}", result, 24h)
  ├─ storeInCache(contentHash, result) — PDF hash cache, 7-day TTL
  ├─ Document::markAsComplete(result) — if documentId
  └─ Batch::incrementCompleted() — if batchId
```

**Cache keys written:**
| Key | TTL | Purpose |
|-----|-----|---------|
| `extraction_progress_{jobId}` | 24h | Frontend polling — current status/stage |
| `extraction_result_{jobId}` | 24h | Frontend polling — final result payload |
| `pdf_cache_{md5_file}` | 7d | Content-hash cache for identical PDFs |

**Progress stages written:** extracting, cache_hit, detecting_type, mapping_fields, analyzing_quality, extracting_balances, ai_analysis, mca_detection, txn_classification, complete

---

#### Frontend Polling: `GET /api/v1/pdf/progress/{jobId}`

**Controller:** `ExtractionController::progress()` (`ExtractionController.php:60-72`)

```
Request: GET /api/v1/pdf/progress/{jobId}
  └─ Cache::get("extraction_progress_{jobId}")

Response (processing): { job_id, status: "processing", stage, stage_label, progress_percent }
Response (complete):   { job_id, status: "complete",   stage: "complete", stage_label: "Done", progress_percent: 100, result: {...} }
Response (not found):  HTTP 404 { success: false, error: "Job not found" }
Response (failed):     { job_id, status: "failed", stage: "failed", stage_label: "Failed", progress_percent: 0, error: "..." }
```

---

### 2. FAILURE_MODES

| Step | Failure Mode | Error Handling | Retry? | Data Loss Risk |
|------|-------------|----------------|--------|----------------|
| **File upload (50MB limit)** | File too large | Laravel validation → 422 | No | None (rejected pre-queue) |
| **File not PDF** | Invalid mime | Laravel validation → 422 | No | None |
| **Cache lock acquisition** | Redis timeout on `lock->get()` | Caught → proceeds without cache | N/A | Cache miss on identical PDF |
| **Docling 502 transient** | Worker crash mid-request | HTTP retry 3× at 5s intervals | Via job retry | None if retries succeed |
| **Docling 502 persistent** | All replicas down | Returns `{success: false, error}` | Job retry (5×) | None if eventually succeeds |
| **Docling timeout (600s)** | Very large PDF | `Http::timeout(600)` throws | Job retry (5×) | Same as above |
| **Step throws exception** | Any unhandled exception | Caught in job try/catch → `failJob()` | Job retry (5×) | Error stored in cache, doc marked failed |
| **Step sets `$context->error`** | DoclingExtractionStep only | Pipeline checks after loop → `failJob()` | Job retry (5×) | Error stored in cache, doc marked failed |
| **Redis unavailable (progress)** | Slow/unreachable | `Cache::put()` has no timeout → could block | N/A | Frontend gets stale progress |
| **Redis unavailable (result)** | Slow/unreachable | Caught, logged | N/A | DB still has result via `markAsComplete` |
| **DB `markAsComplete` throws** | DB failure mid-write | **Caught in outer catch → `failJob()` → NOT re-thrown** | **NO — job completes, NO Laravel retry** | **POTENTIAL SILENT DATA LOSS** |
| **AI service fails** | OpenRouter API error | `BaseAIService` catches → fallback response | No | No loss — fallback used |
| **No AI API key** | Missing `OPENROUTER_API_KEY` | Returns fallback immediately | N/A | Heuristic-only analysis |

**Key observations:**

1. **Docling is the hardest dependency** — 600s timeout + 3× retry in HTTP client, then job retry (5×). 5 sequential failures required for permanent loss.

2. **Two error reporting mechanisms** — exceptions caught in outer try/catch, and `$context->error` set by steps. Both route to `failJob()`.

3. **Redis failure is gracefully degraded** — all cache operations wrapped in try/catch. Pipeline proceeds without cache if Redis is down.

4. **AI failure is fully graceful** — `BaseAIService::analyzeDocument()` catches all exceptions, returns fallback. No job failure.

5. **Critical bug: DB exception swallowed** — Outer `catch (\Exception $e)` at line 212-215 calls `failJob()` but does NOT re-throw. Laravel queue considers job complete (acknowledged), **Laravel will NOT retry the job**. If `Document::markAsComplete()` threw because of a DB connection issue, the data is lost.

6. **Batch fails forward** — `failJob()` calls `Batch::incrementCompleted()`, so failed documents count toward batch completion. Batches finish even with failures.

---

### 3. TESTING_REQUIREMENTS

#### Unit Tests

**ProcessPdfExtractionTest**
- `testDispatchesJobWithCorrectParameters` — jobId, filePath, documentId propagation
- `testDispatchesWithBatchIdWhenProvided` — batchId propagation
- `testReturnsJobIdAndDocumentId` — response shape validation
- `testValidatesFileRequired` — 422 on missing file
- `testValidatesMimeType` — 422 on non-PDF
- `testValidatesMaxSize` — 422 on file > 50MB

**ProcessPdfExtractionJobTest** (Feature)
- `testSuccessfulExtractionFlow` — full happy path, mocked DoclingService
- `testCacheHitSkipsAllExtraction` — identical PDF → cache hit → return early
- `testDoclingFailureMarksJobFailed` — Docling returns success:false → failJob called
- `testDoclingTimeoutTriggersRetry` — Http timeout → job retried by queue
- `testStepExceptionTriggersFailJob` — exception in any step caught → failJob
- `testStepSetsErrorTriggersFailJob` — $context->error set → failJob called
- `testProgressUpdatedAtEachStep` — verify all 10 progress stages written
- `testResultStoredInCache` — extraction_result_{jobId} has correct data
- `testDocumentMarkedComplete` — markAsComplete called with correct fields
- `testBatchProgressIncremented` — incrementCompleted called
- `testFallbackTriggeredWhenAiReturnsZeroCredits` — Issue #1: credit_count=0 triggers fallback
- `testFallbackTriggeredWhenAiCompletelyFails` — Issue #2: success:false with partial data
- `testDocumentMarkAsCompleteThrowsDoesNotRetry` — **Critical bug test**: DB exception caught, failJob called, exception NOT re-thrown, job completes as acknowledged

**DoclingServiceTest**
- `testRetriesOn502` — verify 3 retries on 502
- `testReturnsErrorAfterAllRetriesFail` — final failure after 3 retries
- `testTimeoutIs600Seconds` — verify timeout config
- `testExtractsTextSuccessfully` — response parsing
- `testExtractsOcrTextWhenPresent` — OCR text appended to markdown
- `testHandlesMalformedJsonResponse` — returns success:false with error

**AiAnalysisStepTest**
- `testFallbackNotTriggeredWhenAiSucceedsWithPositiveCredits` — credit_count > 0
- `testFallbackTriggeredWhenCreditCountIsZero` — **Issue #1**: credit_count=0 should trigger fallback (currently broken)
- `testFallbackTriggeredWhenCreditCountIsNull` — null should trigger fallback
- `testFallbackTriggeredWhenAiCompletelyFailed` — **Issue #2**: partial failure handling
- `testFallbackDataAttachedToSuccessfulAiResponse` — fallback_transaction_summary flag set

**PdfExtractionPipelineTest** (currently unused but needs tests)
- `testPipelineExecutesAll7Steps` — verify step order
- `testErrorStopsPipelineEarly` — $context->error breaks loop
- `testCacheHitReturnsCachedResult` — stampede protection works
- `testLockReleasedOnExceptionInCacheCheck` — **Issue #4 fix verification**

#### Mock Fixtures Needed

| Mock | What to simulate |
|------|-----------------|
| `DoclingService` | success, 502×3, 502 then success, timeout, empty text |
| `OpenRouterService` | success, API error, timeout, malformed JSON |
| `Cache` facade | lock.acquire fails, put fails, get returns null |
| `Document` model | find returns null, markAsProcessing throws, markAsComplete throws |
| `Batch` model | find returns null, incrementCompleted throws |
| `ExtractorScorer` | scores, pii_breakdown, recommendations |

#### Test Data Fixtures

| Fixture | Purpose |
|---------|---------|
| Small valid PDF (<1MB) | Standard bank statement happy path |
| Large PDF (45MB) | Near 50MB limit, timeout stress test |
| PDF with images (OCR) | Triggers ocr_text path |
| Multi-page PDF (100+ pages) | pageCount verification |
| Corrupt PDF | Docling returns error |
| Empty PDF | Zero text extracted |
| PDF with zero-credits | Tests Issue #1 (credit_count=0 fallback) |

#### Edge Cases

1. **File removed between upload and job** — `md5_file()` throws RuntimeException, job fails
2. **Duplicate upload same PDF** — cache hit, no re-extraction
3. **AI API returns malformed JSON** — BaseAIService catches, returns fallback
4. **Batch deleted before job completes** — `Batch::find()` returns null, `?->` null-safe
5. **Document deleted before job completes** — `Document::find()` returns null, all `?->` null-safe
6. **Redis goes down mid-extraction** — progress updates fail silently, final DB result intact
7. **Queue worker killed mid-extraction** — job not acknowledged, Laravel retries automatically

---

### 4. HIGH_RISK_ISSUES

From `PIPELINE_ISSUE_LOG.md` — issues affecting this path, sorted by severity:

#### CRITICAL BUG: Exception swallowing causes silent data loss (ProcessPdfExtraction.php:212-215)

```php
} catch (\Exception $e) {
    Log::error('ProcessPdfExtraction failed: ' . $e->getMessage());
    $this->failJob($e->getMessage());
}
```

When `Document::markAsComplete()` or `Batch::incrementCompleted()` throws (line 184-208), the exception is caught, `failJob()` is called, but **the exception is NOT re-thrown**. Laravel's queue worker considers the job complete (acknowledged), so it will **NOT retry**. The job is lost — no user notification, no automatic recovery.

**Severity:** HIGH — silent data loss
**File:** `backend/app/Jobs/ProcessPdfExtraction.php:212-215`
**Fix:** Add `throw $e;` after `failJob()` or restructure to only catch expected failures

---

#### MEDIUM #4: Lock not released if Cache::get() throws (PdfExtractionPipeline.php:142-146)

```php
$lock = Cache::lock("lock_{$cacheKey}", 30);
if ($lock->get()) {
    $cached = Cache::get($cacheKey);  // ← if throws, lock holds for 30s
    $lock->release();
    return $cached;
}
```

Same pattern exists in `ProcessPdfExtraction.php:64-75`. Transient Redis failures cause lock contention for 30s. Concurrent identical PDFs fail or block.

**Severity:** MEDIUM
**File:** `backend/app/Jobs/Pipeline/PdfExtractionPipeline.php:142-146` (also `ProcessPdfExtraction.php:64-75`)
**Fix:** Wrap in try/finally to guarantee lock release

---

#### MEDIUM #5: Docling retries may be insufficient for cluster restart

```php
Http::timeout(600)->retry(3, 5000)->attach(...)
```

3 retries at 5s intervals = 15s total. If all 5 Docling replicas restart simultaneously (rolling deploy, node failure), all 3 attempts could fail. Job retry then takes over (up to 5×). Worst-case user latency: 75s.

**Severity:** MEDIUM
**File:** `backend/app/Services/DoclingService.php:22-23`
**Fix:** Increase retry count or add circuit breaker

---

#### MEDIUM #1: Fallback triggers on credit_count=0 (AiAnalysisStep.php:32-34)

```php
$needsFallback = !$context->aiAnalysis['success']
    || $txnSummary === null
    || ($txnSummary['credit_count'] === null || $txnSummary['credit_count'] === 0);
```

`credit_count=0` is a **valid result** (statement with only debits). The fallback overwrites AI results with computed values that could differ from what AI actually found. Affects `ProcessPdfExtraction` path at 85% step.

**Severity:** MEDIUM
**File:** `backend/app/Jobs/Pipeline/Steps/AiAnalysisStep.php:32-34`
**Fix:** Change `|| $txnSummary['credit_count'] === 0` to only trigger on `null`

---

#### MEDIUM #2: Fallback overwrites success=false with partial data (AiAnalysisStep.php:37-44)

When AI completely fails (`success: false`) but fallback succeeds, `transaction_summary` is attached to `aiAnalysis['analysis']` but `success` remains `false`. Callers cannot distinguish "failed with fallback" from "failed with no data".

**Severity:** MEDIUM
**File:** `backend/app/Jobs/Pipeline/Steps/AiAnalysisStep.php:37-44`
**Fix:** Set `aiAnalysis['success'] = true` when fallback provides data, add `fallback_used: true` flag

---

#### MEDIUM #6: Amount regex nested quantifiers (BalanceExtractorService.php:49)

```php
private string $amountPattern = '/-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-?/';
```

Nested quantifiers with optional components. Applied per-line, so exposure is limited, but malformed input (very long digit strings) could cause ReDoS.

**Severity:** MEDIUM (ReDoS)
**File:** `backend/app/Services/BalanceExtractorService.php:49`
**Fix:** Simplify pattern to avoid nested quantifiers

---

#### MEDIUM #10: No circuit breaker on AI service calls (BaseAIService.php)

Every request attempts AI API call, fails, then falls back. During prolonged AI API outage, every request adds unnecessary latency.

**Severity:** MEDIUM
**File:** `backend/app/Services/BaseAIService.php:77-90`
**Fix:** Add consecutive failure counter; after N failures, skip API and go straight to fallback

---

#### LOW #11: No timeout on Cache::put operations (PdfExtractionPipeline.php:246-268)

Progress updates (every step) call `Cache::put()` with no timeout. Slow Redis blocks worker thread.

**Severity:** LOW
**File:** `backend/app/Jobs/Pipeline/PdfExtractionPipeline.php:246-268`
**Fix:** Use non-blocking cache write or set timeout on Redis connection

---

### 5. ARCHITECTURAL CONCERN

**Two parallel pipeline implementations exist:**

1. **`ProcessPdfExtraction`** (job, 9 steps linear, **active**) — `backend/app/Jobs/ProcessPdfExtraction.php`
2. **`PdfExtractionPipeline`** (class, 7 steps + post-processing, **dead code**) — `backend/app/Jobs/Pipeline/PdfExtractionPipeline.php`

`PdfExtractionPipeline` has better architecture (step interface, error context object, clearer step separation) but is never instantiated from a controller or job. This creates confusion and maintenance burden.

**Recommendation:** Either wire `PdfExtractionPipeline` into `ProcessPdfExtraction` as the executor, or remove it entirely.

---

### 6. REDIS DEPENDENCY MATRIX

| Operation | Key | TTL | Fails gracefully? |
|-----------|-----|-----|-------------------|
| Progress polling read | `extraction_progress_{jobId}` | 24h | Returns null → 404 |
| Result retrieval | `extraction_result_{jobId}` | 24h | Returns null (DB has data) |
| PDF content cache | `pdf_cache_{md5}` | 7d | Returns null → re-extracts |
| Stampede lock | `lock_{cacheKey}` | 30s | proceeds without lock |
| Progress write | `extraction_progress_{jobId}` | 24h | **NO** — could block worker |
| Result write | `extraction_result_{jobId}` | 24h | **NO** — could block worker |

**Mitigation:** `Document::markAsComplete()` persists to PostgreSQL (Supabase). Final results survive Redis failure. Progress can be lost.

---

### 7. TEST COVERAGE GAPS

| Scenario | Covered? | Notes |
|----------|---------|-------|
| Happy path | Likely | Feature tests |
| Docling persistent failure | Likely | Unit tests |
| Docling timeout | Likely | Unit tests |
| AI fallback (credit_count=0) | **NO** | Issue #1 |
| AI fallback (complete failure) | **NO** | Issue #2 |
| Redis lock contention | **NO** | Issue #4 |
| Document::markAsComplete throws | **NO** | Exception swallowing |
| Batch::incrementCompleted throws | **NO** | Exception swallowing |
| File missing at job execution | **NO** | md5_file() throws |
| Cache miss then concurrent write | **NO** | Race condition |
| Job timeout (900s) behavior | **NO** | |
| All 5 job tries exhausted | **NO** | |

---

## Path-1-Auth

### 1. CALL_FLOW_TRACE

```
Browser                          Laravel                          DB
   │                                  │                              │
   │ 1. POST /api/v1/auth/login       │                              │
   │    {email, password}             │                              │
   │ ─────────────────────────────────►                              │
   │                                  │                              │
   │                    2. AuthController::login()                    │
   │                       - validate: email, password                │
   │                       - User::where(email) → user               │
   │                       - Hash::check(password, user.password)    │
   │                       - $user->regenerateToken()                │
   │                                  │                              │
   │                                  │ UPDATE users SET api_token=  │
   │                                  │   bin2hex(random_bytes(32))  │
   │                                  │ ────────────────────────────►│
   │                                  │                              │
   │ 3. {success, data: {user, token}}│                              │
   │ ◄─────────────────────────────────                              │
   │                                  │                              │
   │ 4. axios interceptor:             │                              │
   │    localStorage['api_token'] = token                            │
   │    localStorage['account_id'] = account_id                      │
   │    localStorage['user'] = JSON(user)                           │
   ▼
=== Subsequent requests ===
   │                                  │                              │
   │ 5. axios interceptor:             │                              │
   │    Authorization: Bearer <token>  │                              │
   │    X-Account-ID: <account_id>   │                              │
   │ ─────────────────────────────────►                              │
   │                                  │                              │
   │                    6. AuthMiddleware::handle()                   │
   │                       - bearerToken() → token                   │
   │                       - if !token → 401                         │
   │                       - User::where(api_token, token) → user    │
   │                       - if !user → 401                          │
   │                       - $request->setUserResolver(fn→user)      │
   │                                  │ SELECT * FROM users WHERE     │
   │                                  │   api_token = ?              │
   │                                  │ ────────────────────────────►│
   │                                  │                              │
   │                    7. AccountMiddleware::handle()              │
   │                       - $request->header(X-Account-ID)           │
   │                         ?? $request->query(account_id)          │
   │                       - if absent/invalid: use $user->account_id│
   │                       - if mismatched: 403                       │
   │                       - Account::where(id, accountId)           │
   │                         .where(is_active, 't') → account        │
   │                       - if !account: 403                         │
   │                                  │ SELECT * FROM accounts WHERE  │
   │                                  │   id=? AND is_active='t'     │
   │                                  │ ────────────────────────────►│
   │                                  │                              │
   │                    8. Controller action                          │
   │    (with $request->user,                                      │
   │     $request->account_id)          │                              │
   │ ◄─────────────────────────────────                              │
   ▼
=== Logout ===
   │  POST /api/v1/auth/logout        │                              │
   │ ─────────────────────────────────►                              │
   │                    9. AuthController::logout()                  │
   │                       - $user->clearToken()                     │
   │                                  │ UPDATE users SET api_token=   │
   │                                  │   NULL WHERE id=?           │
   │                                  │ ────────────────────────────►│
   │ 10. {success}                    │                              │
   │ 11. localStorage.clear()         │                              │
   │ ◄─────────────────────────────────                              │
```

**Middleware stack (api.php):**
```
Route::middleware('auth.api')->group(function () {     // AuthMiddleware (outer)
    Route::middleware('account')->group(function () {  // AccountMiddleware (inner)
        Route::post('/pdf/upload', ...)
    });
});
```
Logout and me endpoints use only `auth.api` — no `account` middleware.

### 2. FAILURE_MODES

| Step | Failure | HTTP | Handling |
|------|---------|------|----------|
| Login: validation | Missing/invalid email or password | 422 | Laravel auto-validates |
| Login: user lookup | Email not found | 401 | Returns "Invalid credentials." |
| Login: password check | Wrong password | 401 | Hash::check fails → "Invalid credentials." |
| Login: token write | DB write failure in regenerateToken() | 500 | Not explicitly caught |
| AuthMiddleware: no token | Missing Authorization header | 401 | Returns "Unauthenticated." |
| AuthMiddleware: bad token | Token not in DB | 401 | Returns "Unauthenticated." |
| AuthMiddleware: ensureEmulatedPrepares | PDO exception | 500 | Partial — empty catch, query proceeds |
| AccountMiddleware: cross-account | X-Account-ID !== user.account_id | 403 | "Invalid account access." + warning log |
| AccountMiddleware: inactive account | Account is_active != 't' | 403 | "Invalid account access." |
| AccountMiddleware: no header | Header omitted | 200 | Allowed — uses user's own account_id |
| Logout: no user | Not authenticated | 200 | No-op logout (graceful) |

**Key gaps:**
- No rate limiting on login/register endpoints — brute force unthrottled.
- `ensureEmulatedPrepares()` silently swallows all PDO exceptions — DB failures obscured as 401.
- Token never expires — `bin2hex(random_bytes(32))` stored in `api_token` has no TTL column.

### 3. TESTING_REQUIREMENTS

**Backend test cases (PHPUnit):**

`AuthControllerTest`:
- login with valid credentials → 200, token returned, old token revoked
- login with unknown email → 401
- login with wrong password → 401
- login validation missing email → 422
- register with duplicate email → 422
- register with invalid account_id → 422
- logout clears api_token to NULL in DB
- me endpoint returns user without password or token

`AuthMiddlewareTest`:
- missing Authorization header → 401
- invalid token not in DB → 401
- valid token → user attached to request, passes through
- ensureEmulatedPrepares PDO exception → continues without crash
- user resolver returns correct User model

`AccountMiddlewareTest`:
- no X-Account-ID header → user's own account_id used
- X-Account-ID matches user.account_id → 200
- X-Account-ID !== user.account_id → 403 + warning log entry
- X-Account-ID references inactive account → 403
- query-string ?account_id= also accepted as fallback

**Frontend test cases (Playwright/Vitest):**
- valid login → token + account_id stored in localStorage, redirect
- invalid login → error shown, no localStorage update
- 401 response → localStorage cleared, redirect to /
- concurrent logins → both tokens valid simultaneously (no token rotation on login)

**What to mock:**
- `User::where('api_token', $token)->first()` — return user or null
- `Account::where('id', $accountId)->where('is_active', 't')->first()` — return active/inactive/null
- `Hash::check()` — return true or false
- `Log::warning()` — verify cross-account attempts are logged

### 4. HIGH_RISK_ISSUES

From Phase 1 audit and deep-dive:

**#16 (MEDIUM) — localStorage user session has no expiry or token refresh**
- File: `frontend/src/pages/LoginPage.tsx:29`
- `api_token` stored in localStorage with no TTL, no refresh, no tampering detection
- Token is `bin2hex(random_bytes(32))` — static 64-char hex with no expiry column in DB
- If compromised, attacker has indefinite access. No "logout all devices" mechanism.
- Fix: Add `token_expires_at` column + refresh endpoint, or migrate to httpOnly cookie auth

**No brute-force protection on auth endpoints (HIGH)**
- `/auth/login` and `/auth/register` accept unlimited attempts
- No progressive delay, CAPTCHA, or account lockout
- Fix: add Laravel `throttle` middleware to auth routes

**Token in localStorage (XSS exposure) (HIGH)**
- `api_token` accessible to JavaScript — any XSS payload reads it immediately
- httpOnly cookie would prevent JavaScript access
- Fix: use httpOnly SameSite=Strict cookie instead of localStorage

**ensureEmulatedPrepares swallows exceptions silently (MEDIUM)**
- File: `AuthMiddleware.php:60-62`
- PDO connection failures caught with empty catch — middleware proceeds to fail later with confusing 401
- Fix: log the exception or return 503 when DB is unreachable

**No token rotation on login (MEDIUM)**
- `regenerateToken()` creates new token, but the old token remains valid until the next login
- Concurrent sessions all remain valid indefinitely
- Fix: invalidate all prior tokens on login (or implement token families)

**#5 (LOW) — ExtractionController defaults account_id=1 when header absent**
- File: `backend/app/Http/Controllers/ExtractionController.php:29`
- Single-tenant fallback bypasses AccountMiddleware account isolation
- Risk: valid token belonging to account B could silently process under account 1
- Fix: require X-Account-ID header or reject with 400

---

*Phase 2 Critical Path Analysis | Generated: 2026-04-08*
