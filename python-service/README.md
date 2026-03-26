# MCA PDF Scrubber - Python Docling Service

## Overview

High-performance PDF text extraction microservice using docling library.

## Requirements

- Python 3.10+
- PyTorch 2.0+
- Docling 2.0+

## Installation

```bash
cd python-service
pip install -r requirements.txt
```

## Running

```bash
python src/server.py
```

The service runs on `http://localhost:8001` by default.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/` | Service info |
| POST | `/extract` | Extract text from PDF file |
| POST | `/extract-url` | Extract text from URL (e.g., arxiv PDF) |

## Example Usage

```python
# Extract from file
import requests

with open("document.pdf", "rb") as f:
    response = requests.post(
        "http://localhost:8001/extract",
        files={"file": f}
    )
    data = response.json()
    print(data["text"])

# Extract from URL (e.g., arxiv)
response = requests.post(
    "http://localhost:8001/extract-url",
    json={"url": "https://arxiv.org/pdf/2408.09869"}
)
```

## Docker

```bash
docker build -t docling-service python-service/
docker run -p 8001:8001 docling-service
```
