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
    """Initialize the Docling DocumentConverter with high-quality table mode."""
    global converter

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
