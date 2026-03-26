#!/usr/bin/env python3
"""
MCA PDF Scrubber - Desktop Application Wrapper
Uses PyWebView to create a native desktop window around the web app
"""

import webview
import threading
import time
import sys
import os
import subprocess
from pathlib import Path

BACKEND_PORT = 8000
DOCLING_PORT = 8001
FRONTEND_URL = "http://localhost:5173"
WINDOW_TITLE = "MCA PDF Scrubber"


def start_docling_service():
    docling_path = Path(__file__).parent.parent / "python-service"
    subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "src.server:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(DOCLING_PORT),
        ],
        cwd=docling_path,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"Docling service starting on port {DOCLING_PORT}...")


def start_laravel():
    laravel_path = Path(__file__).parent.parent / "backend"
    subprocess.Popen(
        ["php", "artisan", "serve", "--host=0.0.0.0", f"--port={BACKEND_PORT}"],
        cwd=laravel_path,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"Laravel backend starting on port {BACKEND_PORT}...")


def start_frontend():
    frontend_path = Path(__file__).parent.parent / "frontend"
    subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_path,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("Frontend starting...")


def main():
    print("Starting MCA PDF Scrubber Desktop...")

    docling_thread = threading.Thread(target=start_docling_service, daemon=True)
    docling_thread.start()
    time.sleep(2)

    laravel_thread = threading.Thread(target=start_laravel, daemon=True)
    laravel_thread.start()
    time.sleep(3)

    frontend_thread = threading.Thread(target=start_frontend, daemon=True)
    frontend_thread.start()
    time.sleep(5)

    print(f"Opening {FRONTEND_URL} in desktop window...")

    window = webview.create_window(
        title=WINDOW_TITLE,
        url=FRONTEND_URL,
        width=1200,
        height=800,
        resizable=True,
        fullscreen=False,
    )

    webview.start(debug=True)


if __name__ == "__main__":
    main()
