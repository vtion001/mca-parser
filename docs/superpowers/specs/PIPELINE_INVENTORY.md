# Pipeline Inventory

Complete audit of all pipeline orchestration classes, step implementations, and supporting services.

---

## Pipeline Core (3 files)

### `PdfExtractionPipeline`
**File:** `backend/app/Jobs/Pipeline/PdfExtractionPipeline.php` — 297 lines

**Purpose:** Orchestrates the full PDF extraction pipeline by executing registered steps in order.

**Public Methods:**
- `execute(string $jobId, string $filePath, ?int $documentId = null, ?int $batchId = null): array` — Run the full pipeline and return result array
- Constructor accepts: `ExtractionServiceInterface`, `DocumentTypeDetector`, `FieldMapper`, `PdfAnalyzerService`, `BalanceExtractorService`, `AiServiceInterface`, `McaAiService`, `TransactionClassificationService`, `ExtractionScorer`

**Pipeline Steps Registered (in order):**
1. `docling` → `DoclingExtractionStep`
2. `type_detection` → `TypeDetectionStep`
3. `field_mapping` → `FieldMappingStep`
4. `scoring` → `ScoringStep`
5. `pii_detection` → `PiiDetectionStep`
6. `balance_extraction` → `BalanceExtractionStep`
7. `ai_analysis` → `AiAnalysisStep`

**Key Behaviors:**
- Cache stampede protection via `Cache::lock()` before `Cache::get()`
- Falls back to cached results if already computed (7-day TTL)
- Marks document as processing/complete/failed
- Post-processing: runs `mcaAiService->detect()` and `txnClassifier->detect()`
- Updates progress via `Cache::put("extraction_progress_{$jobId}", ...)` and `Cache::put("extraction_result_{$jobId}", ...)` — 24-hour TTL

---

### `PipelineContext`
**File:** `backend/app/Jobs/Pipeline/PipelineContext.php` — 59 lines

**Purpose:** Immutable-ish result object passed between pipeline steps.

**Properties:**
- `jobId: string`
- `filePath: string`
- `documentId: ?int`
- `batchId: ?int`
- `markdown: string` (extracted text)
- `ocrText: string` (OCR from images)
- `pageCount: int`
- `documentType: array{type: string, confidence: float}`
- `keyDetails: array`
- `balances: array{beginning_balance: array, ending_balance: array}`
- `scores: array{completeness: float, quality: float, pii_detection: float, overall: float}`
- `piiBreakdown: array`
- `recommendations: array`
- `aiAnalysis: array`
- `mcaFindings: array`
- `transactionClassification: array`
- `cached: bool`
- `error: ?string`

**Public Methods:**
- `toResultArray(): array` — Serialize context to result array for API response

---

### `PipelineStepInterface`
**File:** `backend/app/Jobs/Pipeline/PipelineStepInterface.php` — 23 lines

**Purpose:** Base interface for all pipeline steps.

**Methods:**
- `handle(PipelineContext $context, callable $updateProgress): void`
- `getName(): string`

---

## Pipeline Steps (7 files)

### `DoclingExtractionStep`
**File:** `backend/app/Jobs/Pipeline/Steps/DoclingExtractionStep.php` — 40 lines

**Purpose:** Extract text from PDF via Docling service (with OCR fallback for images).

**Dependencies:** `ExtractionServiceInterface` (→ `DoclingService`)

**handle():**
1. Calls `$extractionService->extractText($context->filePath)`
2. Sets `$context->markdown`, `$context->ocrText`, `$context->pageCount`
3. Appends OCR content to markdown if present
4. Sets `$context->error` on failure

---

### `TypeDetectionStep`
**File:** `backend/app/Jobs/Pipeline/Steps/TypeDetectionStep.php` — 26 lines

**Purpose:** Detect document type (bank_statement, invoice, contract, receipt, report, form, unknown).

**Dependencies:** `DocumentTypeDetector`

**handle():** Calls `$typeDetector->detect($context->markdown)`, sets `$context->documentType`

---

### `FieldMappingStep`
**File:** `backend/app/Jobs/Pipeline/Steps/FieldMappingStep.php` — 29 lines

**Purpose:** Extract key details from markdown based on detected document type.

**Dependencies:** `FieldMapper`

**handle():** Calls `$fieldMapper->map($context->markdown, $context->documentType['type'])`, sets `$context->keyDetails`

---

### `ScoringStep`
**File:** `backend/app/Jobs/Pipeline/Steps/ScoringStep.php` — 36 lines

