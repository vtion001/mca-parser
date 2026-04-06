#!/bin/bash
# ============================================================
# MCA PDF Scrubber — Health Check Script
# Verifies all services are running correctly
# ============================================================
#
# USAGE:
#   ./scripts/health-check.sh              # Check all services
#   ./scripts/health-check.sh docling      # Check docling only
#   ./scripts/health-check.sh laravel      # Check laravel only
#   ./scripts/health-check.sh --quick      # Skip deep checks (no PDF test)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Options
QUICK=false
TARGET="${1:-all}"

while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --quick) QUICK=true; shift ;;
        -h|--help)
            echo "Usage: $0 [service] [options]"
            echo ""
            echo "Services: all, docling, laravel, frontend, redis"
            echo "Options:"
            echo "  --quick    Skip deep checks (no PDF extraction test)"
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

PASS() { echo -e "${GREEN}[PASS]${NC} $1"; }
FAIL() { echo -e "${RED}[FAIL]${NC} $1"; }
WARN() { echo -e "${YELLOW}[WARN]${NC} $1"; }
INFO() { echo -e "${BLUE}[INFO]${NC} $1"; }
STEP() { echo -e "${CYAN}  ->${NC} $1"; }

# Track overall status
OVERALL=0

# ─── CONTAINER CHECKS ────────────────────────────────────────
check_container_health() {
    local name="$1"
    local expected_status="${2:-healthy}"

    # Check if container exists and is running first
    local running
    running=$(docker inspect --format='{{.State.Running}}' "$name" 2>/dev/null || echo "false")

    if [ "$running" != "true" ]; then
        FAIL "$name is not running"
        return 1
    fi

    # Check for health status (may not exist if no healthcheck defined)
    local actual_status
    actual_status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "")

    # If no healthcheck defined, just show running status
    if [ -z "$actual_status" ]; then
        PASS "$name is running (no healthcheck)"
        return 0
    fi

    if [ "$actual_status" = "$expected_status" ]; then
        PASS "$name is $actual_status"
        return 0
    else
        FAIL "$name is $actual_status (expected $expected_status)"
        return 1
    fi
}

check_container_running() {
    local name="$1"

    local running
    running=$(docker inspect --format='{{.State.Running}}' "$name" 2>/dev/null || echo "false")

    if [ "$running" = "true" ]; then
        PASS "$name is running"
        return 0
    else
        FAIL "$name is not running"
        return 1
    fi
}

# ─── SERVICE CHECKS ───────────────────────────────────────────
check_docling_service() {
    INFO "Checking Docling service..."

    # Check all docling replicas
    local replicas=(
        "mca_pdf_scrubber-docling-1-1"
        "mca_pdf_scrubber-docling-2-1"
        "mca_pdf_scrubber-docling-3-1"
        "mca_pdf_scrubber-docling-4-1"
        "mca_pdf_scrubber-docling-5-1"
    )

    local docling_ok=0
    for replica in "${replicas[@]}"; do
        if ! check_container_health "$replica" "healthy" 2>/dev/null; then
            docling_ok=1
        fi
    done

    # Check docling-lb
    check_container_health "mca_pdf_scrubber-docling-lb-1" "healthy" 2>/dev/null || docling_ok=1

    # Test health endpoint via API
    STEP "Testing health endpoint via load balancer..."
    if curl -sf --max-time 10 "http://localhost:8000/api/v1/health/docling" > /dev/null 2>&1; then
        PASS "Docling health endpoint responds"
    else
        FAIL "Docling health endpoint failed"
        docling_ok=1
    fi

    if [ "$docling_ok" -eq 0 ]; then
        PASS "All docling services healthy"
    else
        OVERALL=1
    fi
}

check_laravel_service() {
    INFO "Checking Laravel service..."

    local laravel_ok=0

    check_container_health "mca_pdf_scrubber-laravel-1" "healthy" 2>/dev/null || laravel_ok=1
    check_container_running "mca_pdf_scrubber-laravel-worker-1" 2>/dev/null || laravel_ok=1

    # Test Laravel health endpoint
    STEP "Testing Laravel health endpoint..."
    if curl -sf --max-time 10 "http://localhost:8000/api/v1/health" > /dev/null 2>&1; then
        PASS "Laravel health endpoint responds"
    else
        FAIL "Laravel health endpoint failed"
        laravel_ok=1
    fi

    # Test readiness endpoint
    STEP "Testing Laravel readiness endpoint..."
    if curl -sf --max-time 10 "http://localhost:8000/api/v1/health/ready" > /dev/null 2>&1; then
        PASS "Laravel readiness endpoint responds"
    else
        FAIL "Laravel readiness endpoint failed"
        laravel_ok=1
    fi

    if [ "$laravel_ok" -eq 0 ]; then
        PASS "All Laravel services healthy"
    else
        OVERALL=1
    fi
}

