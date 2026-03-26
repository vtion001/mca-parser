# MCA PDF Scrubber - Laravel Backend

## Overview

A Laravel-based API backend that interfaces with a Python docling microservice for PDF text extraction and scrubbing.

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌──────────────────┐
│   React     │ ───► │  Laravel API   │ ───► │  Python Docling  │
│   Frontend  │      │  (PHP)         │      │  Microservice    │
└─────────────┘      └─────────────────┘      └──────────────────┘
```

## Tech Stack

- **Backend Framework**: Laravel 11 (PHP 8.2+)
- **PDF Extraction**: Python + Docling
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Desktop**: PyWebView
- **Containerization**: Docker

## Requirements

- PHP 8.2+
- Composer
- Python 3.10+
- Docker (optional)

## Installation

### Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan serve
```

### Python Docling Service

```bash
cd python-service
pip install -r requirements.txt
python src/server.py
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pdf/upload` | Upload and extract PDF text |
| POST | `/api/pdf/analyze` | Analyze PDF text with PyTorch model |
| POST | `/api/pdf/scrub` | Remove PII from PDF text |
| GET | `/api/health` | Health check |

## Environment Variables

```env
DOCLING_SERVICE_URL=http://localhost:8001
MAX_UPLOAD_SIZE=52428800
CORS_ORIGINS=http://localhost:5173
```

## Docker

```bash
docker-compose up --build
```

## License

MIT
