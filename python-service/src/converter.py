"""
MCA PDF Scrubber - Docling conversion logic
"""

from typing import Optional

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions


# Global singleton (one-time init per worker process)
converter: Optional[DocumentConverter] = None


def init_converter() -> Optional[DocumentConverter]:
    """Initialize the Docling DocumentConverter."""
    global converter

    print("Initializing Docling DocumentConverter...")
    try:
        # Table structure parsing is disabled to reduce memory usage.
        # It can cause OOM crashes with large PDFs on memory-constrained containers.
        # Text extraction quality remains high without table mode.
        converter = DocumentConverter()
        print("Docling converter initialized successfully")
        return converter
    except Exception as e:
        print(f"Warning: Docling initialization failed: {e}")
        converter = None
        return None


def _convert_docling(tmp_path: str) -> tuple[str, int]:
    """
    Run docling conversion in a subprocess-capable thread.
    Returns (markdown_text, page_count).
    """
    global converter
    result = converter.convert(tmp_path)
    doc = result.document
    text = doc.export_to_markdown()
    page_count = len(result.pages) if result.pages else 1

    return text, page_count
