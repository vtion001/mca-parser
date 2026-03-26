# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCA PDF Scrubber is a full-stack application for uploading PDF documents and performing text extraction, analysis, and PII scrubbing. It uses a microservice architecture with three main components.

## Architecture

```
React Frontend (Port 5173) → Laravel API (Port 8000) → Python Docling Service (Port 8001)
```

**Data Flow:**
1. User uploads PDF via React frontend
2. Laravel API receives requests at `/api/v1/pdf/*` endpoints
3. Laravel forwards to Python Docling service for text extraction
4. Laravel's `PdfAnalyzerService` performs PII detection/scrubbing using regex
5. Results returned to frontend

## Commands

### Frontend (React/TypeScript)
```bash
cd frontend
npm install
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

### Backend (Laravel/PHP)
```bash
cd backend
composer install
php artisan key:generate
php artisan serve
php artisan test   # Run PHPUnit tests
```

### Python Service
```bash
cd python-service
pip install -r requirements.txt
python src/server.py
```

### Full Stack (Docker)
```bash
docker-compose up --build
```

## Key Services

- **PdfController.php** - Handles upload, analyze, and scrub operations
- **DoclingService.php** - HTTP client to Python Docling service
- **PdfAnalyzerService.php** - Regex-based PII detection (SSN, credit cards, emails, phones, dates) and text analysis
- **server.py** (python-service) - FastAPI server using `docling` library for PDF text extraction

## API Endpoints

All routes prefixed with `/api/v1`:
- `GET /health` - Health check
- `GET /health/docling` - Docling service health
- `POST /pdf/upload` - Upload PDF and extract text
- `POST /pdf/analyze` - Analyze PDF text (word count, PII detection)
- `POST /pdf/scrub` - Remove PII from PDF text
