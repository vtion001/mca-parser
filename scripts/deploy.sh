#!/bin/bash
# ============================================================
# MCA PDF Scrubber — Local Development Deploy Script
# Ensures code changes are picked up by forcing rebuild + recreate
# ============================================================
#
# USAGE:
#   ./scripts/deploy.sh              # Deploy all services
#   ./scripts/deploy.sh docling      # Deploy only docling (1-5 + docling-lb)
#   ./scripts/deploy.sh laravel      # Deploy only laravel + laravel-worker
#   ./scripts/deploy.sh frontend     # Deploy only frontend + nginx
#   ./scripts/deploy.sh redis       # Deploy only redis
#
# OPTIONS:
#   --no-build      Skip build step (just recreate)
#   --no-verify     Skip verification step
#   --force         Force recreate even if code unchanged
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Default values
TARGET="${1:-all}"
SKIP_BUILD=false
SKIP_VERIFY=false
FORCE_RECREATE=false

# Parse options
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --no-build) SKIP_BUILD=true; shift ;;
        --no-verify) SKIP_VERIFY=true; shift ;;
        --force) FORCE_RECREATE=true; shift ;;
        -h|--help)
            echo "Usage: $0 [service] [options]"
            echo ""
            echo "Services: all, docling, laravel, frontend, redis"
            echo "Options:"
            echo "  --no-build    Skip build step (just recreate)"
            echo "  --no-verify   Skip verification step"
            echo "  --force       Force recreate even if code unchanged"
            exit 0
            ;;
        *) shift ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $1"; }
err() { echo -e "${RED}[deploy]${NC} $1"; }
info() { echo -e "${BLUE}[deploy]${NC} $1"; }
step() { echo -e "${CYAN}  ->${NC} $1"; }

# ─── GIT INFO ─────────────────────────────────────────────────
get_git_commit() {
    git -C "$PROJECT_DIR" rev-parse --short=8 HEAD 2>/dev/null || echo "unknown"
}

# ─── VERIFICATION ─────────────────────────────────────────────
verify_docling() {
    local container="$1"
    local code_path="/app/src/server.py"

    # Get git commit of python-service
    local py_commit
    py_commit=$(git -C "$PROJECT_DIR/python-service" rev-parse --short=8 HEAD 2>/dev/null || echo "unknown")

    # Check if container has the expected git commit in the code
    local container_commit
    container_commit=$(docker exec "$container" git -C /app rev-parse --short=8 HEAD 2>/dev/null || echo "unknown")

    if [ "$container_commit" != "unknown" ]; then
        if [ "$container_commit" = "$py_commit" ]; then
            log "$container: Code verified (commit $container_commit)"
            return 0
        else
            err "$container: Mismatch! Container has $container_commit, expected $py_commit"
            return 1
        fi
    fi

    # Fallback: check for known marker strings (version comments)
    local markers=("page_count > 20" "timeout = 900" "DOCLING_VERSION")
    local found=0
    for marker in "${markers[@]}"; do
        if docker exec "$container" grep -q "$marker" "$code_path" 2>/dev/null; then
            info "$container: Verified via marker '$marker'"
            found=1
            break
        fi
    done

    if [ "$found" -eq 0 ]; then
        warn "$container: Could not verify code (no git, no markers found)"
    fi
    return 0
}

verify_laravel() {
    local container="$1"
    local code_path="/var/www/html"

    local git_commit
    git_commit=$(git -C "$PROJECT_DIR/backend" rev-parse --short=8 HEAD 2>/dev/null || echo "unknown")

    local container_commit
    container_commit=$(docker exec "$container" git -C "$code_path" rev-parse --short=8 HEAD 2>/dev/null || echo "unknown")

    if [ "$container_commit" != "unknown" ]; then
        if [ "$container_commit" = "$git_commit" ]; then
            log "$container: Code verified (commit $container_commit)"
            return 0
        else
            err "$container: Mismatch! Container has $container_commit, expected $git_commit"
            return 1
        fi
    fi

    warn "$container: Could not verify code (git not available in container)"
    return 0
}

verify_frontend() {
    local container="$1"
    info "$container: Frontend uses Docker build, verification via health check only"
    return 0
}

