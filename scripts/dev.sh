#!/bin/bash
# ============================================================
# MCA PDF Scrubber — Dev Mode Launcher
# ============================================================
# Starts the full dev environment with hot reload:
#   - Laravel (php artisan serve) on :9000
#   - React/Vite HMR on :4200
#   - nginx reverse proxy on :8000
#   - File watcher → auto-rebuilds docling on code change
#
# Usage:
#   ./scripts/dev.sh start    # Start dev environment
#   ./scripts/dev.sh stop    # Stop dev environment
#   ./scripts/dev.sh restart  # Restart dev environment
#   ./scripts/dev.sh logs    # Tail logs
#   ./scripts/dev.sh status   # Show container status
# ============================================================

set -e
COMPOSE_FILE="-f docker-compose.yml -f docker-compose.dev.yml"
COMPOSE="docker compose $COMPOSE_FILE"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[dev]${NC} $1"; }
warn() { echo -e "${YELLOW}[dev]${NC} $1"; }
err() { echo -e "${RED}[dev]${NC} $1"; }

check_env() {
    if [ ! -f .env ]; then
        warn ".env not found — copying from .env.docker.example"
        if [ -f .env.docker.example ]; then
            cp .env.docker.example .env
        else
            err ".env.docker.example not found. Create .env manually."
            exit 1
        fi
    fi
    if [ -z "$OPENROUTER_API_KEY" ]; then
        err "OPENROUTER_API_KEY is not set in .env"
        exit 1
    fi
}

cmd_start() {
    log "Starting MCA PDF Scrubber dev environment..."
    check_env

    log "Building dev images (first run may take a few minutes)..."
    $COMPOSE up -d --build redis docling-lb laravel-dev laravel-worker-dev frontend-dev nginx-dev docling-watcher

    log ""
    log "=============================================="
    log "  Dev environment running:"
    log "  🌐  App:         http://localhost:8000"
    log "  ⚛️  Frontend:   http://localhost:4200"
    log "  🔧  Laravel:    http://localhost:9000"
    log "  👀  Docling watcher active"
    log "=============================================="
    log ""
    log "Hot reload:"
    log "  • React/TypeScript → auto-rebuilds in browser (HMR)"
    log "  • Laravel PHP       → auto-reloads on save"
    log "  • Python/docling    → auto-rebuilds docling containers"
    log ""
    log "Logs:    ./scripts/dev.sh logs"
    log "Stop:    ./scripts/dev.sh stop"
}

cmd_stop() {
    log "Stopping dev environment..."
    $COMPOSE down --remove-orphans
    log "Done."
}

cmd_restart() {
    cmd_stop
    sleep 1
    cmd_start
}

cmd_logs() {
    $COMPOSE logs -f --tail=50
}

cmd_status() {
    $COMPOSE ps
}

case "${1:-start}" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_restart ;;
    logs)    cmd_logs ;;
    status)  cmd_status ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status}"
        exit 1
        ;;
esac
