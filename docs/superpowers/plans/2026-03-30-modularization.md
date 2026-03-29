# MCA PDF Scrubber — Full Repository Modularization Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` to implement task-by-task. Each task targets one file or logical group of files. Track with `- [ ]` checkboxes.

**Goal:** Break all monolith files into single-responsibility units across frontend (React/TypeScript), backend (Laravel/PHP), and python-service (FastAPI/Python). No file should exceed ~200 lines.

**Architecture:** Each service component gets its own modularization pass. Monolith files are split into focused, single-responsibility modules. Shared patterns (e.g., AI services) get base class extraction before specific implementations.

**Tech Stack:** React + TypeScript + Vite, Laravel + PHP 8.4, FastAPI + Python + Docling

---

## PHASE 1: Frontend Modularization

### Task 1: Split `StatementsView.tsx` (605 lines → 6 files)

**Files:**
- Modify: `frontend/src/components/StatementsView.tsx` (strip to shell + import StatementCard, StatementFilters, StatementList)
- Create: `frontend/src/components/statements/StatementCard.tsx` — single statement row rendering (reconciles stripe, balance, flow chart, action buttons)
- Create: `frontend/src/components/statements/StatementFilters.tsx` — sort/filter controls
- Create: `frontend/src/components/statements/Sparkline.tsx` — extract existing inline Sparkline into its own file
- Create: `frontend/src/components/statements/SkeletonRow.tsx` — extract existing inline skeleton
- Create: `frontend/src/components/statements/types.ts` — StatementCardProps, StatementFiltersProps interfaces
- Modify: `frontend/src/components/index.ts` — add new exports

- [ ] **Step 1:** Create `frontend/src/components/statements/` directory
- [ ] **Step 2:** Create `StatementCard.tsx` — extract row rendering logic, inline Sparkline, action buttons
- [ ] **Step 3:** Create `StatementFilters.tsx` — extract filter/sort controls
- [ ] **Step 4:** Create `Sparkline.tsx` — move inline Sparkline component
- [ ] **Step 5:** Create `SkeletonRow.tsx` — move inline skeleton row
- [ ] **Step 6:** Create `types.ts` with all interfaces
- [ ] **Step 7:** Rewrite `StatementsView.tsx` as shell that composes the new files
- [ ] **Step 8:** Update `index.ts` barrel exports
- [ ] **Step 9:** Build and verify — `cd frontend && npm run build`
- [ ] **Step 10:** Commit

---

### Task 2: Split `ReviewModal.tsx` (540 lines → 6 files)

**Files:**
- Modify: `frontend/src/components/ReviewModal.tsx` (strip to shell + imports)
- Create: `frontend/src/components/review/ReviewHeader.tsx` — account number, period, balances, confidence badge
- Create: `frontend/src/components/review/ReviewFilterBar.tsx` — search input, filter tabs, counts
- Create: `frontend/src/components/review/ReviewTransactionRow.tsx` — single transaction row (amount, payee, tags, checkbox)
- Create: `frontend/src/components/review/ReviewEmptyState.tsx` — "No transactions found" placeholder
- Create: `frontend/src/components/review/TagEditorModal.tsx` — extract existing TagEditorModal
- Modify: `frontend/src/components/index.ts` — add new exports

- [ ] **Step 1:** Create `frontend/src/components/review/` directory
- [ ] **Step 2:** Create `ReviewHeader.tsx` — top section with account info and balances
- [ ] **Step 3:** Create `ReviewFilterBar.tsx` — filter tabs and search
- [ ] **Step 4:** Create `ReviewTransactionRow.tsx` — single row rendering
- [ ] **Step 5:** Create `ReviewEmptyState.tsx` — empty state component
- [ ] **Step 6:** Create `TagEditorModal.tsx` — move TagEditorModal from ReviewModal
- [ ] **Step 7:** Rewrite `ReviewModal.tsx` as shell composing new files
- [ ] **Step 8:** Build and verify
- [ ] **Step 9:** Commit

