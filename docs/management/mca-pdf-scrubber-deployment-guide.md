# MCA PDF Scrubber - Deployment Guide

## Prerequisites

- Docker & Docker Compose
- OpenRouter API key (for AI analysis)
- Supabase PostgreSQL database (or local SQLite for development)

## Environment Variables

Create a `.env` file in the project root:

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-xxxxx
SUPABASE_DB_HOST=your-supabase-host
SUPABASE_DB_PORT=6543
SUPABASE_DB_USER=postgres.your-project
SUPABASE_DB_PASSWORD=your-password

# Optional (with defaults)
OPENROUTER_MODEL=openai/gpt-3.5-turbo
```

---

## Docker Compose Deployment

### Production Stack

Start the full production stack:

```bash
docker-compose up --build
```

This starts:
- nginx reverse proxy on port 8000
- React frontend (via nginx)
- Laravel API
- Laravel queue workers (10 processes via supervisord)
- 5 Docling service replicas
- Redis

### Development Stack

Start with hot-reload support:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --profile dev
```

This starts additional services:
- `laravel-dev` on port 9000 (php artisan serve with auto-reload)
- `laravel-worker-dev` with queue auto-reload
- `frontend-dev` on port 4200 (Vite hot-reload)
- `docling-watcher` (auto-restarts docling containers on code changes)
- `nginx-dev` on port 8000

### Monitoring Stack

Add Prometheus + Grafana monitoring:

```bash
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

---

## Service URLs (Development vs Production)

| Service | Production | Development |
|---------|------------|-------------|
| Full App | http://localhost:8000 | http://localhost:8000 (nginx-dev) |
| Laravel API | http://localhost:8000/api | http://localhost:9000 |
| Frontend HMR | N/A | http://localhost:4200 |
| Prometheus | http://localhost:9090 | http://localhost:9090 |
| Grafana | http://localhost:3000 | http://localhost:3000 |

---

## Rebuilding Services

### Rebuild frontend and nginx after UI changes:

```bash
docker-compose build frontend nginx
docker-compose up -d
```

### Rebuild only frontend (for React/CSS changes):

```bash
docker-compose build frontend
docker-compose up -d
```

### Rebuild after Python service changes:

```bash
docker-compose build docling-1 docling-2 docling-3 docling-4 docling-5
docker-compose up -d
```

---

## Azure Container Apps Deployment

The project includes Azure Developer CLI (`azd`) configuration for cloud deployment.

### Deploy to Azure:

```bash
azd up
```

### Configuration Files:
- `azure.yaml` - Azure Developer CLI configuration
- `.github/workflows/deploy.yml` - GitHub Actions CI/CD pipeline
- `infra/` - Infrastructure as Code (Bicep/ARM templates)

---

## Service Health Checks

### Check all services healthy:

```bash
curl http://localhost:8000/api/v1/health
```

### Check readiness (includes MySQL, Redis, Docling):

```bash
curl http://localhost:8000/api/v1/health/ready
```

### Check Docling specifically:

```bash
curl http://localhost:8000/api/v1/health/docling
```

---

## Container Resource Limits

| Container | Memory Limit | Notes |
|-----------|--------------|-------|
| nginx | 128M | Reverse proxy |
| frontend | 256M | React static files |
| laravel | 512M | API requests |
| laravel-worker | 512M | Queue processing (10 workers) |
| docling-1..5 | 4G each | Heavy PDF processing |
| docling-lb | 64M | Load balancer |
| redis | 256M | Cache + Queue |

---

## Laravel Queue Workers

The `laravel-worker` container runs supervisord with 10 queue worker processes:

```
[program:laravel-worker-1]
command=php /var/www/html/artisan queue:work redis --tries=5 --timeout=300 --sleep=3 --memory=512M
numprocs=10
```

### Job Configuration:
- **Timeout:** 300 seconds (5 minutes per job)
- **Max Tries:** 5
- **Backoff:** Exponential (60s, 120s, 240s, 480s, 960s)
- **Memory Limit:** 512MB per worker

### Monitor queue:

```bash
docker-compose exec laravel-worker php artisan queue:monitor
```

---

## Redis Configuration

Redis is used for:
- Laravel cache (with stampede protection)
- Queue job broker
- Extraction progress caching (24-hour TTL)

### Connect to Redis CLI:

```bash
docker-compose exec redis redis-cli
```

### Useful Redis commands:

```
# Check connection
PING

# View active keys
KEYS *

# View extraction progress
GET extraction_progress_<job_id>

# View cached PDF results
GET pdf_cache_<md5_hash>
```

---

## Docling Service

### Architecture

5 Docling replicas behind an nginx load balancer:

```
docling-lb (nginx) -> docling-1
                   -> docling-2
                   -> docling-3
                   -> docling-4
                   -> docling-5
```

### Health Check

```bash
# Direct to load balancer
curl http://localhost:8001/health

# Via Laravel health endpoint
curl http://localhost:8000/api/v1/health/docling
```

### Metrics (Prometheus)

```bash
curl http://localhost:8001/metrics
```

Available metrics:
- `docling_extraction_total` - Total extractions by status
- `docling_extraction_duration_seconds` - Extraction duration histogram
- `docling_pdf_pages` - PDF page count histogram
- `docling_queue_depth` - Current queue depth
- `docling_ocr_total` - OCR operations by status

---

## Prometheus Configuration

The Prometheus configuration (`docker/prometheus.yml`) scrapes:

| Job | Targets | Metrics Path |
|-----|--------|--------------|
| prometheus | localhost:9090 | /metrics |
| docling | docling-1:8001, docling-2:8001, docling-3:8001 | /metrics |
| laravel | laravel:8000 | /metrics |
| redis | redis:6379 | (requires redis_exporter) |

---

## Troubleshooting

### Container won't start

```bash
# View logs
docker-compose logs <service-name>

# Rebuild without cache
docker-compose build --no-cache <service-name>
```

### Docling 502 errors

502 errors typically indicate worker crashes (often OOM). The system retries up to 5 times with exponential backoff.

Check docling logs:
```bash
docker-compose logs docling-1
docker-compose logs docling-lb
```

### Queue jobs not processing

```bash
# Check worker logs
docker-compose logs laravel-worker

# Monitor queue
docker-compose exec laravel-worker php artisan queue:monitor

# Restart workers
docker-compose restart laravel-worker
```

### Database connection issues

Ensure PgBouncer is properly configured. The Laravel `AuthMiddleware` sets `ATTR_EMULATE_PREPARES` to handle PgBouncer's prepared statement limitations.

---

## Common Commands Reference

```bash
# Start all services
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart a specific service
docker-compose restart <service-name>

# Scale docling replicas (uses named containers)
docker-compose up -d --scale docling=3  # Not recommended - use named containers instead

# Execute artisan command
docker-compose exec laravel php artisan <command>

# Enter container shell
docker-compose exec laravel bash
docker-compose exec docling-1 bash

# View resource usage
docker stats

# Clean up unused images
docker image prune -a
```
