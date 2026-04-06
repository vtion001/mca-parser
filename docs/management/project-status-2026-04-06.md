# MCA PDF Scrubber — Project Status Report

**Date:** April 6, 2026
**Prepared by:** Dev Team
**Status:** Active Development

---

## Executive Summary

MCA PDF Scrubber is a full-stack PDF document processing platform that extracts, analyzes, and scrubs personally identifiable information (PII) from bank statements and financial documents. The system uses a microservices architecture with Laravel (PHP), React (TypeScript), and a Python Docling service for PDF text extraction.

**Current health:** All services are operational. Recent resolution of persistent 502 Bad Gateway errors has stabilized production behavior. Active work continues on CSV export parity with MoneyThumb and ongoing reliability improvements.

---

## Architecture Overview

```
Browser → nginx:8000 (reverse proxy)
              ├── React Frontend (port 80, served by nginx)
              ├── Laravel API (port 9000)
              │         ├── Redis Queue (for async job processing)
              │         └── Supabase PostgreSQL (persistent storage)
              └── Python Docling Service (port 8001, load-balanced across 5 replicas)
                        ├── Docling PDF extraction (docling library)
                        └── EasyOCR (image-based PDF content)
```

### Service Topology

| Service | Replicas | Memory Limit | Purpose |
|---------|----------|--------------|---------|
| nginx | 1 | 128MB | Reverse proxy, single entry point |
| React Frontend | 1 | 256MB | User interface |
| Laravel API | 1 | 512MB | REST API, business logic |
| Laravel Queue Workers | 1 (10 processes via supervisord) | 512MB | Async job processing |
| Docling Service | 5 replicas + 1 load balancer | 4GB each | PDF text extraction |
| Redis | 1 | 256MB | Cache + job queue |

### Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite | Served exclusively through nginx |
| Backend | Laravel 11 (PHP 8.2+) | REST API with Bearer token auth |
| Database | Supabase PostgreSQL | Production; SQLite for local dev |
| Cache/Queue | Redis 7 | Queue connection + caching |
| PDF Extraction | Python Docling + EasyOCR | Async thread-pool offloading |
| AI Analysis | OpenRouter (GPT-3.5 Turbo default) | Configurable via `OPENROUTER_MODEL` |
| Deployment | Docker Compose + Azure Container Apps | CI/CD via GitHub Actions |

---

## What We've Built

### Core Features

1. **PDF Upload & Extraction**
   - Multi-page PDF text extraction via Docling library
   - OCR for image-based PDF content (EasyOCR)
   - Progress tracking via job ID polling

2. **PII Detection & Scrubbing**
   - Regex-based detection: SSN, credit cards, emails, phone numbers, dates
   - Configurable scrubbing with preservation of document structure

3. **Document Analysis**
   - Transaction classification (MCA, NSF, transfers, etc.)
   - Balance extraction and daily balance tracking
   - MCA (Merchant Cash Advance) detection and analysis
   - Revenue statistics generation

4. **Multi-Tenancy**
   - Account isolation via `X-Account-ID` header
   - User authentication with Bearer tokens
   - Per-account document ownership

5. **CSV Export (In Progress)**
   - MoneyThumb-style export formats
   - 19 export types: all transactions, credit transactions, daily balances, cash flows, MCA summaries, NSF transactions, statements summary, and more

### Infrastructure

- **Load-balanced Docling service** — 5 replicas with nginx upstream distribution and keepalive connection pooling
- **Redis queue** — Async job processing with 10 Laravel workers via supervisord
- **Health monitoring** — Container healthchecks on all services + `./scripts/health-check.sh` validation script
- **Deployment automation** — `./scripts/deploy.sh` with git commit hash verification inside containers

---

## Recent Work (Last 2 Weeks)

### 1. Resolved Persistent 502 Bad Gateway Errors

**Problem:** PDF extraction requests frequently returned 502 from docling workers.

**Root Causes Identified (systematic debugging):**

