# Codebase Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the MCA PDF Scrubber codebase to remove duplication, split monoliths, and clean up orphaned files.

**Architecture:** Address 4 categories of issues: (1) orphaned files not part of web app, (2) duplicated code between components, (3) PII regex patterns scattered across services, (4) oversized files violating single-responsibility.

**Tech Stack:** Laravel 11 (PHP), React 18 (TypeScript), Python FastAPI (Docling)

---

## File Map (Pre-existing Structure)

### Backend (Laravel)
```
backend/
├── app/
│   ├── Http/Controllers/          # 6 controllers
│   ├── Services/
│   │   ├── PdfAnalyzerService.php        # PII scrub/analyze (94 lines)
│   │   ├── ProcessPdfExtraction.php      # JOB (356 lines) ← MONOLITH
│   │   └── ...                           # Other services
│   └── Jobs/
├── database/migrations/
└── mca.txt                         # ← ORPHANED (7561 lines ASCII art)
```

### Frontend (React)
```
frontend/
├── src/
│   ├── components/
│   │   ├── InsightsScorecard.tsx         # 524 lines ← MONOLITH
│   │   ├── ReviewModal.tsx               # 318 lines
│   │   └── ...
│   ├── utils/transactionParser.ts        # parsing barrel
│   └── ...
├── profile-parser.js                      # ← ORPHANED
└── profile-real.js                        # ← ORPHANED
```

### Other
```
desktop/main.py                 # PyWebView desktop wrapper ← ORPHANED
scripts/benchmark.py            # DevOps benchmark script
```

---

## Issues Found

### Issue 1: Orphaned Files (Not Part of Web App)

| File | Size | Problem |
|------|------|---------|
| `backend/mca.txt` | 7561 lines | ASCII art banner (Claude Code branding), not code or data |
| `frontend/profile-parser.js` | 1.9KB | Standalone profiling script, not integrated |
| `frontend/profile-real.js` | 3.2KB | Standalone profiling script, not integrated |
| `desktop/main.py` | 2.2KB | PyWebView desktop wrapper, launches localhost in native window |

**Fix:** Add to `.gitignore`

### Issue 2: Transaction Parsing Duplicated in InsightsScorecard

**Files:** `InsightsScorecard.tsx` (lines 29-86), `ReviewModal.tsx` (lines 54-77)

**Problem:** `InsightsScorecard` receives `ExtractionResult` with markdown, then calls `deriveStatement()` which calls `parseTransactionsFromMarkdown()`. But `ReviewModal` already parses the same markdown in its own `useEffect` before rendering `InsightsScorecard`. Result: same markdown parsed twice.

**Duplicated helpers in InsightsScorecard (should be extracted to hook):**
- `deriveStatement()` → calls `parseTransactionsFromMarkdown()` (duplicated)
- `tagTransactions()` → calls `autoTag()` (duplicated)
- `filterByTag()` → INSIGHTS-SPECIFIC, extract to hook
- `getMonthlyCredits()` → INSIGHTS-SPECIFIC, extract to hook
- `buildDailyBalances()` → INSIGHTS-SPECIFIC, extract to hook
- `buildMCAByMonth()` → INSIGHTS-SPECIFIC, extract to hook

**Fix:** Create `useInsightsCalculations(result)` hook that InsightsScorecard calls instead of re-parsing.

### Issue 3: PII Regex Patterns Scattered

**Files:** `ProcessPdfExtraction.php` (lines 251-258), `PdfAnalyzerService.php` (lines 28-35)

**Problem:** Same PII patterns defined in two places.

`ProcessPdfExtraction.php:getPiiPatterns()`:
```php
'ssn' => '/\d{3}-\d{2}-\d{4}/',
'email' => '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/',
'phone' => '/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/',
```

`PdfAnalyzerService.php:scrub()`:
```php
'/\b\d{3}-\d{2}-\d{4}\b/' => '[SSN]',
'/\b\d{9}\b/' => '[ID]',
'/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/' => '[CARD]',
'/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/' => '[EMAIL]',
'/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/' => '[PHONE]',
'/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/' => '[DATE]',
```

**Fix:** Create `PiiPatterns.php` constant class with all patterns, have both services use it.

