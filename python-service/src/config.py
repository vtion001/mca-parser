"""
MCA PDF Scrubber - Configuration constants
"""

import os

import torch

# Number of uvicorn workers = CPU cores (capped at 4 to avoid memory pressure)
WORKERS = min(os.cpu_count() or 1, 4)
# Thread pool size for blocking I/O (temp file writes, etc.)
IO_THREADS = 4
# Thread pool size for CPU-bound work offloaded from async context
CPU_THREADS = 2  # docling is CPU-bound; limit to avoid thrashing


def get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"
