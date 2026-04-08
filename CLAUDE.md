# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCA PDF Scrubber is a full-stack application for uploading PDF documents and performing text extraction, analysis, and PII scrubbing. It uses a microservice architecture with nginx as the reverse proxy entry point on port 8000.

## Architecture

```
Browser → nginx:8000 → React (frontend) or Laravel (API)
                      → Python Docling Service (:8001)
                      → Supabase PostgreSQL + Redis (data/cache)
```

**In Docker:** nginx reverse proxy on port 8000 routes to frontend, Laravel API, and Docling service. The `frontend` container has no direct port exposure — it's served exclusively through nginx.

**Service Discovery (Docker):**
- nginx → `frontend:80`, `laravel:9000`, `docling-lb:8001`
- docling-lb (nginx) → `docling-1:8001` through `docling-5:8001` (load-balanced)
- laravel-worker connects to `redis:6379` for queue processing

**Data Flow:**
1. User uploads PDF via React frontend
2. Laravel API receives requests at `/api/v1/pdf/*` endpoints
3. Laravel forwards to Python Docling service for text extraction
4. Laravel's `PdfAnalyzerService` performs PII detection/scrubbing using regex
5. Results returned to frontend

## Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite (app name: "Dave")
- **Frontend (Docker):** Served by nginx, not directly accessible on a separate port
- **Backend:** Laravel 11 (PHP 8.2+) + Supabase PostgreSQL + Redis
- **PDF Extraction:** Python Docling service (FastAPI + docling library + EasyOCR)
- **AI Analysis:** OpenRouterService (extends BaseAIService) using configurable model via `OPENROUTER_MODEL`

## Commands

### Development
```bash
# Production-like stack with Docker (all services via nginx on :8000)
docker-compose up --build

# Development stack with hot-reload (uses docker-compose.dev.yml)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --profile dev
# Services: nginx-dev:8000, laravel-dev:9000, frontend-dev:4200, docling-watcher

# Full stack with monitoring (Prometheus + Grafana)
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build

# Rebuild after frontend changes (rebuilds both frontend and nginx containers)
docker-compose build frontend nginx && docker-compose up -d

# Individual services (for hot-reload development)
cd frontend && npm run dev      # Vite dev server (port 4200, auto-fallback if taken)
cd backend && php artisan serve # Laravel on :9000
cd python-service && python src/server.py  # Docling on :8001
```

**Vite dev proxy:** When running `npm run dev` locally, Vite proxies `/api/*` requests to `http://localhost:8000` (nginx). In Docker, nginx handles all routing so services are accessed via `http://localhost:8000`.

### Backend (Laravel/PHP)
```bash
cd backend
composer install
cp .env.example .env 2>/dev/null || true
php artisan key:generate
php artisan serve           # Start server on :9000
php artisan test            # Run all PHPUnit tests
php artisan test --filter=ClassName  # Run specific test class
php artisan test --filter=test_method_name  # Run specific test method
php artisan queue:work      # Process background jobs
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev     # Vite dev server on :4200 (auto-fallback if port busy)
npm run build   # Production build
npx vitest run  # Run unit tests (Vitest)
npx playwright test  # Run E2E tests (requires Docker stack running)
```

### Python Service (Docling)
```bash
cd python-service
pip install -r requirements.txt
python src/server.py  # Runs on :8001
```

Requirements: Python 3.10+, PyTorch 2.0+, Docling 2.0+

## Testing

Three-layer testing strategy:

| Layer | Framework | Location | Command |
|-------|-----------|----------|---------|
| Backend Unit | PHPUnit | `backend/tests/Unit/` | `cd backend && php artisan test` |
| Frontend Unit | Vitest | `frontend/tests/Unit/` | `cd frontend && npx vitest run` |
| Frontend E2E | Playwright | `frontend/tests/e2e/` | `cd frontend && npx playwright test` |

**E2E test requirements:** Playwright E2E tests require the full Docker stack running (`docker-compose up --build`) because they hit the live nginx proxy on port 8000.

**Single test execution:**
```bash
# PHPUnit
php artisan test --filter=ProcessPdfExtractionTest
php artisan test --filter=test_job_tries_is_5

# Vitest
npx vitest run tests/Unit/export.test.ts
```

## Key Services

### Backend Controllers
- **PdfController.php** - Core PDF upload, analyze, scrub operations
- **DocumentController.php** - Document CRUD and status management
- **BatchController.php** - Batch document processing
- **ComparisonController.php** - Document comparison (balances, risk, transactions)
- **ExtractionController.php** - Async extraction with job progress tracking
- **AuthController.php** - User registration, login, logout, and me endpoints