### Issue 4: InsightsScorecard.tsx (524 lines) — Monolith

**Problem:** Single 524-line file with inline helper functions, sub-components (`StatBlock`, `SectionHeader`, `DataTable`, `MiniLineChart`), and main component logic all in one file.

**Fix:** Split into:
- `hooks/useInsightsCalculations.ts` — all calculation helpers
- `components/charts/MiniLineChart.tsx` — extracted chart component
- `components/tables/DataTable.tsx` — extracted table component
- `components/InsightsScorecard.tsx` — main component (thin wrapper)

### Issue 5: ProcessPdfExtraction.php (356 lines) — Monolith Job

**Problem:** Single job handles: cache stampede protection, file hashing, Docling extraction, type detection, field mapping, PII detection, scoring, balance extraction, AI analysis, batch progress.

**Fix:** Extract method groups to services that already exist:
- PII detection → `PdfAnalyzerService` (already has `scrub()` and `checkPiiIndicators()`)
- Balance extraction → `BalanceExtractorService` (already exists)
- Field mapping → `FieldMapper` (already exists)
- AI analysis → `OpenRouterService` (already exists)

The job should orchestrate, not implement business logic.

---

## Task List

### Task 1: Add orphaned files to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add orphaned files to .gitignore**

Add these entries to `.gitignore`:
```
# Orphaned/debug files
backend/mca.txt
frontend/profile-*.js
desktop/
```

Run: `cat .gitignore` to verify

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore orphaned files (mca.txt, profile scripts, desktop wrapper)"
```

---

### Task 2: Centralize PII patterns

**Files:**
- Create: `backend/app/Services/PiiPatterns.php`
- Modify: `backend/app/Services/PdfAnalyzerService.php:22-35`
- Modify: `backend/app/Jobs/ProcessPdfExtraction.php:251-258`

- [ ] **Step 1: Create PiiPatterns.php**

```php
<?php

namespace App\Services;

class PiiPatterns
{
    public const SSN = '/\d{3}-\d{2}-\d{4}/';
    public const EMAIL = '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/';
    public const PHONE = '/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/';
    public const CREDIT_CARD = '/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/';
    public const DATE = '/\d{1,2}\/\d{1,2}\/\d{2,4}/';
    public const ID = '/\d{9}/';

    public const ALL = [
        'ssn' => self::SSN,
        'email' => self::EMAIL,
        'phone' => self::PHONE,
        'credit_card' => self::CREDIT_CARD,
        'date' => self::DATE,
        'id' => self::ID,
    ];

    public const SCRUB_MAP = [
        self::SSN => '[SSN]',
        self::ID => '[ID]',
        self::CREDIT_CARD => '[CARD]',
        self::EMAIL => '[EMAIL]',
        self::PHONE => '[PHONE]',
        self::DATE => '[DATE]',
    ];
}
```

- [ ] **Step 2: Update PdfAnalyzerService to use PiiPatterns**

In `backend/app/Services/PdfAnalyzerService.php`, replace the `$patterns` array in `scrub()` method (lines 28-35) with:
```php
$scrubbed = preg_replace(array_keys(PiiPatterns::SCRUB_MAP), array_values(PiiPatterns::SCRUB_MAP), $text);
```

- [ ] **Step 3: Update ProcessPdfExtraction to use PiiPatterns**

Replace `getPiiPatterns()` method (lines 251-258) with:
```php
private function getPiiPatterns(): array
{
    return [
        'ssn' => PiiPatterns::SSN,
        'email' => PiiPatterns::EMAIL,
        'phone' => PiiPatterns::PHONE,
    ];
}
```

- [ ] **Step 4: Add import to ProcessPdfExtraction.php**

Add `use App\Services\PiiPatterns;` at the top.

- [ ] **Step 5: Run tests**

Run: `cd backend && php artisan test --filter=PdfAnalyzer` (or relevant test class)

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/PiiPatterns.php backend/app/Services/PdfAnalyzerService.php backend/app/Jobs/ProcessPdfExtraction.php
git commit -m "refactor: centralize PII patterns into PiiPatterns service"
```

---

### Task 3: Extract useInsightsCalculations hook