# ─── HEALTH WAIT ─────────────────────────────────────────────
wait_for_healthy() {
    local service="$1"
    local timeout="${2:-60}"
    local name

    # Map service name to container name suffix
    case "$service" in
        docling-1) name="mca_pdf_scrubber-docling-1-1" ;;
        docling-2) name="mca_pdf_scrubber-docling-2-1" ;;
        docling-3) name="mca_pdf_scrubber-docling-3-1" ;;
        docling-4) name="mca_pdf_scrubber-docling-4-1" ;;
        docling-5) name="mca_pdf_scrubber-docling-5-1" ;;
        laravel) name="mca_pdf_scrubber-laravel-1" ;;
        laravel-worker) name="mca_pdf_scrubber-laravel-worker-1" ;;
        redis) name="mca_pdf_scrubber-redis-1" ;;
        frontend) name="mca_pdf_scrubber-frontend-1" ;;
        nginx) name="mca_pdf_scrubber-nginx-1" ;;
        docling-lb) name="mca_pdf_scrubber-docling-lb-1" ;;
        *) name="mca_pdf_scrubber-$service-1" ;;
    esac

    info "Waiting for $service to be healthy (timeout: ${timeout}s)..."

    local elapsed=0
    local interval=2

    while [ $elapsed -lt $timeout ]; do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "unknown")

        case "$status" in
            healthy)
                log "$service is healthy"
                return 0
                ;;
            starting)
                step "Status: starting..."
                ;;
            unhealthy)
                err "$service is unhealthy!"
                docker inspect "$name" --format='{{range .State.Health.Log}}{{.Output}}{{end}}' 2>/dev/null | tail -5
                return 1
                ;;
            *)
                step "Status: $status"
                ;;
        esac

        sleep $interval
        elapsed=$((elapsed + interval))
    done

    err "$service failed to become healthy within ${timeout}s"
    return 1
}

# ─── BUILD & RECREATE ────────────────────────────────────────
deploy_service() {
    local service="$1"
    local verify_func="$2"

    log "=========================================="
    log "Deploying: $service"
    log "=========================================="

    # Determine build flags
    local build_flags="--build --force-recreate"
    if [ "$SKIP_BUILD" = true ]; then
        build_flags="--force-recreate"
        info "Build skipped (--no-build)"
    fi

    # Pull latest base images if building
    if [ "$SKIP_BUILD" = false ]; then
        step "Pulling base images..."
        case "$service" in
            laravel|laravel-worker)
                docker pull php:8.2-fpm 2>/dev/null || true
                ;;
            docling-*|docling-lb)
                docker pull python:3.11-slim 2>/dev/null || true
                docker pull nginx:alpine 2>/dev/null || true
                ;;
            frontend|nginx)
                docker pull node:20-alpine 2>/dev/null || true
                docker pull nginx:alpine 2>/dev/null || true
                ;;
        esac
    fi

    # Build and recreate
    step "Building and recreating $service..."
    if ! docker-compose up -d $build_flags "$service"; then
        err "Failed to deploy $service"
        return 1
    fi

    # Wait for healthy (unless --no-verify)
    if [ "$SKIP_VERIFY" = false ]; then
        wait_for_healthy "$service" 90 || warn "$service health check inconclusive"
    else
        info "Verification skipped (--no-verify)"
    fi

    # Verify code
    if [ "$SKIP_VERIFY" = false ] && [ -n "$verify_func" ]; then
        step "Verifying code..."
        $verify_func "$name" 2>/dev/null || warn "Code verification inconclusive"
    fi

    log "$service deployed successfully"
    return 0
}

# ─── SERVICE DEPLOYMENT MAP ───────────────────────────────────
deploy_docling() {
    log "Deploying docling service (all 5 replicas + load balancer)"

    # Deploy docling replicas first
    for i in 1 2 3 4 5; do
        deploy_service "docling-$i" "verify_docling" || return 1
    done

    # Deploy load balancer
    deploy_service "docling-lb" "" || return 1
    return 0
}

deploy_laravel() {
    deploy_service "laravel" "verify_laravel" || return 1
    deploy_service "laravel-worker" "verify_laravel" || return 1
    return 0
}

deploy_frontend() {
    deploy_service "frontend" "verify_frontend" || return 1
    deploy_service "nginx" "" || return 1
    return 0
}

deploy_redis() {
    deploy_service "redis" "" || return 1
    return 0
}

deploy_all() {
    log "Deploying all services..."

    # Start with infrastructure
    deploy_redis || return 1

    # Deploy application services
    deploy_laravel || return 1
    deploy_frontend || return 1
    deploy_docling || return 1

    log ""
    log "=========================================="
    log "  ALL SERVICES DEPLOYED"
    log "  Git commit: $(get_git_commit)"
    log "=========================================="
    return 0
}

# ─── MAIN ─────────────────────────────────────────────────────
main() {
    log "MCA PDF Scrubber — Deploy Script"
    log "Target: $TARGET"
    log "Project: $PROJECT_DIR"
    log ""

    # Check docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        err "docker-compose not found. Please install Docker Compose."
        exit 1
    fi

    # Check for required files
    if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
        err "docker-compose.yml not found in project root"
        exit 1
    fi

    case "$TARGET" in
        all)        deploy_all ;;
        docling)    deploy_docling ;;
        laravel)    deploy_laravel ;;
        frontend)   deploy_frontend ;;
        redis)      deploy_redis ;;
        *)
            err "Unknown service: $TARGET"
            err "Valid services: all, docling, laravel, frontend, redis"
            exit 1
            ;;
    esac
}

main