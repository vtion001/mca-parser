# Pipeline Dependency Graph

Complete extraction flow from PDF upload to final analysis.

---

## Main Pipeline Steps

```
PdfExtractionPipeline::execute()
 │
 ├─► checkCache() ──(hit)──► handleCachedResult() ──► persistToDatabase() ──► updateProgressComplete()
 │                    │
 │                 (miss)
 │
 ├─► markAsProcessing()
 │
 ├─► STEP 1: DoclingExtractionStep
 │          └─► ExtractionServiceInterface::extractText(filePath)
 │             └─► DoclingService::extractText() ──► HTTP POST to :8001/extract
 │                                                      (retry 3x, 600s timeout)
 │                 ├─► success → context.markdown, context.ocrText, context.pageCount
 │                 └─► failure → context.error = 'Extraction failed...'
 │
 ├─► STEP 2: TypeDetectionStep
 │          └─► DocumentTypeDetector::detect(markdown)
 │             └─► Scores against 7 type schemas (bank_statement weight=1.5)
 │                 Returns {type: string, confidence: float}
 │
 ├─► STEP 3: FieldMappingStep
 │          └─► FieldMapper::map(markdown, documentType)
 │             ├─► For bank_statement: BankStatementTableParser + HeadingParser
 │             └─► GarbageDetector filters boilerplate date values
 │
 ├─► STEP 4: ScoringStep
 │          └─► ExtractionScorer::score(markdown, pageCount, piiBreakdown, PiiPatterns::ALL)
 │             └─► Returns {scores: {completeness, quality, pii_detection, overall},
 │                           pii_breakdown, recommendations}
 │                 overall = 0.4*completeness + 0.35*quality + 0.25*pii_detection
 │
 ├─► STEP 5: PiiDetectionStep
 │          └─► PdfAnalyzerService::checkPiiIndicators(markdown)
 │             └─► If true: piiBreakdown = array_keys(PiiPatterns::ALL)
 │                 [ssn, email, phone, credit_card, date, routing_number]
 │
 ├─► STEP 6: BalanceExtractionStep
 │          └─► BalanceExtractorService::extractBalances(markdown)
 │             └─► Returns {beginning_balance: {amount, keyword, raw_text},
 │                           ending_balance: {amount, keyword, raw_text}}
 │
 ├─► STEP 7: AiAnalysisStep
 │          └─► AiServiceInterface::analyzeDocument(markdown, documentType, keyDetails, balances)
 │             ├─► OpenRouterService::analyzeDocument() ──► HTTP to OpenRouter API
 │             │                                                    (falls back if unavailable)
 │             └─► Check: success=false OR transaction_summary=null OR credit_count=0
 │                 └─► If fallback needed: McaAiService::extractTransactionSummary()
 │                    (counts credits/debits from markdown transactions)
 │
 └─► runPostProcessing()
    ├─► McaDetectionService::detect(markdown, keyDetails, balances)
    │   ├─► scoreTransaction() for each transaction
    │   ├─► matchMcaProvider() (exact/fuzzy against data/mcas.json)
    │   ├─► High confidence (≥0.7): treat as MCA
    │   └─► Borderline (0.4-0.7): send to McaAiService::analyzeCandidates()
    │                                                       (AI review)
    │
    └─► TransactionClassificationService::detect(markdown)
        ├─► extractTransactions() from markdown lines
        └─► classify() each against 6 categories:
            [return, internal_transfer, wire, line_of_credit, lender, cash_app]
```

---

## Data Flow Summary

```
filePath → markdown + ocrText + pageCount
        → documentType (type + confidence)
        → keyDetails (array of {field, label, value, page, confidence})
        → scores (completeness, quality, pii_detection, overall)
        → piiBreakdown (which PII types found)
        → recommendations
        → balances (beginning + ending)
        → aiAnalysis (qualification, transaction_summary, risk_indicators)
        → mcaFindings (transactions, candidates, summary)
        → transactionClassification (tagged transactions + summary)
```

---

## Progress Percentage Mapping

| Step | Progress % | Label |
|------|------------|-------|
| DoclingExtraction | 10% | Extracting text from PDF... |
| TypeDetection | 35% | Detecting document type... |
| FieldMapping | 55% | Mapping key details... |
| Scoring | 75% | Analyzing extraction quality... |
| PiiDetection | 65% | Detecting PII... |
| BalanceExtraction | 80% | Extracting balances... |
| AiAnalysis | 85% | Running AI analysis... |
| MCA Detection | 92% | Detecting MCA transactions... |
| Txn Classification | 95% | Classifying transactions... |
| Complete | 100% | Done |

---

## Cache Stampede Protection

```
checkCache()
 └─► Cache::lock("lock_pdf_cache_{contentHash}", 30)
     └─► If acquired: Cache::get() + lock.release()
         If not acquired: wait (up to 30s) then return null (no blocking)
```

7-day cache TTL. Cache key = `pdf_cache_{md5_file(filePath)}`.

---

## Error Handling Flow

```
any step sets context.error → break loop
                                         └─► failJob()
                                              ├─► document.markAsFailed(error)
                                              ├─► batch.incrementCompleted()
                                              └─► Cache::put("extraction_progress_{jobId}" {status: 'failed'})
```

No error recovery mid-pipeline. Failure is terminal.