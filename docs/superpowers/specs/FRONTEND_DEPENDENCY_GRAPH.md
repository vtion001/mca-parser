# FRONTEND_DEPENDENCY_GRAPH.md

## Data Flow Map

```
Browser
  │
  ▼
LoginPage
  ├──► authApi.login() ──────────────► /auth/login (Laravel)
  └──► localStorage.setItem('user') ──┐
                                      ▼
                               DashboardPage
                                      │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             ThemeProvider    ExtractionContext    Header
                    │                │                │
                    ▼                ▼                ▼
           (useTheme hook)   useExtraction hook    (view routing only)
                                      │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
           useExtractionState   useExtractionPolling   UploadSection
                    │                │                │
                    ▼                ▼                ▼
           ExtractionContext   api.get(/pdf/progress)  api.post(/pdf/full-extract)
                                      │
                                      ▼
                               /pdf/progress/{jobId} (Laravel)
```

---

## UploadSection ──calls──► API
```
UploadSection
  └──► api.post('/pdf/full-extract', FormData) ──► Laravel /api/v1/pdf/full-extract
```

---

## StatementsView ──uses──► Hooks/Contexts
```
StatementsView
  └──► ExtractionContext.state.result ──► ExtractionResult
                                            │
                                            ├──► useInsightsCalculations ──► parseTransactionsFromMarkdown
                                            │                                      │
                                            │                                      ▼
                                            │                              transactionParser (autoTag)
                                            │
                                            └──► insights/index.ts
                                                  ├──► converters (mapBackendTagToFrontend, convertBackendTransaction, mergeMcaTransactions)
                                                  └──► statistics (filterByTag, computeRevenueStats, buildDailyBalances, buildMCAByMonth)
```

---

## ComparativeView ──needs──► Data
```
ComparativeView
  ├──► state.result (ExtractionResult)
  ├──► transactions (TransactionRow[])
  ├──► dailyBalances ({ date, balance }[])
  ├──► trueBalances ({ date, balance }[])
  ├──► revenueStats (RevenueStats)
  ├──► mcaPaymentsByMonth (McAByMonth[])
  ├──► begBal / endBal (number | null)
  └──► export/formatters/* ──► csvCore.downloadCsv
```

---

## InsightsScorecard ──uses──► Utils
```
InsightsScorecard
  ├──► insights/statistics.ts
  │     ├──► filterByTag()
  │     ├──► computeRevenueStats()
  │     ├──► buildDailyBalances()
  │     └──► buildMCAByMonth()
  │
  ├──► insights/converters.ts
  │     ├──► mapBackendTagToFrontend()
  │     ├──► convertBackendTransaction()
  │     ├──► convertMcaTransaction()
  │     └──► mergeMcaTransactions()
  │
  ├──► balanceAnalysis.ts
  │     ├──► buildDailyBalances()
  │     ├──► buildTrueBalances()
  │     ├──► calculateDailyCashFlows()
  │     ├──► calculateMonthlyCashFlows()
  │     ├──► getWorkDaysInMonth()
  │     └──► findRepeatingTransactions()
  │
  ├──► csvExport.ts
  │     ├──► exportData() ──► formatters/transactions.ts
  │     │                   └──► formatters/balances.ts
  │     └──► downloadCsv() ──► csvCore.ts
  │
  └──► fmt.ts
        ├──► fmtMoney()
        └──► maskAccountNumber()
```

---

## Analysis Components ──depend on──► Types
```
AnalysisOverview ──► ExtractionResult.balances
AnalysisDetailed  ──► ExtractionResult.ai_analysis
McaFindings      ──► ExtractionResult.mca_findings
                      ExtractionResult.transaction_classification
```

---

## Export Pipeline
```
exportData(type, config) [export/index.ts]
  ├──► formatters/transactions.ts
  │     ├──► escapeCsvField() [csvCore]
  │     └──► findRepeatingTransactions() [balanceAnalysis]
  └──► formatters/balances.ts
        ├──► escapeCsvField() [csvCore]
        ├──► calculateDailyCashFlows() [balanceAnalysis]
        ├──► calculateMonthlyCashFlows() [balanceAnalysis]
        └──► getWorkDaysInMonth() [balanceAnalysis]
```

---

## Key API Calls
| Component | API Method | Endpoint |
|-----------|-----------|----------|
| `useExtraction.startExtraction` | POST | `/pdf/full-extract` |
| `useExtractionPolling.pollProgress` | GET | `/pdf/progress/{jobId}` |
| `LoginPage` | POST | `/auth/login` |
| `LoginPage` | POST | `/auth/register` |

---

## State Ownership
| State | Owner |
|-------|-------|
| `ExtractionState` | `useExtractionState` → `ExtractionContext` |
| `User` session | `LoginPage` → `localStorage` |
| `activeView` | `DashboardPage` (local) |
| `Theme` | `ThemeProvider` |
| `batchResults` | `useExtractionState` → `ExtractionContext` |
