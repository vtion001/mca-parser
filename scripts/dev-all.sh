#!/bin/bash
# ============================================================
# MCA PDF Scrubber — Quick Start
# ============================================================
# All-in-one: starts Laravel API + Vite frontend + Docling service.
# Run from MCA_PDF_Scrubber/ root:
#   ./scripts/dev-all.sh
#
# Access points:
#   App (nginx):   http://localhost:8000
#   Frontend HMR: http://localhost:4200
#   Laravel API:  http://localhost:9000
#   Docling:      http://localhost:8001
# ============================================================

set -e

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/frontend"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/backend"
SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd)/python-service"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log() { echo -e "${GREEN}[dev-all]${NC} $1"; }
warn() { echo -e "${YELLOW}[dev-all]${NC} $1"; }

# Kill anything on our ports
kill_ports() {
    for port in 4200 8000 8001 9000; do
        if lsof -ti :$port &>/dev/null; then
            warn "Port $port in use — killing..."
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    done
}

# Ensure deps are installed
ensure_deps() {
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        log "Installing frontend deps..."
        cd "$FRONTEND_DIR" && npm install
    fi
}

log "Starting MCA PDF Scrubber dev stack..."

kill_ports
ensure_deps

# Start Laravel (API)
log "Starting Laravel on :9000..."
cd "$BACKEND_DIR" && php artisan serve --port=9000 &

# Start Python Docling service
log "Starting Docling service on :8001..."
cd "$SERVICE_DIR" && python -m src.server &

# Start Vite frontend (HMR)
log "Starting React/Vite on :4200..."
cd "$FRONTEND_DIR" && npm run dev &

sleep 2

log ""
log "=============================================="
log "  Dev stack running:"
log "  🌐  App:        http://localhost:8000"
log "  ⚛️  Frontend:  http://localhost:4200"
log "  🔧  Laravel:   http://localhost:9000"
log "  🐍  Docling:  http://localhost:8001"
log "=============================================="
log ""
log "Press Ctrl+C to stop all services."

# Wait for any background process to exit
wait
