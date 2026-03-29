"""
MCA PDF Scrubber - Docling Microservice

High-quality PDF text extraction using docling library with OCR for images.
Optimized for throughput with async thread-pool offloading and smart OCR gating.
"""

import asyncio
from contextlib import asynccontextmanager
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import config
from . import models
from .converter import converter, init_converter, _convert_docling
from .ocr import ocr_reader, init_ocr, _extract_images, _ocr_images_sync


# ─── Global singletons (initialized in lifespan) ──────────────────────────────
_io_executor: Optional[ThreadPoolExecutor] = None
_cpu_executor: Optional[ThreadPoolExecutor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize on startup, clean up on shutdown — one per worker process."""
    global _io_executor, _cpu_executor

    init_converter()
    init_ocr()

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


# ─── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check() -> models.HealthResponse:
    return models.HealthResponse(
        status="healthy",
        device=config.get_device(),
        docling_available=converter is not None,
        ocr_available=ocr_reader is not None,
        workers=config.WORKERS,
    )


@app.post("/extract", response_model=models.ExtractResponse)
async def extract_pdf(file: UploadFile = File(...)) -> models.ExtractResponse:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    if converter is None:
        raise HTTPException(status_code=503, detail="Docling service not available")

    contents = await file.read()

    try:
        # Write temp file in thread pool (non-blocking for event loop)
        tmp_path = await asyncio.to_thread(_write_temp_file, contents)

        # Run docling conversion in CPU thread pool (blocks thread, not event loop)
        # This allows the event loop to accept other requests while docling runs
        text, page_count = await asyncio.to_thread(_convert_docling, tmp_path)

        # Smart OCR: extract images with fitz and only run OCR if images were found
        ocr_text = ""
        if ocr_reader:
            images = await asyncio.to_thread(_extract_images, tmp_path)
            if images:
                ocr_text = await asyncio.to_thread(_ocr_images_sync, tmp_path)

        # Clean up temp file in background
        asyncio.to_thread(lambda p=tmp_path: Path(p).unlink(missing_ok=True))

        return models.ExtractResponse(
            success=True,
            text=text,
            page_count=page_count,
            ocr_text=ocr_text,
        )

    except Exception as e:
        return models.ExtractResponse(
            success=False,
            text="",
            page_count=0,
            error=str(e),
        )


@app.post("/extract-url", response_model=models.ExtractResponse)
async def extract_from_url(request: models.UrlExtractRequest) -> models.ExtractResponse:
    if converter is None:
        raise HTTPException(status_code=503, detail="Docling service not available")

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
                    result = converter.convert(tmp.name)
                    doc = result.document
                    text = doc.export_to_markdown()
                    page_count = len(result.pages) if result.pages else 1
                    return text, page_count
                finally:
                    Path(tmp.name).unlink(missing_ok=True)

        text, page_count = await asyncio.to_thread(_fetch_and_convert)

        return models.ExtractResponse(
            success=True,
            text=text,
            page_count=page_count,
        )

    except Exception as e:
        return models.ExtractResponse(
            success=False,
            text="",
            page_count=0,
            error=str(e),
        )


@app.get("/")
async def root():
    return {
        "service": "Docling PDF Extraction with OCR",
        "version": "1.2.0",
        "device": config.get_device(),
        "workers": config.WORKERS,
        "features": ["docling_text_extraction", "smart_easyocr_image_ocr", "async_thread_pool"],
        "endpoints": {
            "health": "GET /health",
            "extract": "POST /extract",
            "extract_url": "POST /extract-url",
        },
    }


if __name__ == "__main__":
    import uvicorn

    print(f"Starting Docling+OCR service on device: {config.get_device()}")
    print(f"Using {config.WORKERS} workers, io_threads={config.IO_THREADS}, cpu_threads={config.CPU_THREADS}")
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=int(os.environ.get("DOCLING_PORT", 8003)),
        workers=config.WORKERS,
        loop="uvloop",
        limit_concurrency=10,
        backlog=256,
    )
