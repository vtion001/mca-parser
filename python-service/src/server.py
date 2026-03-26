"""
MCA PDF Scrubber - Docling Microservice

High-quality PDF text extraction using docling library.
This service receives PDF files from Laravel and returns extracted text.
"""

import io
import tempfile
from pathlib import Path
from typing import Optional

import torch
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="Docling PDF Extraction Service",
    description="High-quality PDF text extraction using docling",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UrlExtractRequest(BaseModel):
    url: str


class ExtractResponse(BaseModel):
    success: bool
    text: str
    page_count: int
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    device: str
    docling_available: bool


print("Initializing Docling DocumentConverter...")
try:
    converter = DocumentConverter()
    print("Docling converter initialized successfully")
except Exception as e:
    print(f"Warning: Docling initialization failed: {e}")
    converter = None


def get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


@app.get("/health")
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        device=get_device(),
        docling_available=converter is not None,
    )


@app.post("/extract", response_model=ExtractResponse)
async def extract_pdf(file: UploadFile = File(...)) -> ExtractResponse:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    if converter is None:
        raise HTTPException(status_code=503, detail="Docling service not available")

    contents = await file.read()

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        result = converter.convert(tmp_path)
        doc = result.document

        text = doc.export_to_markdown()
        page_count = len(result.pages) if result.pages else 1

        Path(tmp_path).unlink()

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


@app.post("/extract-url", response_model=ExtractResponse)
async def extract_from_url(request: UrlExtractRequest) -> ExtractResponse:
    if converter is None:
        raise HTTPException(status_code=503, detail="Docling service not available")

    try:
        result = converter.convert(request.url)
        doc = result.document

        text = doc.export_to_markdown()
        page_count = len(result.pages) if result.pages else 1

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
        "service": "Docling PDF Extraction",
        "version": "1.0.0",
        "device": get_device(),
        "endpoints": {
            "health": "GET /health",
            "extract": "POST /extract",
            "extract_url": "POST /extract-url",
        },
    }


if __name__ == "__main__":
    import uvicorn

    print(f"Starting Docling service on device: {get_device()}")
    uvicorn.run(app, host="0.0.0.0", port=8001)
