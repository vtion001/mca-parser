FROM python:3.11-slim

WORKDIR /app

# Install system dependencies in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first for better layer caching
COPY python-service/requirements.txt .

# Pre-install CPU-only torch first (much smaller than CUDA version)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision --timeout=300

# Install remaining dependencies
RUN pip install --no-cache-dir --break-system-packages \
    fastapi>=0.109.0 \
    uvicorn[standard]>=0.27.0 \
    python-multipart>=0.0.6 \
    httpx>=0.26.0 \
    pydantic>=2.5.0

# Install docling separately (it's huge, handle with care)
RUN pip install --no-cache-dir --break-system-packages \
    docling>=2.0.0 \
    --timeout=600

# Copy application code
COPY python-service/ .

EXPOSE 8001

CMD ["python", "src/server.py"]
