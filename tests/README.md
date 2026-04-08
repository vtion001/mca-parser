# MCA PDF Scrubber - Test Suite

## Overview

This project uses a three-layer testing strategy:

| Layer | Framework | Scope | Command |
|-------|-----------|-------|---------|
| Backend (PHP) | PHPUnit | Unit + Feature | `php artisan test` |
| Frontend Unit (JS/TS) | Vitest | Unit | `npx vitest run` |
| Frontend E2E | Playwright | Integration | `npx playwright test` |

---

## Backend Tests (PHPUnit)

**Location:** `backend/tests/`

### Test Files

| File | Type | What It Tests |
|------|------|--------------|
| `Unit/ProcessPdfExtractionTest.php` | Unit | Job configuration (tries=5, backoff=60s, timeout=900s), cache key format |
| `Unit/DoclingServiceTest.php` | Unit | HTTP timeout (600s), retry config (3x at 5s), response shape |
| `Unit/ExtractionControllerTest.php` | Unit | Response shape contracts, progress cache key format |
| `Unit/OpenRouterServiceTest.php` | Unit | AI service fallback behavior, prompt truncation, PII detection |
| `Unit/BalanceExtractorServiceTest.php` | Unit | Balance extraction patterns |
| `Unit/DocumentTypeDetectorTest.php` | Unit | Document type classification |
| `Unit/FieldMapperTest.php` | Unit | Field mapping logic |
| `Unit/ExtractionScorerTest.php` | Unit | Quality scoring |
| `Jobs/Pipeline/PipelineContextTest.php` | Unit | Context defaults, `toResultArray()` output shape |
| `Jobs/Pipeline/AiAnalysisStepTest.php` | Unit | AI fallback triggers, credit_count=0 handling |
| `Jobs/Pipeline/PdfExtractionPipelineTest.php` | Unit | Step registration order, error propagation, `TestablePipeline` |
| `Jobs/Pipeline/DoclingExtractionStepTest.php` | Unit | Docling step behavior |
| `Jobs/Pipeline/PipelineStepInterfaceTest.php` | Unit | Interface compliance |

### How to Run

```bash
cd backend

# All tests
php artisan test

# Specific test class
php artisan test --filter=ProcessPdfExtractionTest

# Specific test method
php artisan test --filter=test_job_tries_is_5

# With coverage (requires pcov)
php artisan test --coverage
```

### Environment Requirements

- PHP 8.2+
- Composer dependencies installed (`composer install`)
- `.env` configured (tests use mocking, not a real DB connection for unit tests)
- **No external services required** for unit tests (all external deps are mocked)

### Known Test Limitations

1. **No Feature tests for full extraction flow** — `ProcessPdfExtractionTest` only tests job configuration, not the full handle() flow. Full flow tests would require DoclingService mocking and are marked as TODO.

2. **AiAnalysisStepTest tests the buggy behavior** — `test_triggers_fallback_when_credit_count_is_zero()` documents that the fallback triggers on credit_count=0 (a valid result), which is the known bug documented in the issue log.

3. **No tests for ProcessPdfExtraction::handleCachedResult() batch increment bug** — The B-1 high-priority bug (batch increment not called in all paths) has no dedicated test.

4. **No tests for exception swallowing in ProcessPdfExtraction** — The critical bug where `Document::markAsComplete()` throwing does NOT trigger a Laravel retry has no test coverage.

5. **No tests for dead PdfExtractionPipeline path** — The `PdfExtractionPipeline` class (7-step) is never wired into a controller. Its tests use a `TestablePipeline` that replicates but doesn't exercise the actual dead code path.

---

## Frontend Unit Tests (Vitest)

**Location:** `frontend/tests/Unit/`

### Test Files

| File | What It Tests |
|------|--------------|
| `statistics.test.ts` | Statistical calculations |
| `export.test.ts` | CSV export formatting |
| `converters.test.ts` | Data conversion utilities |

### How to Run

```bash
cd frontend

# All unit tests
npx vitest run

# Watch mode (dev)
npx vitest

# Specific file
npx vitest run tests/Unit/export.test.ts
```

### Environment Requirements

- Node.js (as per frontend development)
- `npm install` run in frontend directory
- **No external services required**

---

## Frontend E2E Tests (Playwright)

**Location:** `frontend/tests/e2e/`

### Test Files

| File | What It Tests |
|------|--------------|
| `auth.spec.ts` | Login flow, token storage, 401 handling |
| `upload.spec.ts` | PDF upload, extraction progress, completion |

### How to Run

```bash
cd frontend

# Install browsers (first time only)
npx playwright install

# Run E2E tests
npx playwright test

# Run with UI (interactive)
npx playwright test --ui

# Run specific test
npx playwright test tests/e2e/auth.spec.ts

# Run with headed browser (visible)
npx playwright test --headed
```

### Environment Requirements

- Node.js + npm
- Playwright browsers installed (`npx playwright install`)
- **The full Docker stack must be running** (`docker-compose up --build`) because E2E tests hit the live nginx reverse proxy on port 8000
- Or individual services: Laravel API on :8000, frontend on :5173 (dev mode)

### Test Data Fixtures

| Fixture | Location | Purpose |
|---------|----------|---------|
| Sample PDF | `frontend/tests/fixtures/sample.pdf` | Standard happy path upload |
| Large PDF | `frontend/tests/fixtures/large.pdf` | Size limit testing |
| Multi-page PDF | `frontend/tests/fixtures/multipage.pdf` | Page count verification |

---

## Test Data Fixture Locations

| Fixture | Backend Path | Frontend Path |
|---------|-------------|---------------|
| Small valid PDF | `backend/tests/fixtures/small.pdf` | `frontend/tests/fixtures/sample.pdf` |
| Large PDF (45MB) | `backend/tests/fixtures/large.pdf` | `frontend/tests/fixtures/large.pdf` |
| Multi-page PDF | `backend/tests/fixtures/multipage.pdf` | `frontend/tests/fixtures/multipage.pdf` |
| MCA provider JSON | `backend/data/mcas.json` | N/A |

**Note:** `backend/data/mcas.json` is required for MCA detection tests but currently does not exist. MCA detection will return empty results until this file is created.

---

## Coverage Gaps (Priority Order)

| Gap | Risk | Affected Test |
|-----|------|--------------|
| ProcessPdfExtraction handle() full flow | HIGH | Missing feature test |
| Exception swallowing (DB failure in handle()) | HIGH | No test |
| Batch increment on cached result | HIGH | No test |
| AiAnalysisStep credit_count=0 bug | MEDIUM | Documents buggy behavior |
| Cache lock leak on exception | MEDIUM | No test |
| Redis unavailability during extraction | MEDIUM | No test |
| AI circuit breaker missing | MEDIUM | No test |
| Frontend PII scrub before CSV export | MEDIUM | No test |

---

## CI Integration

In GitHub Actions (see `.github/workflows/`), the test commands map to:

```yaml
# Backend
- run: cd backend && php artisan test

# Frontend unit
- run: cd frontend && npx vitest run

# Frontend E2E (requires Docker)
- run: cd frontend && npx playwright test
```