---

### Task 3: Split `ComparativeView.tsx` (503 lines → 5 files)

**Files:**
- Modify: `frontend/src/components/ComparativeView.tsx` (strip to shell)
- Create: `frontend/src/components/comparison/ComparisonSelector.tsx` — document A/B selection dropdowns
- Create: `frontend/src/components/comparison/BalanceComparison.tsx` — beginning/ending balance comparison
- Create: `frontend/src/components/comparison/DeltaComparison.tsx` — delta/flow comparison
- Create: `frontend/src/components/comparison/RiskComparison.tsx` — NSF/risk comparison

- [ ] **Step 1:** Create `frontend/src/components/comparison/` directory
- [ ] **Step 2:** Create `ComparisonSelector.tsx` — document A/B picker
- [ ] **Step 3:** Create `BalanceComparison.tsx` — balance diff view
- [ ] **Step 4:** Create `DeltaComparison.tsx` — delta flow bars
- [ ] **Step 5:** Create `RiskComparison.tsx` — NSF and risk indicators
- [ ] **Step 6:** Rewrite `ComparativeView.tsx` as shell
- [ ] **Step 7:** Build and verify
- [ ] **Step 8:** Commit

---

### Task 4: Split `DocumentLibrary.tsx` (449 lines → 4 files)

**Files:**
- Modify: `frontend/src/components/DocumentLibrary.tsx` (strip to shell)
- Create: `frontend/src/components/library/DocumentList.tsx` — the document table rows
- Create: `frontend/src/components/library/DocumentFilters.tsx` — status filter tabs
- Create: `frontend/src/components/library/DocumentItem.tsx` — single document row

- [ ] **Step 1:** Create `frontend/src/components/library/` directory
- [ ] **Step 2:** Create `DocumentList.tsx` — main list rendering
- [ ] **Step 3:** Create `DocumentFilters.tsx` — filter bar
- [ ] **Step 4:** Create `DocumentItem.tsx` — single row
- [ ] **Step 5:** Rewrite `DocumentLibrary.tsx` as shell
- [ ] **Step 6:** Build and verify
- [ ] **Step 7:** Commit

---

### Task 5: Split `BatchProcessor.tsx` (431 lines → 4 files)

**Files:**
- Modify: `frontend/src/components/BatchProcessor.tsx` (strip to shell)
- Create: `frontend/src/components/batch/BatchCreator.tsx` — batch creation form
- Create: `frontend/src/components/batch/BatchProgress.tsx` — progress tracker
- Create: `frontend/src/components/batch/BatchDocumentList.tsx` — document selection list

- [ ] **Step 1:** Create `frontend/src/components/batch/` directory
- [ ] **Step 2:** Create `BatchCreator.tsx` — creation form
- [ ] **Step 3:** Create `BatchProgress.tsx` — progress display
- [ ] **Step 4:** Create `BatchDocumentList.tsx` — doc selection
- [ ] **Step 5:** Rewrite `BatchProcessor.tsx` as shell
- [ ] **Step 6:** Build and verify
- [ ] **Step 7:** Commit

---

### Task 6: Split `transactionParser.ts` (384 lines → 4 files)

**Files:**
- Modify: `frontend/src/utils/transactionParser.ts` (keep only public exports + re-export)
- Create: `frontend/src/utils/parsing/dateParser.ts` — parseDate, looksLikeDate, monthNames
- Create: `frontend/src/utils/parsing/amountParser.ts` — parseAmount, tryParseAmount
- Create: `frontend/src/utils/parsing/sectionDetector.ts` — detectSectionType, isColumnHeaderRow, isSectionSummaryRow, isSeparatorRow
- Create: `frontend/src/utils/parsing/checksParser.ts` — parseChecksRow
- Create: `frontend/src/utils/parsing/transactionParser.ts` — parseTransactionRow, parseTransactionsFromMarkdown
- Create: `frontend/src/utils/parsing/index.ts` — re-export all