**Files:**
- Create: `frontend/src/hooks/useInsightsCalculations.ts`
- Modify: `frontend/src/components/InsightsScorecard.tsx:29-86`

- [ ] **Step 1: Create useInsightsCalculations.ts**

Move these functions from InsightsScorecard to the hook:
- `filterByTag()` → becomes internal to hook
- `getMonthlyCredits()` → becomes internal to hook
- `buildDailyBalances()` → becomes internal to hook
- `buildMCAByMonth()` → becomes internal to hook

The hook receives `ExtractionResult` and returns:
```typescript
interface InsightsCalculations {
  transactions: TransactionRow[];
  revenueStats: RevenueStats;
  mcaPaymentsByMonth: McAByMonth[];
  dailyBalances: DailyBalance[];
  begBal: number | null;
  endBal: number | null;
}
```

- [ ] **Step 2: Update InsightsScorecard to use the hook**

In `InsightsScorecard.tsx`:
- Import `useInsightsCalculations` from the new hook
- Remove inline helper functions (lines 29-86) EXCEPT `deriveStatement` and `tagTransactions` (these call transactionParser directly which is correct)
- Replace calculation `useMemo` blocks with calls to the hook
- The hook should call `deriveStatement` internally (or `parseTransactionsFromMarkdown` directly)

Actually: Keep `deriveStatement` and `tagTransactions` in InsightsScorecard since they call transactionParser. The hook should wrap them.

- [ ] **Step 3: Verify ReviewModal still works**

ReviewModal renders InsightsScorecard and passes `result` prop. This should still work since InsightsScorecard still accepts `result`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useInsightsCalculations.ts frontend/src/components/InsightsScorecard.tsx
git commit -m "refactor: extract useInsightsCalculations hook from InsightsScorecard"
```

---

### Task 4: Split InsightsScorecard sub-components

**Files:**
- Create: `frontend/src/components/charts/MiniLineChart.tsx`
- Create: `frontend/src/components/tables/DataTable.tsx`
- Modify: `frontend/src/components/InsightsScorecard.tsx`

- [ ] **Step 1: Extract MiniLineChart**

Create `frontend/src/components/charts/MiniLineChart.tsx` with the `MiniLineChart` function component (lines 158-200+).

- [ ] **Step 2: Extract DataTable**

Create `frontend/src/components/tables/DataTable.tsx` with the `DataTable` function component (lines 109-156).

- [ ] **Step 3: Update InsightsScorecard imports**

Change inline component definitions to imports from the new files.

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build` to ensure no import errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/charts/MiniLineChart.tsx frontend/src/components/tables/DataTable.tsx frontend/src/components/InsightsScorecard.tsx
git commit -m "refactor: split InsightsScorecard sub-components into separate files"
```

---

### Task 5: Refactor ProcessPdfExtraction to delegate to existing services

**Files:**
- Modify: `backend/app/Jobs/ProcessPdfExtraction.php`

- [ ] **Step 1: Analyze current job structure**

Read the full ProcessPdfExtraction.php to identify which methods should be delegated:
- PII detection → inject `PdfAnalyzerService` and use `checkPiiIndicators()`
- Balance extraction → inject `BalanceExtractorService` and use existing methods
- Field mapping → inject `FieldMapper` and use existing methods

- [ ] **Step 2: Inject services via constructor**

Add service injections at the top of the job instead of having logic inline.

- [ ] **Step 3: Replace inline logic with service calls**

Replace inline method implementations with calls to injected services.

- [ ] **Step 4: Run tests**

Run: `cd backend && php artisan test`

- [ ] **Step 5: Commit**

```bash
git add backend/app/Jobs/ProcessPdfExtraction.php
git commit -m "refactor: delegate to existing services in ProcessPdfExtraction job"
```

---

## Verification Checklist

After all tasks:
- [ ] `backend/mca.txt`, `frontend/profile-*.js`, `desktop/` are ignored by git
- [ ] PII patterns defined in one place (`PiiPatterns.php`)
- [ ] InsightsScorecard uses `useInsightsCalculations` hook
- [ ] InsightsScorecard sub-components are in separate files
- [ ] ProcessPdfExtraction delegates to services
- [ ] All tests pass (`php artisan test` and `npm run build`)