| Issue | Fix |
|-------|-----|
| Job timeout mismatch | `ProcessPdfExtraction.php`: increased `$timeout` from 300s → 900s to match HTTP timeout |
| OOM from OCR on large PDFs | `server.py`: skip OCR for PDFs >20 pages with images to prevent memory exhaustion |
| MemoryError propagation | `converter.py`: catch `MemoryError` with descriptive error instead of silent crash |
| Nginx upstream connection churn | `docling-lb.conf`: added `keepalive 16` for connection pooling |

**Files Modified:**
- `backend/app/Jobs/ProcessPdfExtraction.php`
- `python-service/src/server.py`
- `python-service/src/converter.py`
- `docker/nginx-conf/docling-lb.conf`
- `docker-compose.yml` (healthcheck on docling-lb)
- `scripts/health-check.sh`
- `scripts/deploy.sh` (new)

### 2. Created Deployment & Health-Check Scripts

- **`scripts/deploy.sh`** — Forces rebuild and recreate, verifies git commit hash inside containers to confirm code version
- **`scripts/health-check.sh`** — Validates all services (frontend, Laravel, Redis, Docling replicas), tests endpoints, performs a live PDF upload test

### 3. Frontend Reliability

- Backend changes propagated; no further developer console errors reported
- nginx now serves all frontend assets correctly

---

## Current Work

### 1. CSV Export Parity with MoneyThumb

**Objective:** Implement 19 CSV export types matching MoneyThumb's export formats.

**Status:** Type definitions and export options defined in `frontend/src/types/export.ts`. UI implementation is in progress.

**Export Types:**
- All Transactions, Credit Transactions, Daily Balances, Daily Cash Flows
- Incoming/Outgoing Transfers, Large Transactions, MCA Transactions
- Monthly Cash Flows, Monthly MCA, Monthly Negative Days
- Non-True Credit Transactions, NSF Transactions, Overdraft Transactions
- Repeating Transactions, Returned Transactions, Revenue Statistics
- Statements Summary, True Credit Transactions

### 2. Ongoing Reliability Monitoring

- Health-check script recently fixed to handle containers without healthcheck definitions
- `docling-lb` container needs recreation to pick up new healthcheck definition:
  ```bash
  docker-compose up -d --force-recreate docling-lb
  ```

---

## Current System Health

```
✅ Frontend (nginx routing working)
✅ Laravel API (health + readiness endpoints responding)
✅ Redis (healthy, PING responding)
✅ Docling Service (5/5 replicas healthy, lb routing working)
✅ PDF Extraction (test PDF uploaded successfully)
⚠️  docling-lb healthcheck — needs container recreation to activate
```

Last health check: April 6, 2026 — All checks passed.

---

## Open Issues

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| docling-lb healthcheck not yet active | Low | Pending | Requires `docker-compose up -d --force-recreate docling-lb` |
| CSV export UI not fully implemented | Medium | In Progress | Backend types defined; frontend hooks pending |
| Memory pressure on large PDFs | Medium | Mitigated | OCR skipped for >20 page PDFs; further monitoring needed |

---

## What's Next

1. **Complete CSV export UI** — Connect export hooks to backend types, implement download flow
2. **Performance testing** — Load test PDF extraction under concurrent upload scenarios
3. **Monitoring dashboard** — Prometheus + Grafana dashboards for docling queue depth, extraction latency, OCR skip rate
4. **Production deployment** — Azure Container Apps deployment via `azd up` with updated code

---

## Team

- **Backend:** Laravel 11, PHP 8.2+, Supabase PostgreSQL, Redis
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Python Service:** FastAPI, Docling, EasyOCR, Prometheus metrics
- **Infrastructure:** Docker Compose, Azure Container Apps, GitHub Actions CI/CD

---

## Reference

- **Project CLAUDE.md:** `/MCA_PDF_Scrubber/CLAUDE.md`
- **Health check:** `./scripts/health-check.sh`
- **Deploy script:** `./scripts/deploy.sh`
- **API documentation:** All routes prefixed `/api/v1` (see CLAUDE.md for full endpoint table)