- [ ] **Step 1:** Create `frontend/src/utils/parsing/` directory
- [ ] **Step 2:** Create `dateParser.ts` — date parsing logic
- [ ] **Step 3:** Create `amountParser.ts` — amount parsing logic
- [ ] **Step 4:** Create `sectionDetector.ts` — section detection
- [ ] **Step 5:** Create `checksParser.ts` — check row parsing
- [ ] **Step 6:** Create `transactionParser.ts` — main parser + Markdown entry point
- [ ] **Step 7:** Create `index.ts` re-exports
- [ ] **Step 8:** Rewrite `transactionParser.ts` as barrel
- [ ] **Step 9:** Build and verify
- [ ] **Step 10:** Commit

---

### Task 7: Split `DocumentDetailPanel.tsx` (351 lines → 5 files)

**Files:**
- Modify: `frontend/src/components/DocumentDetailPanel.tsx` (strip to shell)
- Create: `frontend/src/components/detail/DetailTabNav.tsx` — tab navigation (Markdown / Key Details / Scores / PII / AI)
- Create: `frontend/src/components/detail/DetailMarkdownTab.tsx` — markdown viewer
- Create: `frontend/src/components/detail/DetailKeyDetailsTab.tsx` — key details table
- Create: `frontend/src/components/detail/DetailScoresTab.tsx` — scores display

- [ ] **Step 1:** Create `frontend/src/components/detail/` directory
- [ ] **Step 2:** Create `DetailTabNav.tsx` — tab navigation
- [ ] **Step 3:** Create `DetailMarkdownTab.tsx` — markdown tab
- [ ] **Step 4:** Create `DetailKeyDetailsTab.tsx` — key details tab
- [ ] **Step 5:** Create `DetailScoresTab.tsx` — scores tab
- [ ] **Step 6:** Rewrite `DocumentDetailPanel.tsx` as shell
- [ ] **Step 7:** Build and verify
- [ ] **Step 8:** Commit

---

## PHASE 2: Backend Modularization

### Task 8: Extract AI Base Service (MiniMaxService + OpenRouterService → BaseAIService)

**Files:**
- Create: `backend/app/Services/BaseAIService.php` — abstract base class with shared fallback logic, prompt building, response parsing
- Modify: `backend/app/Services/MiniMaxService.php` — extend BaseAIService, keep only MiniMax-specific config
- Modify: `backend/app/Services/OpenRouterService.php` — extend BaseAIService, keep only OpenRouter-specific config
- Create: `backend/app/Services/Prompts/` directory with prompt builder classes

- [ ] **Step 1:** Create `backend/app/Services/BaseAIService.php` — extract common methods (getFallbackAnalysis, buildPrompt, parseResponse)
- [ ] **Step 2:** Refactor `MiniMaxService.php` to extend BaseAIService
- [ ] **Step 3:** Refactor `OpenRouterService.php` to extend BaseAIService
- [ ] **Step 4:** Verify with `php artisan test` or API smoke test
- [ ] **Step 5:** Commit

---

### Task 9: Split `FieldMapper.php` (369 lines → 5 files)

**Files:**
- Modify: `backend/app/Services/FieldMapper.php` (orchestrator only, ~100 lines)
- Create: `backend/app/Services/FieldMappers/BankStatementTableParser.php` — table parsing logic
- Create: `backend/app/Services/FieldMappers/FieldValueCleaner.php` — value cleaning (currency, dates, numbers)
- Create: `backend/app/Services/FieldMappers/GarbageDetector.php` — detect garbage/unparseable fields
- Create: `backend/app/Services/FieldMappers/HeadingParser.php` — heading extraction logic

- [ ] **Step 1:** Create `backend/app/Services/FieldMappers/` directory
- [ ] **Step 2:** Create `BankStatementTableParser.php` — extract table parsing
- [ ] **Step 3:** Create `FieldValueCleaner.php` — extract cleaning logic
- [ ] **Step 4:** Create `GarbageDetector.php` — extract garbage detection
- [ ] **Step 5:** Create `HeadingParser.php` — extract heading parsing
- [ ] **Step 6:** Rewrite `FieldMapper.php` as orchestrator importing the new classes
- [ ] **Step 7:** Verify with `php artisan test`
- [ ] **Step 8:** Commit