### Backend Services
- **DoclingService.php** - HTTP client to Python Docling service (600s timeout for large PDFs)
- **PdfAnalyzerService.php** - Regex-based PII detection (SSN, credit cards, emails, phones, dates)
- **BaseAIService.php** - Abstract base for AI document analysis; provides fallback analysis when API unavailable
- **OpenRouterService.php** - OpenRouter AI service (configurable model via `OPENROUTER_MODEL`)
- **McaAiService.php** - AI-powered MCA (Merchant Cash Advance) analysis and detection service
- **McaDetectionService.php** - Pattern-based MCA finding detection using configurable criteria
- **TransactionClassificationService.php** - Classifies transactions into categories (MCA, NSF, transfers, etc.)
- **BalanceExtractorService.php** - Extracts balance figures from documents
- **DocumentTypeDetector.php** - Classifies document types
- **FieldMapper.php** - Maps extracted fields based on document type; delegates to FieldMappers/
- **FieldMappers/** - Subdirectory with specialized parsers:
  - **BankStatementTableParser.php** - Parses table structures in bank statements
  - **FieldValueCleaner.php** - Cleans and normalizes extracted field values
  - **GarbageDetector.php** - Identifies and filters garbage/unreliable extractions
  - **HeadingParser.php** - Parses document headings and section headers
- **ExtractionScorer.php** - Scores extraction quality and PII detection
- **PiiPatterns.php** - Shared PII regex pattern definitions used across services
- **AccountMiddleware.php** - Multi-tenancy via `X-Account-ID` header; validates user-account ownership after auth
- **AuthMiddleware.php** - Bearer token authentication; validates `api_token` on every request

### Backend Jobs
- **ProcessPdfExtraction.php** - Async job orchestrating full extraction pipeline via `PdfExtractionPipeline`
- **PdfExtractionPipeline.php** - Orchestrates 7 pipeline steps in sequence:
  1. **DoclingExtractionStep** - Extract text from PDF via Python Docling service
  2. **TypeDetectionStep** - Classify document type (bank statement, invoice, etc.)
  3. **FieldMappingStep** - Map extracted fields based on document type
  4. **ScoringStep** - Score extraction quality and reliability
  5. **PiiDetectionStep** - Detect PII (SSN, credit cards, emails, phones) via `PdfAnalyzerService`
  6. **BalanceExtractionStep** - Extract balance figures
  7. **AiAnalysisStep** - AI-powered analysis via `OpenRouterService` and `McaAiService`
  - **Post-processing** (not a pipeline step): MCA detection via `McaAiService` + transaction classification via `TransactionClassificationService`
  - **Cache**: Stampede-protected MD5-file-hash cache with 7-day TTL
- **PipelineContext.php** - Carries extraction state (markdown, documentType, keyDetails, balances, scores, piiBreakdown, aiAnalysis, mcaFindings, transactionClassification) through pipeline steps

### Python Service (python-service/src/)
- **server.py** - FastAPI server with async thread-pool offloading
- **converter.py** - Docling PDF-to-markdown conversion
- **ocr.py** - EasyOCR for image-based PDF content
- **models.py** - Pydantic request/response models
- **config.py** - Device detection (CUDA/CPU) and worker configuration

## API Endpoints

All routes prefixed with `/api/v1`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check (nginx) |
| GET | `/health/ready` | Readiness check (Laravel + Redis) |
| GET | `/health/docling` | Docling service health (via docling-lb) |
| POST | `/auth/register` | Register new user (public) |
| POST | `/auth/login` | Login, returns Bearer token (public) |
| POST | `/auth/logout` | Revoke Bearer token (auth required) |
| GET | `/auth/me` | Get current user (auth required) |
| POST | `/pdf/upload` | Upload PDF and extract text |
| POST | `/pdf/analyze` | Analyze PDF text (word count, PII, confidence) |
| POST | `/pdf/scrub` | Remove PII from PDF text |
| POST | `/pdf/full-extract` | Async extraction with job ID |
| GET | `/pdf/progress/{jobId}` | Poll extraction job status |
| GET | `/documents` | List documents with filters |
| GET | `/documents/{id}` | Get document details |
| DELETE | `/documents/{id}` | Delete document |
| PATCH | `/documents/{id}/status` | Update document status |
| POST | `/documents/compare` | Compare multiple documents |
| GET | `/batches` | List batches |
| POST | `/batches` | Create batch |
| POST | `/batches/{id}/documents` | Add documents to batch |
| POST | `/batches/{id}/process` | Start batch processing |

## Frontend Structure

- **ExtractionContext** - Centralized state for extraction workflow with polling support
- **useExtractionState, useExtraction, useExtractionPolling** - Custom hooks for extraction workflow
- **UploadSection** - PDF upload UI
- **StatementsView** - Transaction statements display
- **ReviewModal** - Manual transaction review/editing
- **ComparativeView** - Multi-document comparison (balances, risk, transactions)
- **DocumentLibrary** - Document management UI
- **InsightsScorecard** - PDF analytics dashboard (revenue stats, balance charts, MCA/NSF/transfer filtering)
- **analysis/** - Analysis results components

## Multi-Tenancy

User authentication via Bearer token (`api_token`) + account ownership validation:
- All API endpoints (except health/auth) require `Authorization: Bearer <token>`
- `AuthMiddleware` validates the token against the `users` table
- `AccountMiddleware` runs after auth and enforces `X-Account-ID` header matches the authenticated user's `account_id`
- Documents and batches belong to an account and are isolated per user
- Users belong to exactly one account via `account_id` foreign key

## Scaling Architecture

| Component | Replicas | Workers | Purpose |
|-----------|----------|---------|---------|
| Laravel Workers | 1 (supervisord) | 10 per pod | Queue job processing via supervisord |
| Docling Service | 5 named containers | - | PDF text extraction via docling-lb nginx |
| Redis | 1 | - | Cache + Queue |
| Supabase PostgreSQL | 1 | - | Persistent storage |

## Docker Environment Variables

Required environment variables for Docker Compose (set in `.env` or shell):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI analysis |
| `SUPABASE_DB_HOST` | Yes | Supabase PostgreSQL host |
| `SUPABASE_DB_PORT` | Yes | Supabase PostgreSQL port |
| `SUPABASE_DB_USER` | Yes | Supabase PostgreSQL user |
| `SUPABASE_DB_PASSWORD` | Yes | Supabase PostgreSQL password |
| `OPENROUTER_MODEL` | No | Model to use (default: `openai/gpt-3.5-turbo`) |

## Development Workflow

### Before Completing Implementation
1. Run `/code-review:code-review` to check production readiness
2. Fix any issues flagged with confidence >= 75
3. Update this CLAUDE.md if new patterns, services, or architecture are introduced

### Code Review Focus Areas

When reviewing code, prioritize these concerns:

1. **PII Data Handling** - Sensitive data (SSN, credit cards, emails, phones) must be masked in logs, errors, and responses. Never expose extracted text to client unless authorized.
2. **ReDoS Prevention** - Regex patterns for PII detection must not allow catastrophic backtracking. Anchor patterns with specific character classes.
3. **API Contract Integrity** - Verify frontend/backend and backend/Python service interfaces match. All endpoints use `/api/v1/` prefix.
4. **Service Failure Grace** - Docling unavailability should return meaningful errors, not propagate internal failures.
5. **File Lifecycle** - PDF uploads and temp files must be cleaned up even on error paths.

### TypeScript Checking

A PostToolUse hook runs `npx tsc --noEmit` after every Edit/Write operation in the frontend to catch type errors before they reach git. This is configured in `.claude/settings.json`.

### Deployment

**Azure Container Apps deployment via `azd`:**
```bash
azd up  # Deploy to Azure
```

Configuration files:
- `azure.yaml` - Azure Developer CLI configuration
- `.github/workflows/deploy.yml` - GitHub Actions CI/CD pipeline
- `infra/` - Infrastructure as Code (Bicep/ARM templates)

### Custom Agents

| Agent | File | Purpose |
|-------|------|---------|
| `code-reviewer` | `.claude/agents/code-reviewer.md` | Specialized reviewer for security, API contracts, error handling, resource management, and type safety |

### Custom Skills

| Skill | File | Purpose |
|-------|------|---------|
| `pr-check` | `.claude/skills/pr-check/SKILL.md` | PR readiness checklist |
| `setup-dev` | `.claude/skills/setup-dev/SKILL.md` | Development environment setup |

## Production Readiness Checklist

Before deploying, verify:

- [x] No hardcoded secrets (use environment variables)
- [x] All services have health checks
- [x] Resource limits set on all containers
- [x] Cache has stampede protection and graceful fallback
- [x] Prometheus metrics properly observed on all endpoints
- [x] `deploy.replicas` removed, use `--scale` flag for standalone Docker Compose
- [x] AccountMiddleware has user authentication (requires User model + auth system)
- [x] AccountMiddleware has user-account ownership validation (requires User model)

## Known Limitations

1. **Laravel worker scaling**: The `laravel-worker` service uses supervisord to manage 10 queue worker processes within a single container. Scaling requires rebuilding with modified supervisord configuration.

2. **Docling replicas**: 5 named containers (docling-1 through docling-5) replace the `--scale` approach due to shared volume requirements. The docling-lb nginx load balancer distributes traffic across them.