#!/bin/bash
# ============================================================
# MCA PDF Scrubber — Deploy to Azure Container Apps
# Uses: docker compose → Azure Container Apps
# ============================================================
# PREREQUISITES (one-time):
#   brew install azure-cli
#   az login
#   az provider register --namespace Microsoft.App
#
# USAGE:
#   ./scripts/deploy.sh          # Full deploy
#   ./scripts/deploy.sh build    # Build + push images only
#   ./scripts/deploy.sh infra    # Create infrastructure only
# ============================================================

set -e

LOCATION="southeastasia"
RESOURCE_GROUP="mca-pdf-scrubber-rg"
ACR_NAME="mcasharpdf$(date +%m%d)"
ENV_NAME="mca-env"
APP_NAME="mca-app"
IMAGE_TAG="latest"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $1"; }
err() { echo -e "${RED}[deploy]${NC} $1"; }

# ─── CHECKS ──────────────────────────────────────────────────
check_azure() {
    log "Checking Azure CLI..."
    if ! command -v az &> /dev/null; then
        err "Azure CLI not installed. Run: brew install azure-cli"
        exit 1
    fi
    ACCOUNT=$(az account show --query user.name -o tsv 2>/dev/null) || true
    if [ -z "$ACCOUNT" ]; then
        warn "Not logged in to Azure. Running 'az login'..."
        az login --use-device-code
    fi
    log "Logged in as: $(az account show --query user.name -o tsv)"
}

check_env() {
    log "Checking environment variables..."
    if [ -z "$OPENROUTER_API_KEY" ]; then
        warn "OPENROUTER_API_KEY not set. Set it in .env or export it:"
        warn "  export OPENROUTER_API_KEY='your-key'"
    fi
}

# ─── BUILD & PUSH ─────────────────────────────────────────────
build_images() {
    log "Building and pushing Docker images to Azure Container Registry..."

    # Create ACR if not exists
    if ! az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log "Creating Azure Container Registry: $ACR_NAME"
        az acr create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$ACR_NAME" \
            --sku Basic \
            --location "$LOCATION" \
            --admin-enable true
    fi

    ACR_LOGIN=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
    ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)

    log "Logging in to ACR: $ACR_LOGIN"
    echo "$ACR_PASSWORD" | docker login "$ACR_LOGIN" -u "00000000-0000-0000-0000-000000000000" --password-stdin

    # Build all images
    log "Building Docker images..."
    docker build -t "$ACR_LOGIN/laravel:$IMAGE_TAG" -f docker/Dockerfile.laravel backend/
    docker build -t "$ACR_LOGIN/docling:$IMAGE_TAG" python-service/
    docker build -t "$ACR_LOGIN/frontend:$IMAGE_TAG" frontend/

    # Push
    log "Pushing images..."
    docker push "$ACR_LOGIN/laravel:$IMAGE_TAG"
    docker push "$ACR_LOGIN/docling:$IMAGE_TAG"
    docker push "$ACR_LOGIN/frontend:$IMAGE_TAG"

    log "✅ Images pushed: $ACR_LOGIN/{laravel,docling,frontend}:$IMAGE_TAG"
}

# ─── CREATE INFRASTRUCTURE ───────────────────────────────────
create_infra() {
    log "Creating Azure infrastructure..."

    # Resource group
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" 2>/dev/null || true

    # Container Apps Environment
    log "Creating Container Apps Environment..."
    az containerapp env create \
        --name "$ENV_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" 2>/dev/null || log "Environment may already exist, continuing..."

    # Azure Cache for Redis
    log "Creating Redis..."
    az redis create \
        --name "${ACR_NAME}redis" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku Basic \
        --vm-size c0 \
        --enable-non-ssl-port 2>/dev/null || log "Redis may already exist"

    # Azure Database for PostgreSQL
    log "Creating PostgreSQL..."
    DB_NAME="${ACR_NAME}db"
    az postgres flexible-server create \
        --name "$DB_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --admin-user pgadmin \
        --admin-password "TempPass123!" \
        --sku-name B1s \
        --storage-sizeGB 20 \
        --version 15 \
        --database-name mca_pdf \
        2>/dev/null || log "PostgreSQL may already exist"

    log "✅ Infrastructure created"
}

# ─── DEPLOY ───────────────────────────────────────────────────
deploy_compose() {
    log "Deploying to Azure Container Apps via Docker Compose..."

    ACR_LOGIN=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
    ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)

    # Get PostgreSQL and Redis connection info
    DB_NAME="${ACR_NAME}db"
    DB_HOST=$(az postgres flexible-server show --name "$DB_NAME" --resource-group "$RESOURCE_GROUP" --query fullyQualifiedDomainName -o tsv 2>/dev/null || echo "${DB_NAME}.postgres.database.azure.com")
    REDIS_HOST=$(az redis show --name "${ACR_NAME}redis" --resource-group "$RESOURCE_GROUP" --query hostName -o tsv 2>/dev/null || echo "${ACR_NAME}redis.redis.cache.windows.net")

    # Create a temporary compose override for Azure
    cat > docker-compose.azure.yml << EOF
services:
  laravel:
    image: ${ACR_LOGIN}/laravel:${IMAGE_TAG}
    ports:
      - "8000:9000"
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
      - DB_CONNECTION=pgsql
      - DB_HOST=${DB_HOST}
      - DB_PORT=5432
      - DB_DATABASE=mca_pdf
      - DB_USERNAME=pgadmin
      - DB_PASSWORD=TempPass123!
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=6380
      - DOCLING_SERVICE_URL=http://docling-lb:8001
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    expose:
      - "9000"

  docling-lb:
    image: ${ACR_LOGIN}/docling:${IMAGE_TAG}
    ports:
      - "8001:8001"
    expose:
      - "8001"
    environment:
      - PYTHONUNBUFFERED=1

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    expose:
      - "6379"
EOF

    log "Deploying compose file to Azure Container Apps..."
    az containerapp compose create \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$ENV_NAME" \
        --file docker-compose.azure.yml \
        --registry-server "$ACR_LOGIN" \
        --registry-username "$ACR_USERNAME" \
        --registry-password "$ACR_PASSWORD" \
        --location "$LOCATION" \
        --output table

    APP_URL=$(az containerapp show \
        --name "${APP_NAME}-laravel" \
        --resource-group "$RESOURCE_GROUP" \
        --query properties.fqdn -o tsv 2>/dev/null || echo "check Azure Portal")

    log ""
    log "=========================================="
    log "  ✅ DEPLOYED!"
    log "  App URL: https://${APP_URL}"
    log "  ACR: $ACR_LOGIN"
    log "=========================================="
}

# ─── FULL DEPLOY ────────────────────────────────────────────────
cmd_full() {
    check_azure
    check_env
    build_images
    create_infra
    deploy_compose
}

# ─── MAIN ─────────────────────────────────────────────────────
case "${1:-full}" in
    full)    cmd_full ;;
    build)   check_azure && build_images ;;
    infra)   check_azure && create_infra ;;
    deploy)  check_azure && deploy_compose ;;
    *)
        echo "Usage: $0 {full|build|infra|deploy}"
        exit 1 ;;
esac
