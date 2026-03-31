# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCA PDF Scrubber is a full-stack application for uploading PDF documents and performing text extraction, analysis, and PII scrubbing. It uses a microservice architecture with nginx as the reverse proxy entry point on port 8000.

## Architecture

```
Browser → nginx:8000 → React (frontend) or Laravel (API)
                      → Python Docling Service (:8001)
                      → MySQL/Redis (data/cache)
```

**In Docker:** nginx reverse proxy on port 8000 routes to frontend, Laravel API, and Docling service.

**Data Flow:**
1. User uploads PDF via React frontend
2. Laravel API receives requests at `/api/v1/pdf/*` endpoints
3. Laravel forwards to Python Docling service for text extraction
4. Laravel's `PdfAnalyzerService` performs PII detection/scrubbing using regex
5. Results returned to frontend

## Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **Backend:** Laravel 11 (PHP 8.2+) + MySQL 8.0 + Redis
- **PDF Extraction:** Python Docling service (FastAPI + docling library + EasyOCR)
- **AI Analysis:** OpenRouterService (extends BaseAIService) using Google Gemini 3.1 Pro for document analysis

## Commands

### Development
```bash
# Full stack with Docker
docker-compose up --build

# Individual services
cd frontend && npm run dev      # React on :5173
cd backend && php artisan serve # Laravel on :8000
cd python-service && python src/server.py  # Docling on :8001
```

### Backend (Laravel/PHP)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan serve           # Start server
php artisan test            # Run PHPUnit tests
php artisan queue:work      # Process background jobs
```

### Python Service
```bash
cd python-service
pip install -r requirements.txt
python src/server.py
```

## Key Services

### Backend Controllers
- **PdfController.php** - Core PDF upload, analyze, scrub operations
- **DocumentController.php** - Document CRUD and status management
- **BatchController.php** - Batch document processing
- **ComparisonController.php** - Document comparison (balances, risk, transactions)
- **ExtractionController.php** - Async extraction with job progress tracking

### Backend Services
- **DoclingService.php** - HTTP client to Python Docling service (600s timeout for large PDFs)
- **PdfAnalyzerService.php** - Regex-based PII detection (SSN, credit cards, emails, phones, dates)
- **BaseAIService.php** - Abstract base for AI document analysis; provides fallback analysis when API unavailable
- **OpenRouterService.php** - OpenRouter AI service (Google Gemini 3.1 Pro)
- **BalanceExtractorService.php** - Extracts balance figures from documents
- **DocumentTypeDetector.php** - Classifies document types

### Python Service (python-service/src/)
- **server.py** - FastAPI server with async thread-pool offloading
- **converter.py** - Docling PDF-to-markdown conversion
- **ocr.py** - EasyOCR for image-based PDF content
- **config.py** - Device detection (CUDA/CPU) and worker configuration

## API Endpoints

All routes prefixed with `/api/v1`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/ready` | Readiness check |
| GET | `/health/docling` | Docling service health |
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

- **ExtractionContext** - Centralized state for extraction workflow
- **useExtractionState, useExtraction, useExtractionPolling** - Custom hooks
- **UploadSection** - PDF upload UI
- **StatementsView** - Transaction statements display
- **ReviewModal** - Manual transaction review/editing
- **ComparativeView** - Multi-document comparison
- **DocumentLibrary** - Document management UI
- **analysis/** - Analysis results components

## Docker Environment Variables

Required environment variables for Docker Compose (set in `.env` or shell):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI analysis |
| `DB_PASSWORD` | Yes | MySQL database password |
| `MYSQL_ROOT_PASSWORD` | Yes | MySQL root password |
| `DB_DATABASE` | No | Database name (default: `mca_pdf_scrubber`) |
| `DB_USERNAME` | No | Database username (default: `mca`) |

## Development Workflow

### Before Completing Implementation
1. Run `/code-review:code-review` to check production readiness
2. Fix any issues flagged with confidence >= 75
3. Update this CLAUDE.md if new patterns, services, or architecture are introduced

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
- [ ] AccountMiddleware has user authentication (requires User model + auth system)
- [ ] AccountMiddleware has user-account ownership validation (requires User model)

## Known Limitations

1. **AccountMiddleware** requires a User/authentication system to be implemented for full multi-tenant security. Currently supports account isolation via `X-Account-ID` header validation only.

2. **Scaling workers**: Use `docker-compose up -d --scale laravel-worker=10` for standalone Docker Compose. For Swarm, use `docker stack deploy`.
