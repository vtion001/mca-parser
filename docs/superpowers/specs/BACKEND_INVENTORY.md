# Backend Inventory

## Controllers (8 files)

---

### AuthController
**File:** `backend/app/Http/Controllers/AuthController.php` (103 lines)

**Purpose:** Handles user authentication (register, login, logout, me)

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `register(Request $request)` | `Request $request` | `JsonResponse` | Register new user with account_id |
| `login(Request $request)` | `Request $request` | `JsonResponse` | Authenticate user, return Bearer token |
| `logout(Request $request)` | `Request $request` | `JsonResponse` | Revoke user's API token |
| `me(Request $request)` | `Request $request` | `JsonResponse` | Return current authenticated user |

**Dependencies:** `User` model, `Hash` facade

---

### BatchController
**File:** `backend/app/Http/Controllers/BatchController.php` (213 lines)

**Purpose:** CRUD and processing orchestration for document batches

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `index(Request $request)` | `Request $request` | `JsonResponse` | List batches with pagination |
| `store(Request $request)` | `Request $request` | `JsonResponse` | Create batch with document_ids |
| `show(Request $request, int $id)` | `Request $request, int $id` | `JsonResponse` | Get batch with documents |
| `addDocuments(Request $request, int $id)` | `Request $request, int $id` | `JsonResponse` | Add docs to pending batch |
| `startProcessing(int $id)` | `int $id` | `JsonResponse` | Dispatch jobs for all batch docs |
| `getProgress(int $id)` | `int $id` | `JsonResponse` | Get batch processing progress |

**Dependencies:** `Batch` model, `Document` model, `ProcessPdfExtraction` job

---

### ComparisonController
**File:** `backend/app/Http/Controllers/ComparisonController.php` (129 lines)

**Purpose:** Compare multiple documents (balances, risk, transactions, delta)

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `compare(Request $request)` | `Request $request` | `JsonResponse` | Dispatch to comparison type |

**Comparison Types:** `balances`, `risk`, `transactions`, `delta`

**Dependencies:** `Document` model

---

### DocumentController
**File:** `backend/app/Http/Controllers/DocumentController.php` (103 lines)

**Purpose:** CRUD operations for documents

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `index(Request $request)` | `Request $request` | `JsonResponse` | List documents with filters |
| `show(Request $request, string $id)` | `Request $request, string $id` | `JsonResponse` | Get document by id or filename |
| `destroy(Request $request, int $id)` | `Request $request, int $id` | `JsonResponse` | Delete document |
| `updateStatus(Request $request, int $id)` | `Request $request, int $id` | `JsonResponse` | Update document status |

**Dependencies:** `Document` model

---

### ExtractionController
**File:** `backend/app/Http/Controllers/ExtractionController.php` (73 lines)

**Purpose:** Async PDF extraction with job polling

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `fullExtract(Request $request)` | `Request $request` | `JsonResponse` | Upload PDF, create doc, dispatch job |
| `progress(string $jobId)` | `string $jobId` | `JsonResponse` | Poll job progress from cache |

**Dependencies:** `Document` model, `ProcessPdfExtraction` job, `Cache` facade, `Storage` facade

---

### HealthController
**File:** `backend/app/Http/Controllers/HealthController.php` (142 lines)

**Purpose:** Health and readiness checks

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `index()` | none | `JsonResponse` | Basic healthy response |
| `ready()` | none | `JsonResponse` | Check MySQL, Redis, Docling |
| `docling()` | none | `JsonResponse` | Docling-specific health check |

**Dependencies:** `DB` facade, `Cache` facade (Redis store)

---

### PdfController
**File:** `backend/app/Http/Controllers/PdfController.php` (117 lines)

**Purpose:** Synchronous PDF upload, analyze, and scrub

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `upload(Request $request)` | `Request $request` | `JsonResponse` | Extract text from uploaded PDF |
| `analyze(Request $request)` | `Request $request` | `JsonResponse` | Analyze PDF (word count, PII, confidence) |
| `scrub(Request $request)` | `Request $request` | `JsonResponse` | Remove PII from PDF text |

**Dependencies:** `DoclingService`, `PdfAnalyzerService`

---

### Controller (base)
**File:** `backend/app/Http/Controllers/Controller.php` (12 lines)

**Purpose:** Base controller with AuthorizesRequests, ValidatesRequests traits

---

## Services (12 files)

---

### BalanceExtractorService
**File:** `backend/app/Services/BalanceExtractorService.php` (227 lines)

**Purpose:** Extract beginning/ending balances from bank statement text

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `extractBalances(string $text)` | `string $text` | `array{beginning_balance, ending_balance}` | Extract both balances |

**Dependencies:** None (pure text processing)

---

### BaseAIService (abstract)
**File:** `backend/app/Services/BaseAIService.php` (291 lines)

