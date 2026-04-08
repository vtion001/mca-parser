# MCA PDF Scrubber — Unified Audit Inventory

**Generated:** 2026-04-08
**Phase 1 of 5 — Test Automation Plan**

---

## Summary

| Layer | Files | HIGH | MEDIUM | LOW |
|-------|-------|------|--------|-----|
| Frontend | 29 | 3 | 8 | 10 |
| Backend | 28 | 1 | 6 | 13 |
| Pipeline/Services | 33 | 0 | 7 | 4 |
| **Total** | **90** | **4** | **21** | **27** |

---

## Combined HIGH Risk Issues

### F-1: Duplicate balance analysis functions
**Layer:** Frontend | **File:** `balanceAnalysis.ts` ↔ `csvExport.ts`
Both files define identical 6 balance/cash-flow functions. Fix: consolidate into one module.

### F-2: PII may leak into exported CSV
**Layer:** Frontend | **File:** `export/formatters/*.ts`
Raw transaction descriptions exported without PII scrubbing. Fix: run PiiDetection before CSV generation.

### F-3: ThemeProvider imported from non-existent file
**Layer:** Frontend | **File:** `hooks/useTheme` (missing)
Component imports `ThemeProvider` from a path that doesn't exist. Fix: remove or create the missing hook.

### B-1: handleCachedResult() batch increment bug
**Layer:** Backend | **File:** `ProcessPdfExtraction.php`
Cached results still call `batch->incrementCompleted()`, which can cause batch processing to hang when combined with the cache-first short-circuit. Fix: guard with `$context->cached ? null : $batch->incrementCompleted()`.

---

## Combined MEDIUM Risk Issues

| # | Layer | Description | File |
|---|-------|-------------|------|
| M1 | Pipeline | AiAnalysisStep credit_count=0 logic inversion — triggers fallback on valid zero | AiAnalysisStep.php |
| M2 | Pipeline | Ambiguous success state when AI fails but fallback runs | AiAnalysisStep.php |
| M3 | Backend | Provider JSON caching issue | ProcessPdfExtraction.php |
| M4 | Backend | Unbounded job loop potential | ProcessPdfExtraction.php |
| M5 | Backend | 8k truncation of extracted text | OpenRouterService.php |
| M6 | Backend | amountPattern regex may have nested quantifier backtracking risk | TransactionClassificationService.php |
| M7 | Backend | Estimated credits calculation | OpenRouterService.php |
| M8 | Backend | Non-atomic batch increment | ProcessPdfExtraction.php |
| M9 | Pipeline | Cache lock leak on exception path | PdfExtractionPipeline.php |
| M10 | Pipeline | Docling retries insufficient for cluster restarts | DoclingService.php |
| M11 | Pipeline | Payment processor MCA exclusion too strict | McaDetectionService.php |
| M12 | Pipeline | No AI service circuit breaker | BaseAIService.php |
| M13 | Frontend | Two competing export dispatchers (export/index.ts vs csvExport.ts) | export/*.ts |
| M14 | Frontend | Barrel re-exports obscure actual parsing chain | utils/*.ts |

---

## Files by Layer

### Frontend (29 files)

| Category | Count | Files |
|----------|-------|-------|
| Pages | 2 | DashboardPage.tsx, LoginPage.tsx |
| Analysis Components | 3 | AnalysisOverview.tsx, AnalysisDetailed.tsx, McaFindings.tsx |
| Hooks | 4 | useExtraction*.ts |
| Contexts | 1 | ExtractionContext.tsx |
| Utils | 15 | balanceAnalysis.ts, csvCore.ts, fmt.ts, insights/*, export/* |
| Types | 5 | api.ts, extraction.ts, index.ts |

### Backend (28 files)

| Category | Count | Files |
|----------|-------|-------|
| Controllers | 8 | AuthController, BatchController, ComparisonController, DocumentController, ExtractionController, HealthController, PdfController |
| Services | 12 | DoclingService, PdfAnalyzerService, BaseAIService, OpenRouterService, McaAiService, McaDetectionService, TransactionClassificationService, BalanceExtractorService, DocumentTypeDetector, FieldMapper, ExtractionScorer, PiiPatterns |
| Jobs | 1 | ProcessPdfExtraction.php |
| Models | 5 | Account, Batch, Document, User, DocumentBatch |
| Routes | 2 | api.php, web.php |

### Pipeline / Specialized Services (33 files)

| Category | Count | Files |
|----------|-------|-------|
| Pipeline Steps | 7 | DoclingExtractionStep, TypeDetectionStep, FieldMappingStep, ScoringStep, PiiDetectionStep, BalanceExtractionStep, AiAnalysisStep |
| Field Mappers | 4 | BankStatementTableParser, FieldValueCleaner, GarbageDetector, HeadingParser |
| AI Services | 3 | BaseAIService, OpenRouterService, McaAiService |
| Analysis Services | 4 | DocumentTypeDetector, ExtractionScorer, PdfAnalyzerService, BalanceExtractorService |
| Interfaces | 2 | ExtractionServiceInterface, AiServiceInterface |
| Patterns | 1 | PiiPatterns.php |
| Other | 12 | DoclingService, McaDetectionService, TransactionClassificationService, FieldMapper, etc. |

---

## Architectural Patterns

1. **Fallback cascade** — AiAnalysisStep: OpenRouter → BaseAIService fallback → McaAiService transaction counting
2. **Stampede protection** — Cache::lock() with 30s TTL on PDF content hash
3. **3-stage MCA detection** — Pre-filter (keyword/regex) → Fuzzy → AI review for borderline
4. **Hybrid persistence** — Redis (cache + queue) + PostgreSQL (durable storage)
5. **Job resilience** — 5 retries, 60s exponential backoff
6. **Dual AI tier** — OpenRouterService (primary) + McaAiService (MCA-specific)
7. **Stub class pattern** — Analysis/Extraction/Patterns namespaces are Mockery shims extending root originals

---

## Phase 1 Complete — Proceed to Phase 2

All 3 auditors have completed. Phase 2 (Critical Path Deep-Dives) next:
- Path 1: Auth & Session
- Path 2: PDF Upload → Extraction Pipeline
- Path 3: Batch Processing
- Path 4: MCA Detection
- Path 5: Scoring & Field Mapping
