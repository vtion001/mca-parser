# PDF Extraction View & Scoring Design

## Overview

Add progressive extraction feedback, raw markdown view, key details mapping, and accuracy scoring to the MCA PDF Scrubber application.

## Architecture

```
React Frontend (Port 5173) → Laravel API (Port 8000) → Python Docling Service (Port 8001)
```

### New Data Flow

1. User uploads PDF via React frontend
2. Frontend polls `/api/v1/pdf/progress/{jobId}` for stage updates
3. Laravel creates async job, returns `jobId` immediately
4. Python Docling extracts text → returns markdown
5. Laravel analyzes: document type detection, field mapping, scoring
6. Frontend displays: stages → markdown preview → key details → scores + recommendations

---

## Processing Pipeline

### Stages (for progressive feedback)

| Stage | Description |
|-------|-------------|
| `uploading` | File transfer to backend |
| `extracting` | Docling processes PDF, text streams |
| `detecting_type` | ML/heuristic document classification |
| `mapping_fields` | Key details extraction |
| `analyzing_quality` | Scoring computation |
| `complete` | All done |

### New Endpoints

#### `POST /api/v1/pdf/full-extract`
Starts async extraction job, returns `jobId` immediately.

**Request:** `multipart/form-data` with `file` field

**Response:**
```json
{
  "success": true,
  "job_id": "uuid-string",
  "status": "processing"
}
```

#### `GET /api/v1/pdf/progress/{jobId}`
Poll for job status and stage updates.

**Response:**
```json
{
  "job_id": "uuid-string",
  "status": "processing|complete|failed",
  "stage": "extracting",
  "stage_label": "Extracting text...",
  "progress_percent": 45,
  "current_markdown": "...partial markdown...",
  "result": null
}
```

When `status: complete`:
```json
{
  "job_id": "uuid-string",
  "status": "complete",
  "stage": "complete",
  "stage_label": "Done",
  "progress_percent": 100,
  "current_markdown": null,
  "result": {
    "markdown": "# Full markdown...",
    "document_type": { "type": "invoice", "confidence": 0.87 },
    "key_details": [...],
    "scores": {...},
    "recommendations": [...]
  }
}
```

---

## Document Type Detection

### Supported Types
- `invoice` - vendor, amount, date, invoice number
- `contract` - parties, effective date, terms, signatures
- `receipt` - merchant, date, items, total
- `report` - title, sections, findings
- `form` - labeled fields and values
- `unknown` - generic document

### Detection Heuristics
1. Keyword matching (invoice keywords: "invoice #", "bill to", "total due")
2. Structural analysis (has tables, headers, line items)
3. Confidence score based on match strength

---

## Key Details Mapping

### Field Schema by Document Type

```php
$fieldSchemas = [
    'invoice' => [
        ['name' => 'vendor', 'label' => 'Vendor', 'patterns' => ['vendor', 'bill to', 'from:']],
        ['name' => 'amount', 'label' => 'Amount', 'patterns' => ['total', 'amount due', '\$[\d,]+\.\d{2}']],
        ['name' => 'date', 'label' => 'Date', 'patterns' => ['date', '\d{1,2}/\d{1,2}/\d{2,4}']],
        ['name' => 'invoice_number', 'label' => 'Invoice #', 'patterns' => ['invoice', 'inv-']],
    ],
    'contract' => [
        ['name' => 'parties', 'label' => 'Parties', 'patterns' => ['agreement between', 'party of the first']],
        ['name' => 'effective_date', 'label' => 'Effective Date', 'patterns' => ['effective', 'dated']],
        ['name' => 'terms', 'label' => 'Terms', 'patterns' => ['term', 'period', 'duration']],
    ],
    // ... other types
    'generic' => [
        ['name' => 'name', 'label' => 'Name', 'patterns' => ['name', 'person']],
        ['name' => 'email', 'label' => 'Email', 'patterns' => ['[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}']],
        ['name' => 'phone', 'label' => 'Phone', 'patterns' => ['\d{3}[-.\s]?\d{3}[-.\s]?\d{4}']],
        ['name' => 'date', 'label' => 'Date', 'patterns' => ['\d{1,2}/\d{1,2}/\d{2,4}']],
    ],
];
```

### Key Detail Object
```json
{
  "field": "vendor",
  "label": "Vendor",
  "value": "Acme Corporation",
  "page": 1,
  "confidence": 0.92,
  "matched_pattern": "bill to"
}
```

---

## Accuracy Scoring

### Score Components

| Score | Weight | Calculation | Threshold |
|-------|--------|-------------|-----------|
| **Completeness** | 40% | `(pages_extracted / expected_pages) * structural_integrity` | ≥80% Good |
| **Quality** | 35% | `text_coherence * formatting_preservation * (1 - garbled_ratio)` | ≥75% Good |
| **PII Detection** | 25% | `(true_positives) / (true_positives + false_negatives)` | ≥85% Good |
| **Overall** | - | `0.4*completeness + 0.35*quality + 0.25*pii` | ≥80% Acceptable |

### Scoring Details

**Completeness Score:**
- Page count matches expected (some PDFs have blank pages)
- No truncation detected (text ends naturally vs. cut off)
- Headers/footers detected and captured