**Purpose:** Score extraction quality (completeness, quality, PII detection) and generate recommendations.

**Dependencies:** `ExtractionScorer`, `PiiPatterns`

**handle():**
- Calls `$scorer->score($context->markdown, $context->pageCount, $context->piiBreakdown, PiiPatterns::ALL)`
- Sets `$context->scores`, `$context->piiBreakdown`, `$context->recommendations`

---

### `PiiDetectionStep`
**File:** `backend/app/Jobs/Pipeline/Steps/PiiDetectionStep.php` — 34 lines

**Purpose:** Detect PII indicators (SSN, email, phone, credit_card, date, routing_number) in markdown.

**Dependencies:** `PdfAnalyzerService`, `PiiPatterns`

**handle():**
- Calls `$analyzerService->checkPiiIndicators($context->markdown)`
- If PII found: sets `$context->piiBreakdown = array_keys(PiiPatterns::ALL)`
- Else: sets `$context->piiBreakdown = []`

---

### `BalanceExtractionStep`
**File:** `backend/app/Jobs/Pipeline/Steps/BalanceExtractionStep.php` — 26 lines

**Purpose:** Extract beginning and ending balances from bank statements.

**Dependencies:** `BalanceExtractorService`

**handle():** Calls `$balanceExtractor->extractBalances($context->markdown)`, sets `$context->balances`

---

### `AiAnalysisStep`
**File:** `backend/app/Jobs/Pipeline/Steps/AiAnalysisStep.php` — 52 lines

**Purpose:** Run AI analysis on document, with fallback to `McaAiService` transaction summary if AI fails or returns zero credit count.

**Dependencies:** `AiServiceInterface` (→ `OpenRouterService`), `McaAiService`

**handle():**
1. Calls `$aiService->analyzeDocument($context->markdown, $context->documentType, $context->keyDetails, $context->balances)`
2. Checks if `success=false` OR `transaction_summary` is null OR `credit_count === 0`
3. If fallback needed: calls `$mcaAiService->extractTransactionSummary($context->markdown)`
4. Attaches computed summary to `aiAnalysis['analysis']['transaction_summary']`
5. Sets `aiAnalysis['fallback_transaction_summary'] = true` if AI partially succeeded

---

## Supporting Services (16 files)

### `DoclingService`
**File:** `backend/app/Services/DoclingService.php` — 88 lines

**Purpose:** HTTP client for the Python Docling service (FastAPI on port 8001).

**Public Methods:**
- `extractText(string $filePath): array` — Upload PDF, retry 3x on 502, 600s timeout, returns `{success, text?, ocr_text?, page_count?, error?}`
- `extractFromUrl(string $url): array` — Extract from URL (120s timeout)

**Retry Logic:** `Http::timeout(600)->retry(3, 5000)` for transient 502 errors from worker crashes.

---

### `DocumentTypeDetector`
**File:** `backend/app/Services/DocumentTypeDetector.php` — 71 lines

**Purpose:** Keyword-based document type detection (bank_statement, invoice, contract, receipt, report, form).

**Public Methods:**
- `detect(string $text): array{type: string, confidence: float}` — Scores against 7 type schemas with weighted keywords

**Key:** `bank_statement` has weight 1.5, includes 15+ keywords (beginning balance, ending balance, electronic credits, etc.)

---

### `PdfAnalyzerService`
**File:** `backend/app/Services/PdfAnalyzerService.php` — 83 lines

**Purpose:** Analyze text for word/char count, PII indicators, and confidence score.

**Public Methods:**
- `analyze(string $text): array` — Returns `{word_count, char_count, has_pii_indicators, confidence_score}`
- `scrub(string $text, bool $removePii = true): string` — Replaces PII patterns with `[SSN]`, `[EMAIL]`, etc. using `PiiPatterns::SCRUB_MAP`
- `checkPiiIndicators(string $text): bool` — Keyword scan (ssn, social security, password, credit card, etc.)

---

### `BalanceExtractorService`
**File:** `backend/app/Services/BalanceExtractorService.php` — 227 lines

**Purpose:** Extract beginning and ending balances from bank statement text.

**Public Methods:**
- `extractBalances(string $text): array{beginning_balance: array, ending_balance: array}` — Each entry has `{amount: float|null, keyword: string|null, raw_text: string|null}`

**Amount Pattern:** `/ -?\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-? /` handles `1,234.56`, `-1,234.56`, `1234.56-`, `-$1,234.56`, `$1,234.56`

**Key Behavior:** Finds largest amount in line (skips < $1), searches next line if keyword found but no amount on current line.

