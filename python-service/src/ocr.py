"""
MCA PDF Scrubber - OCR logic using EasyOCR
"""

from typing import Optional

import fitz  # PyMuPDF for image extraction
import torch


# Global singleton (one-time init per worker process)
ocr_reader = None


def init_ocr() -> Optional:
    """Initialize the EasyOCR Reader."""
    global ocr_reader

    print("Initializing EasyOCR Reader...")
    try:
        import easyocr
        ocr_reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available(), verbose=False)
        print("EasyOCR initialized successfully")
        return ocr_reader
    except Exception as e:
        print(f"Warning: EasyOCR initialization failed: {e}")
        ocr_reader = None
        return None


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