**Quality Score:**
- Text coherence: ratio of valid words (no garbled characters)
- Formatting preservation: markdown structure (headers, lists, tables) intact
- Garbled ratio: characters that don't form valid text

**PII Detection Score:**
- Uses existing `checkPiiIndicators()` method
- Counts detected PII patterns
- Compares against a validation set (known PII in test docs)

### Score Display with Thresholds

| Overall Score | Status | Indicator |
|--------------|--------|-----------|
| ≥80% | Acceptable | ✓ (green) |
| 60-79% | Review Suggested | ⚠ (yellow) |
| <60% | Needs Review | ✗ (red) |

---

## Recommendations

Generated based on score analysis:

```php
$recommendations = [
    ['type' => 'quality', 'message' => 'Low text quality on page 3 - possible scan artifact'],
    ['type' => 'structure', 'message' => '2 dates detected but format inconsistent'],
    ['type' => 'completeness', 'message' => 'Page 5 appears blank - verify content'],
];
```

### Recommendation Types
- `quality` - Text coherence/formatting issues
- `completeness` - Missing or truncated content
- `pii` - PII detection concerns
- `structure` - Document structure issues

---

## Frontend Components

### New Components

1. **`ExtractionProgress`** - Shows current stage with progress bar and streaming markdown preview
2. **`MarkdownViewer`** - Collapsible raw markdown display with syntax highlighting
3. **`KeyDetailsPanel`** - Auto-detected fields in table format
4. **`ScoreCard`** - Individual score display with threshold indicator
5. **`ScoreDashboard`** - Overall + breakdown scores + recommendations

### State Management

```typescript
interface ExtractionState {
  jobId: string | null;
  status: 'idle' | 'processing' | 'complete' | 'failed';
  stage: string;
  stageLabel: string;
  progressPercent: number;
  currentMarkdown: string;
  result: ExtractionResult | null;
  error: string | null;
}

interface ExtractionResult {
  markdown: string;
  documentType: { type: string; confidence: number };
  keyDetails: KeyDetail[];
  scores: {
    completeness: number;
    quality: number;
    piiDetection: number;
    overall: number;
  };
  recommendations: Recommendation[];
}
```

### Polling Strategy
- Poll `/progress/{jobId}` every 500ms during processing
- Stop polling when `status: complete` or `status: failed`
- Debounce markdown updates to prevent excessive renders

---

## Backend Changes

### Laravel Changes

1. **New Job:** `ProcessPdfExtraction` - async queue job for full extraction
2. **New Service:** `DocumentTypeDetector` - classifies documents
3. **New Service:** `FieldMapper` - extracts key details based on type
4. **New Service:** `ExtractionScorer` - computes accuracy scores
5. **New Controller:** `ExtractionController` - handles full-extract and progress endpoints
6. **Cache:** Store job results in cache with TTL

### File Changes

```
backend/
├── app/
│   ├── Http/Controllers/
│   │   └── ExtractionController.php  [NEW]
│   ├── Jobs/
│   │   └── ProcessPdfExtraction.php  [NEW]
│   └── Services/
│       ├── DocumentTypeDetector.php  [NEW]
│       ├── FieldMapper.php           [NEW]
│       └── ExtractionScorer.php      [NEW]
routes/
└── api.php  [MODIFY - add extraction routes]
```

### Python Service Changes

- Add `markdown` field to extraction response (already available via `export_to_markdown()`)
- Optional: Add SSE endpoint for real-time streaming (future enhancement)

---

## File Summary

### Backend (PHP/Laravel)
| File | Action | Description |
|------|--------|-------------|
| `app/Http/Controllers/ExtractionController.php` | New | Handles full-extract and progress endpoints |
| `app/Jobs/ProcessPdfExtraction.php` | New | Async job for PDF processing pipeline |
| `app/Services/DocumentTypeDetector.php` | New | Document type classification |
| `app/Services/FieldMapper.php` | New | Key details extraction |
| `app/Services/ExtractionScorer.php` | New | Accuracy scoring |
| `routes/api.php` | Modify | Add extraction routes |

### Frontend (React/TypeScript)
| File | Action | Description |
|------|--------|-------------|
| `src/components/ExtractionProgress.tsx` | New | Progress + streaming preview |
| `src/components/MarkdownViewer.tsx` | New | Collapsible markdown display |
| `src/components/KeyDetailsPanel.tsx` | New | Key details table |
| `src/components/ScoreCard.tsx` | New | Individual score display |
| `src/components/ScoreDashboard.tsx` | New | Score dashboard + recommendations |
| `src/components/UploadSection.tsx` | Modify | Integrate new extraction view |
| `src/hooks/useExtraction.ts` | New | Extraction state + polling logic |
| `src/types/extraction.ts` | New | TypeScript interfaces |

---

## Testing Considerations

1. **Unit tests** for DocumentTypeDetector with sample documents
2. **Unit tests** for FieldMapper with known document types
3. **Unit tests** for ExtractionScorer with ground truth data
4. **Integration tests** for full extraction pipeline
5. **Frontend** - mock API responses for component testing