---

### `ExtractionScorer`
**File:** `backend/app/Services/ExtractionScorer.php` — 156 lines

**Purpose:** Score extraction quality and PII detection completeness.

**Public Methods:**
- `score(string $text, int $pageCount, array $piiDetected, array $piiPatterns): array` — Returns `{scores: {completeness, quality, pii_detection, overall}, pii_breakdown, recommendations}`

**Scoring:** `overall = (0.4 * completeness) + (0.35 * quality) + (0.25 * pii_detection)`

---

### `FieldMapper`
**File:** `backend/app/Services/FieldMapper.php` — 144 lines

**Purpose:** Map extracted fields from markdown based on document type.

**Public Methods:**
- `map(string $text, string $documentType): array` — Returns array of field objects with `{field, label, value, page, confidence, matched_pattern}`

**Field Schemas:** `invoice`, `contract`, `receipt`, `bank_statement`, `generic`

**Key Behavior:**
- For `bank_statement`: also runs `BankStatementTableParser` + `HeadingParser`, merges results avoiding duplicates
- Skips garbage values via `GarbageDetector` for date fields
- Regex patterns: anchored with `/pattern/` syntax, capture groups preferred over full match

---

### `PiiPatterns`
**File:** `backend/app/Services/PiiPatterns.php` — 47 lines

**Purpose:** Shared PII regex pattern definitions.

**Patterns:**
- `SSN`: `/(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/` — strict XXX-XX-XXXX with word boundaries
- `EMAIL`: `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/`
- `PHONE`: `/(?<!\d)(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]+\d{3}[-.\s]+\d{4}(?!\d)/` — US-style with separators
- `CREDIT_CARD`: `/(?<!\d)\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}(?!\d)/`
- `DATE`: `/(?<!\d)(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}(?!\d)/` — MM/DD/YYYY
- `ROUTING_NUMBER`: `/(?<!\d)\d{9}(?!\d)/` — 9-digit ABA

**SCRUB_MAP:** Maps each pattern to `[SSN]`, `[EMAIL]`, `[PHONE]`, `[CARD]`, `[DATE]`, `[ROUTING]`

---

### `McaDetectionService`
**File:** `backend/app/Services/McaDetectionService.php` — 704 lines

**Purpose:** Hybrid pre-filtering for MCA (Merchant Cash Advance) transaction detection.

**Public Methods:**
- `detect(string $markdown, array $keyDetails = [], array $balances = []): array` — Main entry point; returns `{transactions: [], candidates: [], summary: {}}`
- `scoreTransaction(string $description): float` — Returns 0.0-1.0 MCA likelihood score
- `matchMcaProvider(string $description): ?array` — Exact/fuzzy match against loaded providers
- `extractTransactionSummary(string $markdown): array` — Fallback transaction counting when AI unavailable; returns `{credit_count, debit_count, total_amount_credits, total_amount_debits}`

**Key Behaviors:**
- Loads providers from `data/mcas.json` (abbreviation-based fuzzy matching)
- Excludes payment processors (Stripe, Square, etc.) unless they match MCA product patterns (PayPal Working Capital, Stripe Capital)
- Candidates with score 0.4-0.7 sent for AI review; ≥0.7 treated as high-confidence MCA
- `scoreTransaction()`: 0.25 per strong keyword, 0.1 per weak keyword (only if strong present), +0.15 bonus for ≥2 strong keywords, +0.3 for `\bmca\b`

---

### `McaAiService`
**File:** `backend/app/Services/McaAiService.php` — 381 lines

**Purpose:** AI-powered MCA validation using OpenRouter (Gemini). Extends `BaseAIService`.

**Public Methods:**
- `detect(string $markdown, array $keyDetails = [], array $balances = []): array` — Main entry point combining pre-filter + AI review
- `analyzeCandidates(array $candidates, string $markdown = ''): array` — AI review of borderline candidates
- `extractTransactionSummary(string $markdown): array` — Delegates to `McaDetectionService`

**Key Behaviors:**
- Uses Gemini 3.1 Pro (`config('services.openrouter.model', 'google/gemini-3.1-pro-preview')`)
- Temperature 0.1, max_tokens 1500 for candidate analysis
- Falls back to heuristic when AI unavailable
- `analyzeCandidates()` only called if candidates exist and API key is configured

---

### `BaseAIService`
**File:** `backend/app/Services/BaseAIService.php` — 291 lines

**Purpose:** Abstract base for AI document analysis. Provides prompt building, JSON parsing, and graceful fallback when API unavailable.

