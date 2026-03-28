"""
MCA PDF Scrubber - Docling Microservice

High-quality PDF text extraction using docling library with OCR for images.
Optimized for throughput with async thread-pool offloading and smart OCR gating.
"""

import asyncio
from contextlib import asynccontextmanager
import io
import os
import shutil
import tempfile
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF for image extraction
import torch
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ─── Performance configuration ───────────────────────────────────────────────
# Number of uvicorn workers = CPU cores (capped at 4 to avoid memory pressure)
WORKERS = min(os.cpu_count() or 1, 4)
# Thread pool size for blocking I/O (temp file writes, etc.)
IO_THREADS = 4
# Thread pool size for CPU-bound work offloaded from async context
CPU_THREADS = 2  # docling is CPU-bound; limit to avoid thrashing

# ─── Global singletons (one-time init per worker process) ────────────────────
converter: Optional[DocumentConverter] = None
ocr_reader = None
_io_executor: Optional[ThreadPoolExecutor] = None
_cpu_executor: Optional[ThreadPoolExecutor] = None


class UrlExtractRequest(BaseModel):
    url: str


class ExtractResponse(BaseModel):
    success: bool
    text: str
    page_count: int
    ocr_text: str = ""
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    device: str
    docling_available: bool
    ocr_available: bool
    workers: int


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize on startup, clean up on shutdown — one per worker process."""
    global converter, ocr_reader, _io_executor, _cpu_executor

    print("Initializing Docling DocumentConverter (high-quality table mode)...")
    try:
        # Enable table structure parsing for reliable GFM markdown table output.
        # Bank statements contain critical transaction tables — must extract accurately.
        # ~15-25s per statement is acceptable for correctness.
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_table_structure = True
        format_options = {
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
        converter = DocumentConverter(format_options=format_options)
        print("Docling converter initialized successfully (table structure enabled)")
    except Exception as e:
        print(f"Warning: Docling initialization failed: {e}")
        converter = None

    print("Initializing EasyOCR Reader...")
    try:
        import easyocr
        ocr_reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available(), verbose=False)
        print("EasyOCR initialized successfully")
    except Exception as e:
        print(f"Warning: EasyOCR initialization failed: {e}")
        ocr_reader = None

    _io_executor = ThreadPoolExecutor(max_workers=IO_THREADS, thread_name_prefix="io-")
    _cpu_executor = ThreadPoolExecutor(max_workers=CPU_THREADS, thread_name_prefix="cpu-")
    print(f"Thread pools started: io={IO_THREADS}, cpu={CPU_THREADS}")

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


def get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


# ─── CPU-bound workhorse functions (run in thread pool) ────────────────────────

def _convert_docling(tmp_path: str) -> tuple[str, int, bool]:
    """
    Run docling conversion in a subprocess-capable thread.
    Returns (markdown_text, page_count, had_images).
    had_images tells us whether OCR might still be needed.
    """
    global converter
    result = converter.convert(tmp_path)
    doc = result.document
    text = doc.export_to_markdown()
    page_count = len(result.pages) if result.pages else 1

    return text, page_count


def _ocr_images_sync(tmp_path: str) -> str:
    """
    Extract images and run EasyOCR — all CPU-bound.
    Returns combined OCR text. Runs in thread pool so it doesn't block the event loop.
    """
    global ocr_reader
    if not ocr_reader:
        return ""

    images = _extract_images(tmp_path)
    if not images:
        return ""

    ocr_texts = []
    for img_bytes, page_num in images:
        try:
            results = ocr_reader.readtext(img_bytes)
            page_text = " ".join([text for _, text, _ in results])
            if page_text.strip():
                ocr_texts.append(f"[OCR Page {page_num + 1}]\n{page_text}")
        except Exception as e:
            print(f"OCR error on page {page_num}: {e}")

    return "\n\n".join(ocr_texts)


def _extract_images(pdf_path: str) -> list:
    """Extract images from PDF. Must run in thread (uses fitz)."""
    images = []
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images(full=True)
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                images.append((image_bytes, page_num))
        doc.close()
    except Exception as e:
        print(f"Error extracting images from PDF: {e}")
    return images


def _write_temp_file(contents: bytes) -> str:
    """Write bytes to a temp file synchronously. Runs in io thread pool."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(contents)
    tmp.close()
    return tmp.name


# ─── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        device=get_device(),
        docling_available=converter is not None,
        ocr_available=ocr_reader is not None,
        workers=WORKERS,
    )


@app.post("/extract", response_model=ExtractResponse)
async def extract_pdf(file: UploadFile = File(...)) -> ExtractResponse:
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

        return ExtractResponse(
            success=True,
            text=text,
            page_count=page_count,
            ocr_text=ocr_text,
        )

    except Exception as e:
        return ExtractResponse(
            success=False,
            text="",
            page_count=0,
            error=str(e),
        )


@app.post("/extract-url", response_model=ExtractResponse)
async def extract_from_url(request: UrlExtractRequest) -> ExtractResponse:
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

        return ExtractResponse(
            success=True,
            text=text,
            page_count=page_count,
        )

    except Exception as e:
        return ExtractResponse(
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
        "device": get_device(),
        "workers": WORKERS,
        "features": ["docling_text_extraction", "smart_easyocr_image_ocr", "async_thread_pool"],
        "endpoints": {
            "health": "GET /health",
            "extract": "POST /extract",
            "extract_url": "POST /extract-url",
        },
    }


if __name__ == "__main__":
    import uvicorn

    print(f"Starting Docling+OCR service on device: {get_device()}")
    print(f"Using {WORKERS} workers, io_threads={IO_THREADS}, cpu_threads={CPU_THREADS}")
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=int(os.environ.get("DOCLING_PORT", 8003)),
        workers=WORKERS,
        loop="uvloop",
        limit_concurrency=10,
        backlog=256,
    )
