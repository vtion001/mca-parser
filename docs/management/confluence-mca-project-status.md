# Confluence: MCA PDF Scrubber — Project Status

**Space:** MCA PDF Scrubber
**Parent Page:** MCA PDF Scrubber
**Labels:** project-status, pdf-scrubber

---

## MCA PDF Scrubber — Project Status Report

**Date:** April 6, 2026
**Status:** Active Development

---

## Executive Summary

MCA PDF Scrubber is a full-stack PDF document processing platform that extracts, analyzes, and scrubs personally identifiable information (PII) from bank statements and financial documents.

**Current health:** ✅ All services operational. Recent resolution of persistent 502 Bad Gateway errors has stabilized production behavior.

---

## Architecture

```
Browser → nginx:8000 (reverse proxy)
              ├── React Frontend (served by nginx)
              ├── Laravel API (port 9000)
              │         ├── Redis Queue
              │         └── Supabase PostgreSQL
              └── Python Docling Service (5 replicas via docling-lb)
```

### Service Topology

| Service | Replicas | Memory | Purpose |
|---------|----------|--------|---------|
| nginx | 1 | 128MB | Reverse proxy |
| React Frontend | 1 | 256MB | User interface |
| Laravel API | 1 | 512MB | REST API |
| Laravel Queue Workers | 1 (10 procs) | 512MB | Async jobs |
| Docling Service | 5 + lb | 4GB each | PDF extraction |
| Redis | 1 | 256MB | Cache + queue |

---

## What We've Built

### Core Features
1. **PDF Upload & Extraction** — Docling + EasyOCR
2. **PII Detection & Scrubbing** — SSN, credit cards, emails, phones
3. **Document Analysis** — Transaction classification, MCA detection, revenue stats
4. **Multi-Tenancy** — Account isolation via X-Account-ID
5. **CSV Export** — 19 MoneyThumb-style formats (in progress)

### Infrastructure
- 5-replica load-balanced Docling service with nginx keepalive
- Redis queue with 10 Laravel workers via supervisord
- Container healthchecks on all services
- `./scripts/deploy.sh` with git commit hash verification

---

## Recent Work (Last 2 Weeks)

### 502 Bad Gateway Resolution

| Root Cause | Fix |
|-----------|-----|
| Job timeout mismatch (300s vs HTTP 900s) | `ProcessPdfExtraction.php`: timeout → 900s |
| OOM from OCR on large PDFs | `server.py`: skip OCR for >20 page PDFs |
| MemoryError silent crash | `converter.py`: catch with descriptive error |
| Nginx upstream connection churn | `docling-lb.conf`: `keepalive 16` |

### New Scripts
- `scripts/deploy.sh` — Rebuild + recreate with verification
- `scripts/health-check.sh` — Full service validation

---

## Current Work

1. **CSV Export UI** — Type definitions done, UI hooks pending
2. **docling-lb Healthcheck** — Needs container recreation

---

## System Health

```
✅ Frontend (nginx routing working)
✅ Laravel API (health + readiness endpoints responding)
✅ Redis (healthy, PING responding)
✅ Docling Service (5/5 replicas healthy)
✅ PDF Extraction (test PDF uploaded successfully)
⚠️  docling-lb healthcheck — pending recreation
```

---

## Open Issues

| Issue | Severity | Status |
|-------|----------|--------|
| docling-lb healthcheck not active | Low | Pending |
| CSV export UI not fully implemented | Medium | In Progress |
| Memory pressure on large PDFs | Medium | Mitigated |

---

## What's Next

1. Complete CSV export UI
2. Performance testing (concurrent uploads)
3. Prometheus + Grafana monitoring dashboard
4. Production deployment to Azure Container Apps

---

## Team

| Role | Technology |
|------|------------|
| Backend | Laravel 11, PHP 8.2+, Supabase PostgreSQL, Redis |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Python Service | FastAPI, Docling, EasyOCR, Prometheus |
| Infrastructure | Docker Compose, Azure Container Apps, GitHub Actions |

---

## Reference

- [Architecture](mca-pdf-scrubber-architecture.md)
- [API Reference](mca-pdf-scrubber-api-reference.md)
- [Deployment Guide](mca-pdf-scrubber-deployment-guide.md)
- [CSV Export Formats](mca-pdf-scrubber-csv-export-formats.md)
- [Project CLAUDE.md](../../CLAUDE.md)