check_frontend_service() {
    INFO "Checking Frontend service..."

    local frontend_ok=0

    check_container_running "mca_pdf_scrubber-frontend-1" 2>/dev/null || frontend_ok=1
    check_container_running "mca_pdf_scrubber-nginx-1" 2>/dev/null || frontend_ok=1

    # Test frontend accessible via nginx
    STEP "Testing frontend accessibility..."
    if curl -sf --max-time 10 "http://localhost:8000" > /dev/null 2>&1; then
        PASS "Frontend is accessible via nginx"
    else
        FAIL "Frontend not accessible"
        frontend_ok=1
    fi

    if [ "$frontend_ok" -eq 0 ]; then
        PASS "Frontend services running"
    else
        OVERALL=1
    fi
}

check_redis_service() {
    INFO "Checking Redis service..."

    local redis_ok=0

    check_container_health "mca_pdf_scrubber-redis-1" "healthy" 2>/dev/null || redis_ok=1

    # Test Redis connectivity
    STEP "Testing Redis ping..."
    if docker exec mca_pdf_scrubber-redis-1 redis-cli ping 2>/dev/null | grep -q "PONG"; then
        PASS "Redis responds to PING"
    else
        FAIL "Redis PING failed"
        redis_ok=1
    fi

    if [ "$redis_ok" -eq 0 ]; then
        PASS "Redis service healthy"
    else
        OVERALL=1
    fi
}

check_pdf_extraction() {
    INFO "Testing PDF extraction..."

    # Create a minimal test PDF (single page with text)
    local test_pdf="/tmp/test-pdf-$(date +%s).pdf"
    local test_pdf_response="/tmp/test-pdf-response.json"

    # Create minimal valid PDF using printf
    # This is a minimal valid PDF with one page
    printf '%%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000317 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n409\n%%%%EOF\n' > "$test_pdf"

    STEP "Uploading test PDF..."
    local upload_response
    upload_response=$(curl -sf --max-time 60 \
        -X POST "http://localhost:8000/api/v1/pdf/upload" \
        -H "Authorization: Bearer test-token" \
        -F "file=@$test_pdf" 2>&1) || true

    rm -f "$test_pdf"

    if [ -n "$upload_response" ]; then
        STEP "Upload response received ($(echo "$upload_response" | wc -c) bytes)"
        PASS "PDF upload endpoint responds"

        # Extract job_id for progress check
        local job_id
        job_id=$(echo "$upload_response" | grep -o '"job_id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

        if [ -n "$job_id" ]; then
            STEP "Job ID: $job_id"
            PASS "Job ID extracted"
        fi
    else
        # Don't fail the entire health check if PDF extraction fails
        # (it might require auth or have other issues)
        WARN "PDF upload did not return response (may require authentication)"
    fi
}

# ─── MAIN ─────────────────────────────────────────────────────
main() {
    echo ""
    echo "=========================================="
    echo "  MCA PDF Scrubber — Health Check"
    echo "=========================================="
    echo ""

    # Overall summary
    OVERALL=0

    case "$TARGET" in
        all)
            check_frontend_service
            check_laravel_service
            check_redis_service
            check_docling_service

            if [ "$QUICK" = false ]; then
                check_pdf_extraction
            fi
            ;;

        docling)
            check_docling_service
            ;;

        laravel)
            check_laravel_service
            ;;

        frontend)
            check_frontend_service
            ;;

        redis)
            check_redis_service
            ;;

        pdf)
            check_pdf_extraction
            ;;

        *)
            FAIL "Unknown service: $TARGET"
            echo "Valid services: all, docling, laravel, frontend, redis, pdf"
            exit 1
            ;;
    esac

    echo ""
    echo "=========================================="
    if [ "$OVERALL" -eq 0 ]; then
        PASS "All checks passed!"
    else
        FAIL "Some checks failed!"
    fi
    echo "=========================================="
    echo ""

    exit $OVERALL
}

main