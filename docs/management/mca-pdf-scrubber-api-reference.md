# MCA PDF Scrubber - API Reference

## Base URL

```
http://localhost:8000/api/v1
```

All endpoints are prefixed with `/api/v1`.

## Authentication

Most endpoints require Bearer token authentication:

```
Authorization: Bearer <api_token>
```

Public endpoints (no auth required):
- `GET /health`
- `GET /health/ready`
- `GET /health/docling`
- `POST /auth/register`
- `POST /auth/login`

Multi-tenancy is enforced via the `X-Account-ID` header on protected endpoints.

---

## Health Endpoints

### GET /health

Basic health check (nginx-level).

**Response 200:**
```json
{
  "status": "healthy",
  "app": "MCA PDF Scrubber",
  "version": "1.0.0",
  "timestamp": "2026-04-06T10:00:00+00:00"
}
```

---

### GET /health/ready

Readiness check including MySQL, Redis, and Docling.

**Response 200:**
```json
{
  "ready": true,
  "checks": {
    "mysql": {
      "healthy": true,
      "driver": "pgsql",
      "version": "15.2"
    },
    "redis": {
      "healthy": true,
      "ping": "PONG"
    },
    "docling": {
      "healthy": true,
      "device": "cuda",
      "workers": 4
    }
  },
  "timestamp": "2026-04-06T10:00:00+00:00"
}
```

**Response 503:**
```json
{
  "ready": false,
  "checks": { ... },
  "timestamp": "2026-04-06T10:00:00+00:00"
}
```

---

### GET /health/docling

Docling service health check.

**Response 200:**
```json
{
  "status": "healthy",
  "service": "docling",
  "available": true,
  "details": {
    "status": "healthy",
    "device": "cuda",
    "workers": 4
  }
}
```

---

## Authentication Endpoints

### POST /auth/register

Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "account_id": 1
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "account_id": 1
    },
    "token": "a1b2c3d4e5f6..."
  }
}
```

---

### POST /auth/login

Login and receive Bearer token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "account_id": 1
    },
    "token": "a1b2c3d4e5f6..."
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "error": "Invalid credentials."
}
```

---

### POST /auth/logout

Revoke Bearer token. **Requires auth.**

**Response 200:**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

---

### GET /auth/me

Get current user. **Requires auth.**

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "account_id": 1
  }
}
```

---

## PDF Endpoints

### POST /pdf/upload

Upload PDF and extract text. **Requires auth + account.**

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | PDF file (max 50MB) |

**Response 200:**
```json
{
  "success": true,
  "filename": "bank_statement.pdf",
  "page_count": 5,
  "text_length": 45000,
  "text": "# Bank Statement\n\nOctober 2023..."
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "PDF extraction failed"
}
```

---

### POST /pdf/analyze

Analyze PDF text (word count, PII, confidence). **Requires auth + account.**

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | PDF file (max 50MB) |
| remove_pii | boolean | No | Remove PII from analysis (default: true) |

**Response 200:**
```json
{
  "success": true,
  "filename": "bank_statement.pdf",
  "page_count": 5,
  "analysis": {
    "word_count": 8500,
    "char_count": 52000,
    "has_pii_indicators": true,
    "confidence_score": 0.92
  },
  "original_length": 52000,
  "scrubbed_length": 51000,
  "scrubbed": true
}
```

---

### POST /pdf/scrub

Remove PII from PDF text. **Requires auth + account.**

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | PDF file (max 50MB) |
| remove_pii | boolean | No | Remove PII (default: true) |

**Response 200:**
```json
{
  "success": true,
  "filename": "bank_statement.pdf",
  "original_text": "Contact: john@example.com, SSN: 123-45-6789",
  "scrubbed_text": "Contact: [EMAIL], SSN: [SSN]",
  "original_length": 50,
  "scrubbed_length": 42,
  "pii_removed": true
}
```

---

### POST /pdf/full-extract

Start async extraction with job tracking. **Requires auth + account.**

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | PDF file (max 50MB) |

**Response 200:**
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "document_id": 42,
  "status": "processing"
}
```

---

### GET /pdf/progress/{jobId}

Poll extraction job status. **Requires auth + account.**

**Response 200:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "stage": "ai_analysis",
  "stage_label": "Running AI analysis...",
  "progress_percent": 85,
  "current_markdown": null,
  "result": null
}
```

**Response 200 (complete):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "complete",
  "stage": "complete",
  "stage_label": "Done",
  "progress_percent": 100,
  "current_markdown": null,
  "result": {
    "markdown": "# Bank Statement\n\n...",
    "document_type": { "type": "bank_statement", "confidence": 0.95 },
    "key_details": { "account_name": "...", "statement_period": "..." },
    "balances": { "beginning_balance": {...}, "ending_balance": {...} },
    "ai_analysis": { "qualification_score": 8, "transaction_summary": {...} },
    "mca_findings": [...],
    "transaction_classification": {...},
    "scores": { "overall": 85, "quality": 90, "completeness": 80 },
    "pii_breakdown": { "ssn": {...}, "email": {...} },
    "page_count": 5
  }
}
```

**Response 404:**
```json
{
  "success": false,
  "error": "Job not found"
}
```

---

## Document Endpoints

### GET /documents

