# FRONTEND_INVENTORY.md

## Pages (2)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/pages/LoginPage.tsx` (155 lines)
- **Component**: `LoginPage`
- **Purpose**: User authentication page with email/password login form
- **Key props**: `{ onLogin: (user: User) => void }`
- **Key state**: `email`, `password`, `error`, `loading` (all `useState`)
- **Depends on**: `../services/api` (`authApi.login`), `../types/transactions` (`User` type)
- **Notes**: Stores authenticated user in `localStorage`, calls `onLogin` callback on success

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/pages/DashboardPage.tsx` (111 lines)
- **Component**: `DashboardPage`
- **Purpose**: Main application shell routing between upload/library views
- **Key props**: `{ user: User }`
- **Key state**: `activeView` (`'upload'|'library'`), `selectedDocumentId`, `selectedResult` (all `useState`)
- **Depends on**: `ThemeProvider`, `ExtractionContext`, `UploadSection`, `SettingsPanel`, `StatementsView`, `DocumentDetailPanel`, `ReviewModal`, `Header`, `ErrorBoundary`

---

## Analysis Components (3)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/components/analysis/AnalysisOverview.tsx` (84 lines)
- **Component**: `AnalysisOverview`
- **Purpose**: Displays balance summary (beginning/ending/net change) from extraction result
- **Key props**: `{ result: ExtractionResult }`
- **Key state**: None (pure presentation)
- **Depends on**: `../../types/extraction` (`ExtractionResult`)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/components/analysis/AnalysisDetailed.tsx` (196 lines)
- **Component**: `AnalysisDetailed`
- **Purpose**: Displays AI document analysis results (validity, PII, transaction summary, risk indicators, recommendations)
- **Key props**: `{ result: ExtractionResult }`
- **Key state**: None (pure presentation)
- **Depends on**: `../../types/extraction` (`ExtractionResult`)
- **Notes**: Shows "Basic" badge when AI fallback was used; conditionally renders multiple analysis sections

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/components/analysis/McaFindings.tsx` (206 lines)
- **Component**: `McaFindings`
- **Purpose**: Displays MCA transaction detections with confidence scoring and AI-reviewed candidates
- **Key props**: `{ result: ExtractionResult }`
- **Key state**: None (pure presentation)
- **Depends on**: `../../types/extraction` (`ExtractionResult`)
- **Notes**: Limits transaction list to 10, candidates to 5; shows unique provider badges

---

## Hooks (4)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/hooks/useExtractionState.ts` (56 lines)
- **Hook**: `useExtractionState`
- **Purpose**: Manages extraction state (`ExtractionState`) and batch results
- **Returns**: `{ state, setState, batchResults, setBatchResults, pollingRef, currentFileIndexRef, remainingFilesRef, clearPolling, reset }`
- **Key state**: `state: ExtractionState`, `batchResults: BatchEntry[]`
- **Depends on**: React `useState`, `useRef`

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/hooks/useExtractionPolling.ts` (82 lines)
- **Hook**: `useExtractionPolling`
- **Purpose**: Polls `/pdf/progress/{jobId}` every 1500ms; handles 404 backoff (max 10 consecutive errors)
- **Returns**: `{ pollProgress: (jobId: string) => Promise<ProgressResponse | null> }`
- **Key state**: `consecutiveErrorsRef` (useRef)
- **Depends on**: `../services/api`, `axios`, `../types/extraction`

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/hooks/useExtraction.ts` (154 lines)
- **Hook**: `useExtraction`
- **Purpose**: Orchestrates single and batch PDF extraction; composes `useExtractionState` + `useExtractionPolling`
- **Returns**: `{ state, batchResults, startExtraction, startBatchExtraction, reset }`
- **Depends on**: `useExtractionState`, `useExtractionPolling`, `../services/api`

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/hooks/useInsightsCalculations.ts` (143 lines)
- **Hook**: `useInsightsCalculations`
- **Purpose**: Computes `transactions`, `revenueStats`, `mcaPaymentsByMonth`, `dailyBalances` from `ExtractionResult` via `useMemo`
- **Returns**: `InsightsCalculations` object
- **Depends on**: `../types/extraction`, `../types/transactions`, `../utils/transactionParser`

---

## Context (1)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/contexts/ExtractionContext.tsx` (35 lines)
- **Context**: `ExtractionContext`
- **Purpose**: Provides extraction state and actions to the component tree
- **Provider**: `ExtractionProvider`
- **Exposes**: `{ state, batchResults, startExtraction, startBatchExtraction, reset }`
- **Depends on**: `useExtraction` hook

---

## Utils: Formatting (1)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/fmt.ts` (31 lines)
- **Functions**: `fmtMoney`, `maskAccountNumber`
- **Purpose**: Shared USD currency formatting and account number masking
- **Depends on**: None (pure utility)

---

## Utils: Balance Analysis (1)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/balanceAnalysis.ts` (142 lines)
- **Functions**: `buildDailyBalances`, `buildTrueBalances`, `calculateDailyCashFlows`, `calculateMonthlyCashFlows`, `getWorkDaysInMonth`, `findRepeatingTransactions`
- **Purpose**: Balance and cash flow analysis from transaction list
- **Depends on**: `../types/transactions` (`TransactionRow`)

---

## Utils: CSV Core (1)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/csvCore.ts` (44 lines)
- **Functions**: `escapeCsvField`, `toCsv`, `downloadCsv`
- **Purpose**: Core CSV formatting and browser download utilities
- **Depends on**: None

---

