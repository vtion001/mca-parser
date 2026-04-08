# ADR-001: Testing Framework Decision

**Status:** Accepted
**Date:** 2026-04-08
**Deciders:** MCA PDF Scrubber team

---

## Context

MCA PDF Scrubber is a multi-service full-stack application with:
- A React + TypeScript frontend
- A Laravel (PHP 8.2+) backend
- A Python Docling service for PDF text extraction
- Integration with Supabase PostgreSQL and Redis

We need a testing strategy that covers all three layers while being practical for a small team to maintain.

---

## Decision

We adopted a **three-framework stack**:

| Layer | Framework | Test Type |
|-------|-----------|-----------|
| Backend (PHP) | PHPUnit | Unit + Feature |
| Frontend (JS/TS) | Vitest | Unit |
| Frontend E2E | Playwright | Integration |

---

## Alternatives Considered

### Jest (Frontend Unit Testing)

**Rejected.** Jest is the default for many React projects, but Vitest was chosen because:
- Identical API to Jest (zero migration cost)
- Native Vite integration (faster dev cycles)
- Built-in TypeScript support without babel configuration
- Better performance in monorepo-style project structures

### Cypress (Frontend E2E)

**Rejected in favor of Playwright.** Cypress was considered but:
- Playwright has better multi-tab and cross-browser support
- Playwright's codegen and trace viewer are more developer-friendly
- Both have similar API complexity
- Playwright's `mcp__plugin_playwright` MCP tool is already integrated in the Claude Code environment

### Puppeteer (Frontend E2E)

**Rejected.** Puppeteer requires more manual setup for browser management and lacks the cross-browser robustness of Playwright for a project targeting multiple browser engines.

---

## Why This Stack Fits MCA PDF Scrubber

### PHPUnit for Backend

- **Standard for Laravel** — Laravel's entire testing infrastructure (TestCase, factories, fakes) is built for PHPUnit
- **Mature mocking** — Mockery integration works seamlessly for service mocking
- **Feature tests** — Laravel's HTTP testing helpers make controller-level testing straightforward
- **PHP native** — No transpilation step required

### Vitest for Frontend Units

- **Vite-native** — No separate transformer needed; HMR-friendly test runs
- **Compatible with existing tests** — Most Vue/React test utilities work with Vitest
- **Fast** — Runs in Node.js without browser overhead for pure unit tests

### Playwright for E2E

- **Full-stack coverage** — Tests the entire request path: React → nginx → Laravel → Redis/PostgreSQL
- **DOCLING-agnostic** — Can test the Docling service health indirectly via the full extraction endpoint
- **Real browser** — Catches CSS/layout issues that JS-based testing misses
- **CI-ready** — Has official GitHub Actions integration and containerized browser support

---

## Implications

### Positive

- Each layer uses the most appropriate tool for its runtime environment
- Fast feedback loop: unit tests run in seconds, E2E tests run on Docker stack
- Clear separation: backend devs focus on PHPUnit, frontend devs on Vitest+Playwright
- All three frameworks are industry-standard and well-documented

### Negative

- Three different test commands to remember (`php artisan test`, `npx vitest run`, `npx playwright test`)
- E2E tests require Docker stack to be running — cannot run in complete isolation
- Gap: no shared test fixtures between PHP and JS test suites
- Gap: no unified coverage report combining all three layers

---

## Unresolved

- Unified coverage reporting (Laravel Dusk could replace Playwright for tighter Laravel integration, but Dusk is Chrome-only)
- Shared fixture management across PHP and JS
- Contract testing between Laravel API and React frontend (could use Pact or similar)
