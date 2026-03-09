#!/usr/bin/env python3
"""
bulk_ocr_upload.py - Run the OCR pipeline on every PDF in ./pdfs/
Skips books already uploaded to R2 (handled by ocr_pipeline internally).

Usage:
    python bulk_ocr_upload.py [--dpi 150] [--force]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "ocr_pipeline"))
from ocr_pipeline import run_pipeline

PDFS_DIR = Path("pdfs")


def main():
    parser = argparse.ArgumentParser(description="Bulk OCR + R2 upload for all PDFs in ./pdfs/")
    parser.add_argument("--dpi", type=int, default=150)
    parser.add_argument("--output-dir", type=Path, default=Path("ocr_pipeline/cache"))
    parser.add_argument("--force", action="store_true", help="Re-process even if already in R2")
    args = parser.parse_args()

    pdfs = sorted(PDFS_DIR.glob("*.pdf"))
    if not pdfs:
        print("No PDFs found in ./pdfs/")
        return

    print(f"Found {len(pdfs)} PDF(s)\n")

    for i, pdf in enumerate(pdfs, 1):
        print(f"[{i}/{len(pdfs)}] {pdf.name}")
        try:
            run_pipeline(pdf_path=pdf, dpi=args.dpi, output_dir=args.output_dir, force=args.force)
        except SystemExit:
            print(f"  [error] Pipeline exited early for {pdf.name}, continuing...\n")
        print()


if __name__ == "__main__":
    main()