**Public Methods:**
- `analyzeDocument(string $markdown, array $documentType, array $keyDetails, array $balances): array` — Main entry point; calls `callApi()` or fallback
- `quickQualification(string $markdown, array $documentType): array` — Fast initial screening

**Abstract Methods:** `getProviderName()`, `getDefaultApiKey()`, `getDefaultApiUrl()`, `callApi(string $prompt): array`

**Fallback Analysis:** Returns `success: false` with `qualification_score: 5`, `transaction_summary` with `credit_count: null, debit_count: null` (no dollar summing), and `recommendations: ['Configure {provider} API key...']`

---

### `OpenRouterService`
**File:** `backend/app/Services/OpenRouterService.php` — 113 lines

**Purpose:** OpenRouter API client. Extends `BaseAIService`.

**Inheritance:** Extends `BaseAIService`, implements `AiServiceInterface`

**callApi():** Uses `google/gemini-3.1-pro-preview` by default, temperature 0.3, max_tokens 2000.

---

### `TransactionClassificationService`
**File:** `backend/app/Services/TransactionClassificationService.php` — 469 lines

**Purpose:** Classify bank statement transactions (RETURN, INTERNAL_TRANSFER, WIRE, LINE_OF_CREDIT, LENDER, CASH_APP).

**Public Methods:**
- `classify(string $description, ?float $amount = null): array` — Single transaction classification
- `classifyBatch(array $transactions): array` — Batch classification with summary
- `detect(string $markdown): array` — Extract and classify all transactions from markdown

**Classification Keywords:** 60+ keywords across 6 categories (return, internal transfer, wire, LOC/loan, lender, cash app)

---

### `BankStatementTableParser`
**File:** `backend/app/Services/FieldMappers/BankStatementTableParser.php` — 131 lines

**Purpose:** Parse markdown table rows for bank statement field extraction.

**Public Methods:**
- `extractBankStatementTableFields(string $text): array` — Returns `{field, label, value}` objects
- `detectBankFieldName(string $cell): ?string` — Maps label cells to field names

**Table Format Detection:** Format A (date in first cell) vs Format B (label from start) detected by checking if first cell is pure numeric/date.

---

### `HeadingParser`
**File:** `backend/app/Services/FieldMappers/HeadingParser.php` — 55 lines

**Purpose:** Extract bank statement fields from non-table section headings (account number, statement period, bank name).

**Public Methods:**
- `extractBankHeadingFields(string $text): array` — Regex-based extraction from `##`-style headings

---

### `FieldValueCleaner`
**File:** `backend/app/Services/FieldMappers/FieldValueCleaner.php` — 39 lines

**Purpose:** Clean field values extracted from table cells (strips "Label | " prefix, handles accounting format `(123.45)` → `-123.45`).

**Public Methods:**
- `cleanFieldValue(string $fieldName, string $value): string`

---

### `GarbageDetector`
**File:** `backend/app/Services/FieldMappers/GarbageDetector.php` — 38 lines

**Purpose:** Identify reconciliation boilerplate text that should be filtered out.

**Public Methods:**
- `isGarbageValue(string $value): bool` — Returns true if value contains boilerplate phrases or is >150 chars without money format

---

## Interfaces (2 files)

### `ExtractionServiceInterface`
**File:** `backend/app/Services/Interfaces/ExtractionServiceInterface.php` — 25 lines

**Methods:** `extractText(string $filePath): array`

### `AiServiceInterface`
**File:** `backend/app/Services/Interfaces/AiServiceInterface.php` — 31 lines

**Methods:** `analyzeDocument(string $markdown, array $documentType, array $keyDetails, array $balances): array`

---

## Stub Classes (4 files, namespace aliases)

`Analysis\BalanceExtractorService`, `Analysis\DocumentTypeDetector`, `Analysis\ExtractionScorer`, `Analysis\PdfAnalyzerService`, `Extraction\FieldMapper`, `Patterns\PiiPatterns` — all extend the root namespace originals for Mockery compatibility.

---

## Summary

| Category | Count |
|----------|-------|
| Pipeline Core | 3 |
| Pipeline Steps | 7 |
| Core Services | 9 (Docling, DocumentType, PdfAnalyzer, BalanceExtractor, ExtractionScorer, FieldMapper, PiiPatterns, McaDetection, McaAi, TransactionClassification, BaseAIService, OpenRouterService) |
| Field Mappers | 4 |
| Interfaces | 2 |
| Stubs | 6 |
| **Total** | **33 files** |