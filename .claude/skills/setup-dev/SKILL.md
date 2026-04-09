---
name: setup-dev
description: Set up the MCA PDF Scrubber development environment (frontend, backend, Python service)
disable-model-invocation: true
---

# Setup Dev

Set up the MCA PDF Scrubber development environment for all three services.

## Prerequisites Check

Before starting, verify the following are installed:
- **Node.js** 18 or higher (`node --version`)
- **PHP** 8.2 or higher (`php --version`)
- **Python** 3.10 or higher (`python --version`)
- **Docker Desktop** installed and running

If any prerequisite is missing, install it before proceeding.

## 1. Frontend Setup

```bash
cd frontend && npm install
```

This installs React 18, TypeScript, Vite, and TailwindCSS dependencies.

## 2. Backend Setup

```bash
cd backend && composer install && cp .env.example .env && php artisan key:generate
```

This installs Laravel 11 dependencies, creates the environment file, and generates an application key.

## 3. Python Service Setup

```bash
cd python-service && pip install -r requirements.txt
```

This installs FastAPI, Docling, and EasyOCR dependencies.

## 4. Verify Installation

### Option A: Full Stack with Docker Compose
```bash
docker-compose up --build
```
This builds and starts all three services (docker-compose.override.yml auto-applied):
- Frontend: http://localhost:5173 (Vite dev server, overrides nginx on 8000)
- Backend: http://localhost:8000/api/v1 (nginx routes to Laravel)
- Python Service: via nginx at http://localhost:8000/api/v1/health/docling

### Option B: Run Services Individually

**Frontend:**
```bash
cd frontend && npm run dev
```

**Backend:**
```bash
cd backend && php artisan serve
```

**Python Service:**
```bash
cd python-service && python src/server.py
```

## 5. Verify Services are Running

Check each service:
- Frontend health: http://localhost:5173 (Vite dev server when using docker-compose override)
- Backend health: http://localhost:8000/api/v1/health
- Docling health: http://localhost:8000/api/v1/health/docling

## Common Issues

- **Port conflicts**: Ensure ports 4200/5173, 8000, and 8001 are available
- **Docker not running**: Start Docker Desktop before running `docker-compose up`
- **Missing PHP extensions**: Laravel may require bcmath, json, or other PHP extensions
- **Python version**: Ensure Python 3.10+ is the default `python` command
- **Wrong frontend port**: `docker-compose up` uses port 5173 (via override); `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --profile dev` uses port 4200

## Project Architecture

```
React Frontend (Port 5173) → Laravel API (Port 8000) → Python Docling Service (Port 8001)
```
