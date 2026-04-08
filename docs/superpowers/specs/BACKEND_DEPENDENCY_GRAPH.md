# Backend Dependency Graph

## Controller -> Service Dependencies

```
PdfController
├── DoclingService ──► HTTP call to python-service:8001
└── PdfAnalyzerService ──► PiiPatterns (static)

ExtractionController
├── Document (Model)
└── ProcessPdfExtraction (Job)

BatchController
├── Batch (Model)
├── Document (Model)
└── ProcessPdfExtraction (Job)

DocumentController
└── Document (Model)

ComparisonController
└── Document (Model)

AuthController
└── User (Model)

HealthController
├── DB (facade)
└── Cache/Redis (facade)
```

## ProcessPdfExtraction Job Pipeline

```
ProcessPdfExtraction (Job)
│
├── DoclingService ──► HTTP to :8001
│   └── Returns: {text, page_count, ocr_text}
│
├── DocumentTypeDetector
│   └── Returns: {type, confidence}
│
├── FieldMapper
│   ├── BankStatementTableParser
│   ├── FieldValueCleaner
│   ├── GarbageDetector
│   └── HeadingParser
│   └── Returns: [{field, label, value, page, confidence}]
│
├── PdfAnalyzerService
│   └── Returns: {word_count, char_count, has_pii_indicators, confidence_score}
│
├── ExtractionScorer
│   └── Returns: {scores, pii_breakdown, recommendations}
│
├── BalanceExtractorService
│   └── Returns: {beginning_balance, ending_balance}
│
├── OpenRouterService (extends BaseAIService)
│   └── HTTP to openrouter.ai/api/v1
│   └── Returns: {analysis: {qualification_score, completeness, pii_found, ...}}
│
├── McaAiService (extends BaseAIService)
│   ├── McaDetectionService
│   │   └── data/mcas.json (provider DB)
│   └── HTTP to openrouter.ai/api/v1 (for borderline candidates)
│   └── Returns: {transactions, candidates_reviewed, summary}
│
├── TransactionClassificationService
│   └── Returns: {transactions: [...], summary: {...}}
│
├── PiiPatterns (static constants)
│
└── Document/Batch (Models) ──► Database persistence
```

## Service -> Service Dependencies

```
BaseAIService (abstract)
├── getProviderName() [abstract]
├── getDefaultApiKey() [abstract]
├── getDefaultApiUrl() [abstract]
├── callApi(string $prompt) [abstract]
├── analyzeDocument() ──► buildPrompt() + callApi()
├── quickQualification() ──► callApi()
├── parseResponse() ──► JSON parsing with markdown code block handling
└── getFallbackAnalysis() ──► Basic analysis when API unavailable

OpenRouterService extends BaseAIService
├── Http facade ──► openrouter.ai/api/v1
└── inherits: analyzeDocument(), quickQualification()

McaAiService extends BaseAIService
├── Http facade ──► openrouter.ai/api/v1
├── McaDetectionService
│   └── data/mcas.json
├── OpenRouterService (inherits callApi via parent)
└── inherits: analyzeDocument()

McaDetectionService
├── data/mcas.json (MCA provider database)
├── Transaction parsing (internal)
├── Fuzzy matching with equivalence groups
└── Keyword scoring

FieldMapper
├── BankStatementTableParser
├── FieldValueCleaner
├── GarbageDetector
└── HeadingParser

PdfAnalyzerService
└── PiiPatterns (static)

DoclingService
└── HTTP facade ──► :8001/docling
```

## Data Flow Summary

```
HTTP Request
    │
    ▼
[Laravel Route] ──auth.api middleware──► [AccountMiddleware]
    │                                              │
    ▼                                              ▼
[Controller] ────────────────────────────────► [Service(s)]
    │                                              │
    ▼                                              ▼
[Job Dispatch (async)]                     [HTTP to External Services]
    │                                              │
    ▼                                              ▼
[Queue Worker] ◄─────────────────────────── [Docling :8001]
    │                                    [OpenRouter API]
    ▼                                    [data/mcas.json]
[ProcessPdfExtraction::handle()]          [Redis Cache]
    │
    ├──► DoclingService
    ├──► DocumentTypeDetector
    ├──► FieldMapper
    ├──► ExtractionScorer
    ├──► PdfAnalyzerService
    ├──► BalanceExtractorService
    ├──► OpenRouterService
    ├──► McaAiService
    │       └──► McaDetectionService
    │               └──► data/mcas.json
    └──► TransactionClassificationService
            │
            ▼
        [Document Model] ──► Supabase PostgreSQL
        [Cache] ──► Redis
```

## PiiPatterns (leaf - no dependencies)

```
PiiPatterns
├── SSN constant
├── EMAIL constant
├── PHONE constant
├── CREDIT_CARD constant
├── DATE constant
├── ROUTING_NUMBER constant
├── ALL map
└── SCRUB_MAP
```
