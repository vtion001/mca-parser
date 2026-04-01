"""
MCA PDF Scrubber - Docling Microservice

High-quality PDF text extraction using docling library with OCR for images.
Optimized for throughput with async thread-pool offloading and smart OCR gating.
"""

import asyncio
import time
from contextlib import asynccontextmanager
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, REGISTRY

from . import config
from . import models
from . import converter as converter_mod
from . import ocr as ocr_mod


# ─── Prometheus Metrics (lazy-initialized per worker) ──────────────────────────
# Metrics are created lazily in lifespan() to avoid duplicate registration
# when uvicorn forks workers. Each worker process initializes its own metrics.
REQUEST_COUNT: Optional[Counter] = None
REQUEST_DURATION: Optional[Histogram] = None
PDF_PAGE_COUNT: Optional[Histogram] = None
QUEUE_DEPTH: Optional[Gauge] = None
OCR_COUNT: Optional[Counter] = None


def _init_metrics():
    """Initialize metrics lazily - called once per worker process."""
    global REQUEST_COUNT, REQUEST_DURATION, PDF_PAGE_COUNT, QUEUE_DEPTH, OCR_COUNT

    # Use _CreatedIfAbsent to avoid duplicate registration in forked processes
    # This is the safest approach for multiprocess environments
    if REQUEST_COUNT is None:
        REQUEST_COUNT = Counter(
            'docling_extraction_total', 'Total PDF extractions',
            ['status']
        )
    if REQUEST_DURATION is None:
        REQUEST_DURATION = Histogram(
            'docling_extraction_duration_seconds', 'PDF extraction duration',
            buckets=[1, 5, 10, 30, 60, 120, 300, 600]
        )
    if PDF_PAGE_COUNT is None:
        PDF_PAGE_COUNT = Histogram(
            'docling_pdf_pages', 'Number of pages in processed PDFs',
            buckets=[1, 2, 5, 10, 20, 50, 100]
        )
    if QUEUE_DEPTH is None:
        QUEUE_DEPTH = Gauge(
            'docling_queue_depth', 'Current queue depth (active extractions)'
        )
    if OCR_COUNT is None:
        OCR_COUNT = Counter(
            'docling_ocr_total', 'Total OCR extractions',
            ['status']
        )


# ─── Global singletons (initialized in lifespan) ──────────────────────────────
_io_executor: Optional[ThreadPoolExecutor] = None
_cpu_executor: Optional[ThreadPoolExecutor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize on startup, clean up on shutdown — one per worker process."""
    # Initialize metrics lazily on startup - each worker process calls this
    _init_metrics()
    global _io_executor, _cpu_executor

    converter_mod.init_converter()
    ocr_mod.init_ocr()

    _io_executor = ThreadPoolExecutor(max_workers=config.IO_THREADS, thread_name_prefix="io-")
    _cpu_executor = ThreadPoolExecutor(max_workers=config.CPU_THREADS, thread_name_prefix="cpu-")
    print(f"Thread pools started: io={config.IO_THREADS}, cpu={config.CPU_THREADS}")

    yield  # application runs here

    for ex in (_io_executor, _cpu_executor):
        if ex:
            ex.shutdown(wait=True)


app = FastAPI(
    title="Docling PDF Extraction Service",
    description="High-quality PDF text extraction using docling + EasyOCR for images",
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── CPU-bound workhorse functions (run in thread pool) ────────────────────────

def _write_temp_file(contents: bytes) -> str:
    """Write bytes to a temp file synchronously. Runs in io thread pool."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(contents)
    tmp.close()
    return tmp.name


# ─── Metrics Endpoint ──────────────────────────────────────────────────────────

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}


# ─── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check() -> models.HealthResponse:
    return models.HealthResponse(
        status="healthy",
        device=config.get_device(),
        docling_available=converter_mod.converter is not None,
        ocr_available=ocr_mod.ocr_reader is not None,
        workers=config.WORKERS,
    )