**Purpose:** Abstract base for AI analysis with fallback behavior

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `analyzeDocument(string $markdown, array $documentType, array $keyDetails, array $balances)` | `string $markdown, array $documentType, array $keyDetails, array $balances` | `array` | Main analysis entry point |
| `quickQualification(string $markdown, array $documentType)` | `string $markdown, array $documentType` | `array` | Fast initial screening |
| `setLogger(LoggerInterface $logger)` | `LoggerInterface $logger` | `void` | Set logger |

**Abstract Methods:** `getProviderName()`, `getDefaultApiKey()`, `getDefaultApiUrl()`, `callApi(string $prompt)`

**Dependencies:** `LoggerInterface`

---

### DoclingService
**File:** `backend/app/Services/DoclingService.php` (88 lines)

**Purpose:** HTTP client to Python Docling service for PDF text extraction

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `extractText(string $filePath)` | `string $filePath` | `array{success, text, page_count, error?}` | Extract text from PDF file |
| `extractFromUrl(string $url)` | `string $url` | `array` | Extract text from URL |

**Dependencies:** `Http` facade, `Log` facade

---

### DocumentTypeDetector
**File:** `backend/app/Services/DocumentTypeDetector.php` (71 lines)

**Purpose:** Detect document type (bank_statement, invoice, contract, receipt, report, form)

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `detect(string $text)` | `string $text` | `array{type, confidence}` | Detect document type |

**Dependencies:** None (pure text processing)

---

### ExtractionScorer
**File:** `backend/app/Services/ExtractionScorer.php` (156 lines)

**Purpose:** Score extraction quality (completeness, quality, PII detection)

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `score(string $text, int $pageCount, array $piiDetected, array $piiPatterns)` | `string $text, int $pageCount, array $piiDetected, array $piiPatterns` | `array` | Overall and component scores |

**Dependencies:** None (pure text processing)

---

### FieldMapper
**File:** `backend/app/Services/FieldMapper.php` (144 lines)

**Purpose:** Map extracted fields based on document type using regex/keyword patterns

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `map(string $text, string $documentType)` | `string $text, string $documentType` | `array` | Extract typed fields from text |

**Dependencies:** `BankStatementTableParser`, `FieldValueCleaner`, `GarbageDetector`, `HeadingParser`

---

### McaAiService
**File:** `backend/app/Services/McaAiService.php` (381 lines)

**Purpose:** AI-powered MCA transaction detection (hybrid pre-filter + OpenRouter AI)

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `detect(string $markdown, array $keyDetails, array $balances)` | `string $markdown, array $keyDetails, array $balances` | `array` | Main MCA detection entry point |
| `analyzeCandidates(array $candidates, string $markdown)` | `array $candidates, string $markdown` | `array` | AI review of borderline candidates |
| `extractTransactionSummary(string $markdown)` | `string $markdown` | `array` | Extract transaction summary |

**Dependencies:** `McaDetectionService`, `OpenRouterService` (extends BaseAIService)

---

### McaDetectionService
**File:** `backend/app/Services/McaDetectionService.php` (704 lines)

**Purpose:** Pre-filtering MCA transaction detection with provider database

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `detect(string $markdown, array $keyDetails, array $balances)` | `string $markdown, array $keyDetails, array $balances` | `array` | Detect MCA transactions |
| `scoreTransaction(string $description)` | `string $description` | `float` | Score single transaction (0.0-1.0) |
| `matchMcaProvider(string $description)` | `string $description` | `array?` | Match against known providers |
| `loadProviders()` | none | `array` | Load MCA provider database |
| `extractTransactionSummary(string $markdown)` | `string $markdown` | `array` | Extract transaction summary |

**Dependencies:** `data/mcas.json` provider database file

---

### OpenRouterService
**File:** `backend/app/Services/OpenRouterService.php` (113 lines)

**Purpose:** OpenRouter API client for AI document analysis

**Public Methods:** Inherits `analyzeDocument()`, `quickQualification()` from `BaseAIService`

