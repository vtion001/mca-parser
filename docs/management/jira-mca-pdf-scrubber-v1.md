# Jira: MCA PDF Scrubber v1.0

**Project:** MCA
**Type:** Epic
**Status:** In Progress

---

## Epic: MCA PDF Scrubber v1.0

### Description

MCA PDF Scrubber is a full-stack PDF document processing platform for uploading PDF bank statements and financial documents, extracting text via Docling, analyzing content, and scrubbing personally identifiable information (PII).

### Goal

Deliver a production-ready PDF processing platform with reliable extraction, AI-powered analysis, PII scrubbing, and MoneyThumb-style CSV exports.

### Background

The system uses a microservices architecture with:
- React frontend served through nginx
- Laravel 11 REST API with Bearer token auth
- Python Docling service (5 replicas, load-balanced) for PDF text extraction
- Redis queue for async job processing
- Supabase PostgreSQL for persistence
- OpenRouter AI for document analysis

### Scope

| Feature | Description | Priority |
|---------|-------------|----------|
| PDF Upload & Extraction | Multi-page PDF text extraction via Docling + EasyOCR | P0 |
| PII Detection & Scrubbing | Regex-based SSN, credit card, email, phone detection | P0 |
| Document Analysis | Transaction classification, balance extraction, MCA detection | P0 |
| CSV Export | 19 MoneyThumb-style export formats | P1 |
| Multi-Tenancy | Account isolation via X-Account-ID header | P0 |
| Production Deployment | Azure Container Apps via azd | P1 |

---

## Stories

### Story 1: CSV Export UI Implementation
**Status:** In Progress
**Priority:** P1

Implement frontend hooks to connect export types defined in `frontend/src/types/export.ts` to actual CSV download functionality.

**Acceptance Criteria:**
- [ ] All 19 export types selectable from UI
- [ ] CSV downloads correctly formatted per MoneyThumb spec
- [ ] Export works for authenticated users only

**Files:**
- `frontend/src/types/export.ts` (done)
- `frontend/src/utils/csvExport.ts` (done)
- UI hooks: pending

---

### Story 2: docling-lb Healthcheck Activation
**Status:** To Do
**Priority:** P2

Recreate docling-lb container to activate the new healthcheck defined in docker-compose.yml.

**Acceptance Criteria:**
- [ ] `docker-compose up -d --force-recreate docling-lb` succeeds
- [ ] Healthcheck shows as "healthy" instead of "running (no healthcheck)"
- [ ] `./scripts/health-check.sh` passes without warnings

**Command:**
```bash
docker-compose up -d --force-recreate docling-lb
./scripts/health-check.sh
```

---

### Story 3: Production Deployment
**Status:** To Do
**Priority:** P1

Deploy current codebase to Azure Container Apps via azd up.

**Acceptance Criteria:**
- [ ] `azd up` completes without errors
- [ ] All services reachable via Azure endpoint
- [ ] Health endpoints respond correctly
- [ ] PostgreSQL and Redis connections work

**Note:** Requires `OPENROUTER_API_KEY`, `SUPABASE_DB_*` env vars set in Azure.

---

### Story 4: Monitoring Dashboard
**Status:** To Do
**Priority:** P2

Set up Prometheus + Grafana dashboards for observability.

**Metrics to Track:**
| Metric | Description | Source |
|--------|-------------|--------|
| docling_queue_depth | Active extractions | Prometheus Gauge |
| docling_extraction_duration_seconds | PDF processing time | Prometheus Histogram |
| docling_ocr_total | OCR success/skipped/failure | Prometheus Counter |
| docling_pdf_pages | Pages per processed PDF | Prometheus Histogram |

**Acceptance Criteria:**
- [ ] Prometheus scrapes all docling /metrics endpoints
- [ ] Grafana dashboard shows queue depth, latency, OCR rates
- [ ] Alerts configured for >90% queue depth or >10% OCR failure rate

---

## Definition of Done

- [ ] All P0 stories complete
- [ ] Health checks pass on all containers
- [ ] No critical vulnerabilities in dependency scan
- [ ] API documentation updated
- [ ] Deployment verified on Azure
