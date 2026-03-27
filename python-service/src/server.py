"""
MCA PDF Scrubber - Docling Microservice

High-quality PDF text extraction using docling library with OCR for images.
This service receives PDF files from Laravel and returns extracted text.
"""

import io
import tempfile
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF for image extraction
import torch
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="Docling PDF Extraction Service",
    description="High-quality PDF text extraction using docling + EasyOCR for images",
    version="1.1.0",
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
    ocr_text: str = ""
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    device: str
    docling_available: bool
    ocr_available: bool


print("Initializing Docling DocumentConverter...")
try:
    converter = DocumentConverter()
    print("Docling converter initialized successfully")
except Exception as e:
    print(f"Warning: Docling initialization failed: {e}")
    converter = None

print("Initializing EasyOCR Reader...")
try:
    import easyocr
    ocr_reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available())
    print("EasyOCR initialized successfully")
except Exception as e:
    print(f"Warning: EasyOCR initialization failed: {e}")
    ocr_reader = None


def get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def extract_images_from_pdf(pdf_path: str) -> list:
    """Extract images from PDF and return list of (image_bytes, page_num) tuples."""
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


def ocr_images(images: list) -> str:
    """Run OCR on extracted images and return combined text."""
    if not ocr_reader:
        return ""

    ocr_texts = []
    for img_bytes, page_num in images:
        try:
            # Run OCR on image bytes
            results = ocr_reader.readtext(img_bytes)
            page_text = " ".join([text for _, text, _ in results])
            if page_text.strip():
                ocr_texts.append(f"[OCR Page {page_num + 1}]\n{page_text}")
        except Exception as e:
            print(f"OCR error on page {page_num}: {e}")

    return "\n\n".join(ocr_texts)


@app.get("/health")
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        device=get_device(),
        docling_available=converter is not None,
        ocr_available=ocr_reader is not None,
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

        # Extract text using docling
        result = converter.convert(tmp_path)
        doc = result.document
        text = doc.export_to_markdown()
        page_count = len(result.pages) if result.pages else 1

        # Extract and OCR images from PDF
        ocr_text = ""
        if ocr_reader:
            images = extract_images_from_pdf(tmp_path)
            if images:
                print(f"Found {len(images)} images in PDF, running OCR...")
                ocr_text = ocr_images(images)

        Path(tmp_path).unlink()

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
        "service": "Docling PDF Extraction with OCR",
        "version": "1.1.0",
        "device": get_device(),
        "features": ["docling_text_extraction", "easyocr_image_ocr"],
        "endpoints": {
            "health": "GET /health",
            "extract": "POST /extract",
            "extract_url": "POST /extract-url",
        },
    }


if __name__ == "__main__":
    import uvicorn

    print(f"Starting Docling+OCR service on device: {get_device()}")
    uvicorn.run(app, host="0.0.0.0", port=8001)