---

### Task 10: Split python `server.py` (324 lines → 5 modules)

**Files:**
- Modify: `python-service/src/server.py` (FastAPI app + routes only, ~100 lines)
- Create: `python-service/src/converter.py` — `_convert_docling`, `DocumentConverter` initialization, pipeline options
- Create: `python-service/src/ocr.py` — `_extract_images`, `_ocr_images_sync`, EasyOCR initialization
- Create: `python-service/src/config.py` — `WORKERS`, `IO_THREADS`, `CPU_THREADS`, `get_device()`
- Create: `python-service/src/models.py` — Pydantic models (UrlExtractRequest, ExtractResponse, HealthResponse)

- [ ] **Step 1:** Create `python-service/src/config.py` — configuration constants
- [ ] **Step 2:** Create `python-service/src/models.py` — Pydantic models
- [ ] **Step 3:** Create `python-service/src/converter.py` — Docling conversion
- [ ] **Step 4:** Create `python-service/src/ocr.py` — OCR logic
- [ ] **Step 5:** Rewrite `server.py` as thin app + route wiring
- [ ] **Step 6:** Verify: run `python src/server.py` and check health endpoint
- [ ] **Step 7:** Commit

---

### Task 11: Split `useExtraction.ts` + `ExtractionContext.tsx` (231 + 185 lines → 4 files)

**Files:**
- Modify: `frontend/src/hooks/useExtraction.ts` (strip state management, keep only pure logic)
- Create: `frontend/src/hooks/useExtractionState.ts` — all state + setters (from ExtractionContext)
- Create: `frontend/src/hooks/useExtraction polling.ts` — polling logic (extract from ExtractionContext)
- Modify: `frontend/src/contexts/ExtractionContext.tsx` (thin context wrapper that composes the hooks)

- [ ] **Step 1:** Create `frontend/src/hooks/useExtractionState.ts` — extract state
- [ ] **Step 2:** Create `frontend/src/hooks/useExtractionPolling.ts` — extract polling
- [ ] **Step 3:** Rewrite `useExtraction.ts` — pure logic only
- [ ] **Step 4:** Rewrite `ExtractionContext.tsx` — thin composition
- [ ] **Step 5:** Build and verify
- [ ] **Step 6:** Commit

---

## PHASE 3: Cleanup & Integration

### Task 12: Move `AnalysisResults.tsx` sub-components (278 lines → 4 files)

**Files:**
- Modify: `frontend/src/components/AnalysisResults.tsx` (strip to shell)
- Create: `frontend/src/components/analysis/AnalysisOverview.tsx` — overview mode
- Create: `frontend/src/components/analysis/AnalysisDetailed.tsx` — detailed mode
- Create: `frontend/src/components/analysis/ScoreCard.tsx` — extract existing ScoreCard

- [ ] **Step 1:** Create `frontend/src/components/analysis/` directory
- [ ] **Step 2:** Create `AnalysisOverview.tsx`
- [ ] **Step 3:** Create `AnalysisDetailed.tsx`
- [ ] **Step 4:** Move `ScoreCard.tsx` into analysis/ (or keep in place, update exports)
- [ ] **Step 5:** Rewrite `AnalysisResults.tsx` as shell
- [ ] **Step 6:** Build and verify
- [ ] **Step 7:** Commit

---

### Task 13: Final Verification

- [ ] **Step 1:** Run `cd frontend && npm run build` — must pass
- [ ] **Step 2:** Run `cd backend && php artisan test` — must pass
- [ ] **Step 3:** Start all services, smoke test: upload PDF, view statements, review modal, comparative view
- [ ] **Step 4:** Commit final cleanup task
