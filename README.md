# MCA PDF Scrubber

A full-stack application for uploading PDF documents and performing text extraction, analysis, and PII scrubbing with multi-account support.

## Architecture

```
Browser → nginx:8000 → React (frontend) or Laravel (API)
                      → Python Docling Service (3 replicas via LB)
                      → MySQL/Redis (data/cache)
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Laravel 11 (PHP 8.2+)
- **PDF Extraction**: Python Docling service (FastAPI + docling + EasyOCR)
- **AI Analysis**: Google Gemini 3.1 Pro via OpenRouter
- **Database**: MySQL 8.0
- **Cache/Queue**: Redis
- **Monitoring**: Prometheus + Grafana

## Quick Start

```bash
# Clone and setup
cp .env.docker.example .env
# Edit .env with your API keys

# Start all services
docker-compose up --build

# Or for full monitoring stack
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build
```

## Production Scaling

### Configuration

| Component | Replicas | Workers | Purpose |
|-----------|----------|---------|---------|
| Laravel Workers | 10 | 100 total (10 per pod) | Queue job processing |
| Docling Service | 3 | - | PDF text extraction |
| Redis | 1 | - | Cache + Queue |
| MySQL | 1 | - | Persistent storage |

### Expected Performance

| PDFs | Workers | Expected Time | Notes |
|------|---------|---------------|-------|
| 10 | 1 | ~5-10 min | Baseline |
| 10 | 10 | ~1-2 min | 5-8x speedup |
| 100 | 100 | ~15-30 min | Near-linear scaling |

### Scaling Commands

```bash
# Scale Laravel workers
docker-compose up -d --scale laravel-worker=20

# Scale Docling replicas (requires nginx-lb config update)
docker-compose up -d --scale docling-1=5 docling-2=5 docling-3=5

# Check worker status
docker-compose logs laravel-worker | grep "Processing"
```

## Monitoring

### Access Points

- **API**: http://localhost:8000
- **Frontend**: http://localhost:8000 (via nginx)
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| `docling_queue_depth` | Active extractions | > 10 |
| `docling_extraction_duration_seconds_p95` | 95th percentile latency | > 60s |
| `docling_extraction_total{status="failure"}` | Failed extractions | > 1% |

## API Endpoints

All routes prefixed with `/api/v1`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/health/ready` | No | Readiness with dependencies |
| POST | `/pdf/upload` | No | Quick upload + extract |
| POST | `/pdf/full-extract` | Account | Upload + async process |
| GET | `/documents` | Account | List documents |
| GET | `/batches` | Account | List batches |
| POST | `/batches/{id}/process` | Account | Start batch processing |

### Authentication

Include `X-Account-ID` header for account-scoped endpoints:
```bash
curl -H "X-Account-ID: 1" http://localhost:8000/api/v1/documents
```

## Benchmarking

```bash
# Run performance benchmark
python scripts/benchmark.py --pdfs ./test_pdfs --workers 1,5,10

# Output: benchmark_report.md + results.json
```

## Environment Variables

### Required for Production

```env
OPENROUTER_API_KEY=sk-or-...    # OpenRouter API key
DB_PASSWORD=secure_password      # MySQL password
MYSQL_ROOT_PASSWORD=root_pass    # MySQL root password
```

### Optional

```env
DB_DATABASE=mca_pdf_scrubber    # Default: mca_pdf_scrubber
DB_USERNAME=mca                 # Default: mca
OPENROUTER_MODEL=google/gemini-3.1-pro-preview  # Default model
```

## Development

```bash
# Backend
cd backend && composer install && php artisan serve

# Frontend
cd frontend && npm install && npm run dev

# Python Service
cd python-service && pip install -r requirements.txt && python src/server.py
```

## License

MIT
