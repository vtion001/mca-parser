# FRONTEND_RISK_SUMMARY.md

## HIGH — Must Fix Immediately

| # | Issue | Why | Fix |
|---|-------|-----|-----|
| **H-1** | Duplicate balance analysis functions in `balanceAnalysis.ts` and `csvExport.ts` | Both files define `buildDailyBalances`, `buildTrueBalances`, `calculateDailyCashFlows`, `calculateMonthlyCashFlows`, `getWorkDaysInMonth`, `findRepeatingTransactions` identically. Edits to one will not propagate to the other, causing hard-to-detect divergence. | Consolidate into one source (`balanceAnalysis.ts` or a shared module) and import from both. |
| **H-2** | PII may leak into exported CSV data | `exportMcaTransactions` and related CSV exporters output raw transaction descriptions. If PII scrubbing did not fully clean descriptions before this export step, sensitive data (SSN fragments, account numbers) is written to CSV files that users download. | Validate that `ExtractionResult` PII fields are null/empty before allowing CSV export, or strip PII from exported descriptions. |
| **H-3** | `ThemeProvider` imported from non-existent file | `DashboardPage.tsx:2` imports `ThemeProvider` from `'../hooks/useTheme'` but `useTheme` was not found in the hooks directory. If this file does not exist or is incomplete, the entire app will crash on the dashboard. | Verify `useTheme.ts` exists and exports `ThemeProvider`, or remove the import if not needed. |

---

## MEDIUM — Fix Next Sprint

| # | Issue | Why | Fix |
|---|-------|-----|-----|
| **M-1** | Duplicate `downloadCsv`/`escapeCsvField`/`toCsv` in `csvCore.ts` and `csvExport.ts` | Same functions copied in two files — maintenance hazard. | Delete duplicates from `csvExport.ts` and have it import from `csvCore.ts`. |
| **M-2** | True Revenue hardcoded at 0.9 multiplier | No explanation for why "true revenue" is exactly 90% of total credits. Could misrepresent actual revenue if the transfer ratio varies by account. | Make configurable via account settings or at minimum document the 0.9 assumption. |
| **M-3** | Hardcoded "MCA Provider" string in export formatters | Lender name shown as literal `'MCA Provider'` instead of real provider name from transaction data. Misleading in exported reports. | Pull actual lender name from transaction `mca_provider` field when available. |
| **M-4** | No error boundary around analysis components | `AnalysisDetailed` and `McaFindings` will throw if `result` is unexpectedly shaped. Only internal null checks exist — a malformed API response could crash the panel. | Wrap each analysis component in an ErrorBoundary or add try/catch at panel level. |
| **M-5** | `autoTag` runs regex on untrusted description strings | Case-insensitive regex (`/wire from\|wire to\|wire transfer/i`) on `description` — if descriptions come from untrusted PDF content ( attacker-controlled PDF upload), ReDoS is theoretically possible. | Apply regex timeout or pre-sanitize input length before pattern matching. |
| **M-6** | `findRepeatingTransactions` groups by absolute amount | A +$500 credit and -$500 debit are treated as same-amount repeating transactions when they should not be. Amount grouping should distinguish sign. | Track `credit` vs `debit` separately in the amount map, or use `(credit, debit)` tuple key. |
| **M-7** | User session in `localStorage` without expiry/token refresh | `LoginPage` stores user object in `localStorage` — no expiry timestamp, no token refresh mechanism, no tampering detection. Replay attacks possible if localStorage is accessed. | Add JWT expiry check, store token separately from user object, and validate on each app load. |
| **M-8** | Duplicate `exportData` dispatchers | Two `exportData` functions exist (`export/index.ts` and `csvExport.ts`) — one is a thin wrapper, one is the actual implementation. Confusing which is authoritative. | Delete `export/index.ts` wrapper and have consumers import directly from `csvExport.ts`, or consolidate into one dispatcher file. |

---

## LOW — Should Fix Eventually

| # | Issue | Why | Fix |
|---|-------|-----|-----|
| **L-1** | `InsightsCalculations` interface not exported | The interface defined in `useInsightsCalculations.ts` is useful for typing other components but is not in the types index. | Re-export `InsightsCalculations` from `types/index.ts`. |
| **L-2** | `ExportConfig.revenueStats` omits `highestMonth`/`lowestMonth` | The `ExportConfig` interface's `revenueStats` is a simplified subset of what `useInsightsCalculations` actually computes. If these are needed in exports, they won't be available. | Expand `ExportConfig.revenueStats` to match full `RevenueStats` interface. |
| **L-3** | `parseTransactionsFromMarkdown` import chain is opaque | Multiple layers of barrel re-exports make it unclear which actual parsing module is being used. | Flatten import chain — components should import directly from the file that defines the function, not through multiple barrel files. |
| **L-4** | `consecutiveErrorsRef` reset timing issue | `consecutiveErrorsRef.current = 0` is set at Promise constructor level before the interval starts, but the error increment happens inside the interval callback — separation of concerns and potential for future bugs if Promise structure changes. | Move reset into the interval callback before the try block. |
| **L-5** | `BatchEntry` type defined in 3 places | `BatchEntry` is in `useExtractionState.ts`, `ExtractionContext.tsx`, and re-exported from `extraction.ts`. Risk of drift. | Single source of truth in `types/extraction.ts`, import everywhere else. |
| **L-6** | Hardcoded 1500ms polling interval | Not configurable — may be too aggressive for large PDFs or waste resources for simple ones. | Extract to a constant or config option. |
| **L-7** | `ReviewModal` default export assumption | The lazy import pattern `lazy(() => import('../components/ReviewModal').then(m => ({ default: m.ReviewModal })))` assumes `ReviewModal` is a default export. If it changes to named export, runtime error. | Verify the actual export mode in `ReviewModal.tsx`. |
| **L-8** | `parseTransactionsFromMarkdown` catch swallows errors silently | The `catch {}` block in `useInsightsCalculations.ts:94` returns empty stats with no warning. Parsing failures are invisible to users or logs. | Log parsing failures to console.error or surface via UI warning. |
| **L-9** | RFC 4180 length limits not enforced in `escapeCsvField` | CSV field escaping handles quoting but doesn't validate per-field byte/character limits. Malformed CSV could result from very long fields. | Add length check before quoting, or truncate with ellipsis. |
| **L-10** | No loading state between batch file completions | After last file in batch, `status: 'complete'` is set immediately — there's no visual confirmation that the final result has been confirmed before the "Done" message appears. | Add a brief confirmation state or await final render commit before marking complete. |

---

## Issue Count by Risk Level

| Level | Count |
|-------|-------|
| HIGH | 3 |
| MEDIUM | 8 |
| LOW | 10 |
| **Total** | **21** |
