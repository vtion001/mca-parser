FROM python:3.11-slim

WORKDIR /app

# Install system dependencies in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first for better layer caching
COPY requirements.txt .

# Pre-install CPU-only torch first (much smaller than CUDA version)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision --timeout=300

# Install remaining dependencies from requirements.txt
RUN pip install --no-cache-dir --break-system-packages \
    -r requirements.txt \
    --timeout=600

# Copy application code
COPY . .

EXPOSE 8001

CMD ["python", "-m", "src.server"]