**Configuration:** `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (default: `google/gemini-3.1-pro-preview`)

**Dependencies:** `Http` facade, extends `BaseAIService`

---

### PdfAnalyzerService
**File:** `backend/app/Services/PdfAnalyzerService.php` (83 lines)

**Purpose:** Regex-based PII detection and scrubbing

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `analyze(string $text)` | `string $text` | `array{word_count, char_count, has_pii_indicators, confidence_score}` | Analyze text |
| `scrub(string $text, bool $removePii)` | `string $text, bool $removePii` | `string` | Remove/replace PII patterns |
| `checkPiiIndicators(string $text)` | `string $text` | `bool` | Check for PII keywords |

**Dependencies:** `PiiPatterns`

---

### PiiPatterns
**File:** `backend/app/Services/PiiPatterns.php` (46 lines)

**Purpose:** Shared PII regex pattern definitions

**Constants:**
| Constant | Pattern | Scrub Replacement |
|----------|---------|-----------------|
| `SSN` | `/\d{3}-\d{2}-\d{4}/` | `[SSN]` |
| `EMAIL` | `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/` | `[EMAIL]` |
| `PHONE` | US phone pattern | `[PHONE]` |
| `CREDIT_CARD` | 13-19 digit card pattern | `[CARD]` |
| `DATE` | MM/DD/YYYY pattern | `[DATE]` |
| `ROUTING_NUMBER` | 9-digit ABA pattern | `[ROUTING]` |

**Dependencies:** None (constants only)

---

### TransactionClassificationService
**File:** `backend/app/Services/TransactionClassificationService.php` (469 lines)

**Purpose:** Classify transactions into categories (RETURN, INTERNAL_TRANSFER, WIRE, LINE_OF_CREDIT, LENDER, CASH_APP)

**Public Methods:**
| Method | Params | Return | Purpose |
|--------|--------|--------|---------|
| `classify(string $description, ?float $amount)` | `string $description, ?float $amount` | `array` | Classify single transaction |
| `classifyBatch(array $transactions)` | `array $transactions` | `array` | Classify multiple transactions |
| `detect(string $markdown)` | `string $markdown` | `array` | Extract and classify from markdown |

**Dependencies:** None (pure text processing)

---

## Jobs (1 file)

---

### ProcessPdfExtraction
**File:** `backend/app/Jobs/ProcessPdfExtraction.php` (360 lines)

**Purpose:** Async job orchestrating the full PDF extraction pipeline

**Queue Config:** `$tries = 5`, `$backoff = 60`, `$timeout = 900`

**Pipeline Steps:**
1. Cache lookup (with stampede protection lock)
2. Document status update to "processing"
3. Docling text extraction
4. OCR text extraction (from images)
5. Document type detection
6. Field mapping
7. PII detection
8. Extraction scoring
9. Balance extraction
10. AI analysis (OpenRouter)
11. MCA detection (hybrid)
12. Transaction classification
13. Result caching + DB persistence

**Public Methods:** None (Laravel job with `handle()`)

**Dependencies:** `DoclingService`, `DocumentTypeDetector`, `FieldMapper`, `ExtractionScorer`, `PdfAnalyzerService`, `BalanceExtractorService`, `OpenRouterService`, `McaAiService`, `TransactionClassificationService`, `PiiPatterns`, `Document` model, `Batch` model

---

## Models (5 files)

---

### Account
**File:** `backend/app/Models/Account.php` (39 lines)

**Purpose:** Multi-tenant account entity

**Relations:** `hasMany(Document)`, `hasMany(Batch)`, `hasMany(User)`

---

### Batch
**File:** `backend/app/Models/Batch.php` (73 lines)

**Purpose:** Document batch grouping and processing state

**Constants:** `STATUS_PENDING`, `STATUS_PROCESSING`, `STATUS_COMPLETE`, `STATUS_FAILED`

**Methods:** `incrementCompleted()`, `markAsProcessing()`, `markAsFailed()`, `getProgressPercent()`

**Relations:** `belongsTo(Account)`, `belongsToMany(Document)`

---

### Document
**File:** `backend/app/Models/Document.php` (82 lines)

**Purpose:** PDF document with extraction results

**Constants:** `STATUS_PENDING`, `STATUS_PROCESSING`, `STATUS_COMPLETE`, `STATUS_FAILED`

**Casts:** `key_details`, `scores`, `pii_breakdown`, `recommendations`, `balances`, `ai_analysis`, `mca_findings` as arrays

**Methods:** `isProcessable()`, `markAsProcessing()`, `markAsComplete()`, `markAsFailed()`

**Relations:** `belongsTo(Account)`, `belongsToMany(Batch)`

---

### User
**File:** `backend/app/Models/User.php` (50 lines)

**Purpose:** Authenticated user with API token

**Methods:** `regenerateToken()`, `clearToken()`

**Hidden:** `password`, `api_token`

**Relations:** `belongsTo(Account)`

---

## Routes (2 files)

---

### api.php
**File:** `backend/routes/api.php` (53 lines)

**Route Groups:**
- `/api/v1/health`, `/api/v1/health/ready`, `/api/v1/health/docling` (public)
- `/api/v1/auth/register`, `/api/v1/auth/login` (public)
- `/api/v1/auth/logout`, `/api/v1/auth/me` (auth required)
- `/api/v1/pdf/*` (auth + account middleware)
- `/api/v1/documents/*` (auth + account middleware)
- `/api/v1/batches/*` (auth + account middleware)
- `/api/v1/documents/compare` (auth + account middleware)

---

### console.php
**File:** `backend/routes/console.php`

*(Standard Laravel console routes - not reviewed)*

---

## Summary

| Category | Count |
|----------|-------|
| Controllers | 8 |
| Services | 12 |
| Jobs | 1 |
| Models | 5 |
| Routes | 2 |
| **Total** | **28** |