List documents with filters. **Requires auth + account.**

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: pending, processing, complete, failed |
| document_type | string | Filter by document type |
| per_page | integer | Results per page (default: 20) |
| page | integer | Page number |

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "filename": "abc123.pdf",
      "original_filename": "bank_statement.pdf",
      "status": "complete",
      "document_type": "bank_statement",
      "created_at": "2026-04-06T10:00:00+00:00"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 20,
    "total": 100
  }
}
```

---

### GET /documents/{id}

Get document details. **Requires auth + account.**

**Response 200:**
```json
{
  "data": {
    "id": 1,
    "filename": "abc123.pdf",
    "original_filename": "bank_statement.pdf",
    "file_path": "/var/www/html/storage/app/pdfs/abc123.pdf",
    "status": "complete",
    "document_type": "bank_statement",
    "markdown": "# Bank Statement\n\n...",
    "key_details": { "account_name": "ACME Corp", ... },
    "scores": { "overall": 85, "quality": 90 },
    "pii_breakdown": { "ssn": { "found": true, ... } },
    "balances": { "beginning_balance": {...}, "ending_balance": {...} },
    "ai_analysis": { "qualification_score": 8, ... },
    "mca_findings": [...],
    "page_count": 5,
    "created_at": "2026-04-06T10:00:00+00:00"
  }
}
```

**Response 404:**
```json
{
  "error": "Document not found"
}
```

---

### DELETE /documents/{id}

Delete document. **Requires auth + account.**

**Response 200:**
```json
{
  "message": "Document deleted successfully"
}
```

---

### PATCH /documents/{id}/status

Update document status. **Requires auth + account.**

**Request Body:**
```json
{
  "status": "pending"
}
```

**Response 200:**
```json
{
  "data": { ... }
}
```

---

## Batch Endpoints

### GET /batches

List batches. **Requires auth + account.**

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| per_page | integer | Results per page |
| page | integer | Page number |

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Batch 2026-04-06",
      "status": "processing",
      "total_documents": 10,
      "completed_documents": 5,
      "created_at": "2026-04-06T10:00:00+00:00"
    }
  ],
  "meta": { ... }
}
```

---

### POST /batches

Create batch. **Requires auth + account.**

**Request Body:**
```json
{
  "name": "April Statements",
  "document_ids": [1, 2, 3]
}
```

**Response 201:**
```json
{
  "data": {
    "id": 1,
    "name": "April Statements",
    "status": "pending",
    "total_documents": 3,
    "completed_documents": 0,
    "documents": [...]
  }
}
```

---

### GET /batches/{id}

Get batch details. **Requires auth + account.**

**Response 200:**
```json
{
  "data": {
    "id": 1,
    "name": "April Statements",
    "status": "processing",
    "total_documents": 3,
    "completed_documents": 1,
    "documents": [...]
  }
}
```

---

### POST /batches/{id}/documents

Add documents to batch. **Requires auth + account.**

**Request Body:**
```json
{
  "document_ids": [4, 5]
}
```

**Response 200:**
```json
{
  "data": { ... }
}
```

---

### POST /batches/{id}/process

Start batch processing. **Requires auth + account.**

**Response 200:**
```json
{
  "data": { ... },
  "message": "Batch processing started"
}
```

---

### GET /batches/{id}/progress

Get batch processing progress. **Requires auth + account.**

**Response 200:**
```json
{
  "data": {
    "id": 1,
    "name": "April Statements",
    "status": "processing",
    "total_documents": 3,
    "completed_documents": 1,
    "progress_percent": 33,
    "documents": [...]
  }
}
```

---

## Comparison Endpoints

### POST /documents/compare

Compare multiple documents. **Requires auth + account.**

**Request Body:**
```json
{
  "document_ids": [1, 2, 3],
  "type": "balances"
}
```

**Comparison Types:**
- `balances` - Compare beginning/ending balances across statements
- `risk` - Compare risk levels and qualification scores
- `transactions` - Compare estimated credits/debits
- `delta` - Compare PII detected across documents

**Response 200 (balances):**
```json
{
  "data": {
    "balances": [
      { "id": 1, "filename": "stmt1.pdf", "beginning_balance": 10000, "ending_balance": 12000 },
      { "id": 2, "filename": "stmt2.pdf", "beginning_balance": 12000, "ending_balance": 15000 }
    ],
    "gaps": [
      { "from": "stmt1.pdf", "to": "stmt2.pdf", "gap": 0 }
    ]
  }
}
```

**Response 200 (risk):**
```json
{
  "data": [
    { "id": 1, "filename": "stmt1.pdf", "risk_level": "low", "qualification_score": 8 },
    { "id": 2, "filename": "stmt2.pdf", "risk_level": "medium", "qualification_score": 5 }
  ]
}
```

---

## PII Patterns

The system detects and can scrub the following PII patterns:

| Pattern | Regex | Replacement |
|---------|-------|-------------|
| SSN | `(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)` | `[SSN]` |
| Email | `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z\|a-z]{2,}` | `[EMAIL]` |
| Phone | `(?<!\d)(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]+\d{3}[-.\s]+\d{4}(?!\d)` | `[PHONE]` |
| Credit Card | `(?<!\d)\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}(?!\d)` | `[CARD]` |
| Date | `(?<!\d)(?:0?[1-9]|1[0-2])\/(?:0?[1-9]\|[12]\d\|3[01])\/(?:19\|20)\d{2}(?!\d)` | `[DATE]` |
| Routing Number | `(?<!\d)\d{9}(?!\d)` | `[ROUTING]` |

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Or with validation errors:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email field is required."],
    "file": ["The file must be a PDF."]
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (account access denied) |
| 404 | Not Found |
| 500 | Server Error |
| 503 | Service Unavailable |