## Utils: CSV Export (1)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/csvExport.ts` (881 lines)
- **Functions**: 20+ export functions (see `export/index.ts` barrel), `findRepeatingTransactions`, `buildDailyBalances`, `buildTrueBalances`, `calculateDailyCashFlows`, `calculateMonthlyCashFlows`, `getWorkDaysInMonth`
- **Purpose**: MoneyThumb-style CSV exports for all transaction/balance report types
- **Depends on**: `../types/transactions` (`TransactionRow`)
- **Functions exported**: `exportAllTransactions`, `exportCreditTransactions`, `exportDailyBalances`, `exportDailyCashFlows`, `exportIncomingTransfers`, `exportOutgoingTransfers`, `exportLargeTransactions`, `exportMcaTransactions`, `exportMonthlyCashFlows`, `exportMonthlyMca`, `exportMonthlyNegativeDays`, `exportNonTrueCreditTransactions`, `exportNsfTransactions`, `exportOverdraftTransactions`, `exportRepeatingTransactions`, `exportReturnedTransactions`, `exportRevenueStatistics`, `exportStatementsSummary`, `exportTrueCreditTransactions`, `exportData` (dispatcher)

---

## Utils: Transaction Parser (1)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/transactionParser.ts` (89 lines)
- **Functions**: `autoTag`, `getTagColor`, barrel re-exports from `./parsing/`
- **Purpose**: Auto-tags transactions based on description/amount patterns; re-exports all parsing sub-modules
- **Depends on**: `./parsing/` sub-modules
- **Key exports**: `autoTag`, `getTagColor`, plus all `./parsing/` re-exports

---

## Utils: Export Barrel (1)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/export/index.ts` (115 lines)
- **Functions**: `exportData` (dispatcher), `exportRevenueStatistics`
- **Purpose**: Export dispatcher routing `ExportType` to specific formatter functions
- **Depends on**: `./formatters/transactions`, `./formatters/balances`, `../csvCore`

---

## Utils: Export Formatters (2)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/export/formatters/transactions.ts` (121 lines)
- **Functions**: 12 transaction-specific CSV exporters
- **Purpose**: Individual transaction export implementations
- **Depends on**: `../../../types/transactions`, `../../csvCore`, `../../balanceAnalysis`

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/export/formatters/balances.ts` (171 lines)
- **Functions**: Balance/cash flow export functions
- **Purpose**: Balance and cash flow export implementations
- **Depends on**: `../../../types/transactions`, `../../csvCore`, `../../balanceAnalysis`

---

## Utils: Parsing Sub-modules (5)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/parsing/dateParser.ts`
- **Functions**: `parseDate`, `looksLikeDate`, `monthNames`
- **Purpose**: Date parsing utilities

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/parsing/amountParser.ts`
- **Functions**: `parseAmount`, `tryParseAmount`
- **Purpose**: Currency amount parsing

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/parsing/checksParser.ts`
- **Functions**: `parseChecksRow`, `ParsedCheck`
- **Purpose**: Check/cheque row parsing

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/parsing/transactionParser.ts`
- **Functions**: `parseTransactionRow`, `parseTransactionsFromMarkdown`
- **Purpose**: Transaction row/markdown parsing

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/parsing/sectionDetector.ts`
- **Functions**: `detectSectionType`, `isColumnHeaderRow`, `isSectionSummaryRow`, `isSeparatorRow`, `SectionType`
- **Purpose**: Document section detection

---

## Utils: Insights (3)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/insights/index.ts` (5 lines)
- **Purpose**: Barrel re-export for insights utilities
- **Exports**: `mapBackendTagToFrontend`, `convertBackendTransaction`, `convertMcaTransaction`, `mergeMcaTransactions`, `filterByTag`, `computeRevenueStats`, `buildDailyBalances`, `buildMCAByMonth`, types

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/insights/converters.ts` (109 lines)
- **Functions**: `mapBackendTagToFrontend`, `convertBackendTransaction`, `convertMcaTransaction`, `mergeMcaTransactions`
- **Purpose**: Backend-to-frontend data shape conversion for transactions and MCA findings

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/utils/insights/statistics.ts` (110 lines)
- **Functions**: `filterByTag`, `computeRevenueStats`, `buildDailyBalances`, `buildMCAByMonth`
- **Purpose**: Revenue stats, daily balance, and MCA monthly aggregation

---

## Types (5)

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/types/extraction.ts` (160 lines)
- **Exports**: `ExtractionState`, `ExtractionResult`, `AiAnalysis`, `KeyDetail`, `Recommendation`, `McaTransaction`, `McaFindings`, `TransactionTag`, `ClassifiedTransaction`, `TransactionClassificationSummary`, `TransactionClassificationResult`, `ProgressResponse`, `BatchEntry`

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/types/transactions.ts` (41 lines)
- **Exports**: `TransactionRow`, `TagCategory`, `TAG_CATEGORIES`, `ParsedStatement`

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/types/api.ts` (43 lines)
- **Exports**: `Document`, `Batch`, `BatchDocument`

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/types/export.ts` (201 lines)
- **Exports**: All `Export*` interfaces, `ExportType`, `ExportOption`, `EXPORT_OPTIONS`, `TransactionData`

### `/Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend/src/types/index.ts` (29 lines)
- **Purpose**: Barrel re-export of all types

---

## Summary

| Category | Count |
|----------|-------|
| Pages | 2 |
| Analysis Components | 3 |
| Hooks | 4 |
| Contexts | 1 |
| Utils (top-level) | 9 |
| Utils (parsing sub-modules) | 5 |
| Type files | 5 |
| **Total files** | **29** |
