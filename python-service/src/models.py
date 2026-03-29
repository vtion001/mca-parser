"""
MCA PDF Scrubber - Pydantic models
"""

from typing import Optional

from pydantic import BaseModel


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