@app.post("/extract", response_model=models.ExtractResponse)
async def extract_pdf(file: UploadFile = File(...)) -> models.ExtractResponse:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    if converter_mod.converter is None:
        raise HTTPException(status_code=503, detail="Docling service not available")

    contents = await file.read()
    QUEUE_DEPTH.inc()

    start_time = time.time()

    try:
        # Write temp file in thread pool (non-blocking for event loop)
        tmp_path = await asyncio.to_thread(_write_temp_file, contents)

        # Run docling conversion in CPU thread pool (blocks thread, not event loop)
        # This allows the event loop to accept other requests while docling runs
        text, page_count = await asyncio.to_thread(converter_mod._convert_docling, tmp_path)

        # Record metrics
        duration = time.time() - start_time
        REQUEST_COUNT.labels(status='success').inc()
        REQUEST_DURATION.observe(duration)
        PDF_PAGE_COUNT.observe(page_count)

        # Smart OCR: extract images with fitz and only run OCR if images were found
        ocr_text = ""
        if ocr_mod.ocr_reader:
            images = await asyncio.to_thread(ocr_mod._extract_images, tmp_path)
            if images:
                try:
                    ocr_text = await asyncio.to_thread(ocr_mod._ocr_images_sync, tmp_path)
                    OCR_COUNT.labels(status='success').inc()
                except Exception as e:
                    print(f"OCR failed for {tmp_path}: {e}")
                    OCR_COUNT.labels(status='failure').inc()
            else:
                OCR_COUNT.labels(status='skipped').inc()
        else:
            OCR_COUNT.labels(status='skipped').inc()

        # Clean up temp file in background (fire-and-forget)
        asyncio.create_task(asyncio.to_thread(Path(tmp_path).unlink, missing_ok=True))

        return models.ExtractResponse(
            success=True,
            text=text,
            page_count=page_count,
            ocr_text=ocr_text,
        )

    except Exception as e:
        REQUEST_COUNT.labels(status='failure').inc()
        return models.ExtractResponse(
            success=False,
            text="",
            page_count=0,
            error=str(e),
        )
    finally:
        QUEUE_DEPTH.dec()


@app.post("/extract-url", response_model=models.ExtractResponse)
async def extract_from_url(request: models.UrlExtractRequest) -> models.ExtractResponse:
    if converter_mod.converter is None:
        raise HTTPException(status_code=503, detail="Docling service not available")

    QUEUE_DEPTH.inc()
    start_time = time.time()

    try:
        # URL fetch + docling in thread pool
        def _fetch_and_convert():
            import httpx
            with httpx.Client(timeout=30) as client:
                resp = client.get(request.url)
                resp.raise_for_status()
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
                tmp.write(resp.content)
                tmp.close()
                try:
                    result = converter_mod.converter.convert(tmp.name)
                    doc = result.document
                    text = doc.export_to_markdown()
                    page_count = len(result.pages) if result.pages else 1
                    return text, page_count
                finally:
                    Path(tmp.name).unlink(missing_ok=True)

        text, page_count = await asyncio.to_thread(_fetch_and_convert)

        duration = time.time() - start_time
        REQUEST_COUNT.labels(status='success').inc()
        REQUEST_DURATION.observe(duration)
        PDF_PAGE_COUNT.observe(page_count)

        return models.ExtractResponse(
            success=True,
            text=text,
            page_count=page_count,
        )

    except Exception as e:
        REQUEST_COUNT.labels(status='failure').inc()
        return models.ExtractResponse(
            success=False,
            text="",
            page_count=0,
            error=str(e),
        )
    finally:
        QUEUE_DEPTH.dec()


@app.get("/")
async def root():
    return {
        "service": "Docling PDF Extraction with OCR",
        "version": "1.2.0",
        "device": config.get_device(),
        "workers": config.WORKERS,
        "features": ["docling_text_extraction", "smart_easyocr_image_ocr", "async_thread_pool", "prometheus_metrics"],
        "endpoints": {
            "health": "GET /health",
            "metrics": "GET /metrics",
            "extract": "POST /extract",
            "extract_url": "POST /extract-url",
        },
    }


if __name__ == "__main__":
    import uvicorn

    print(f"Starting Docling+OCR service on device: {config.get_device()}")
    print(f"Using {config.WORKERS} workers, io_threads={config.IO_THREADS}, cpu_threads={config.CPU_THREADS}")
    uvicorn.run(
        "src.server:app",
        host="0.0.0.0",
        port=int(os.environ.get("DOCLING_PORT", 8001)),
        workers=1,
        loop="uvloop",
        limit_concurrency=10,
        backlog=256,
    )
