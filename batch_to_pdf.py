#!/usr/bin/env python3
"""
batch_to_pdf.py - Bisect spread PNGs and convert each folder in ./jpegs into a PDF saved to ./pdfs.

Each source image is a two-page spread. We split it down the centre into
right half (earlier page in RTL manga) then left half, so page numbering
matches manga reading order.

Usage: python batch_to_pdf.py
"""

from pathlib import Path
from PIL import Image
from tqdm import tqdm

JPEGS_DIR = Path("jpegs")
PDFS_DIR = Path("pdfs")
EXTS = {".jpg", ".jpeg", ".png"}

PDFS_DIR.mkdir(exist_ok=True)

folders = sorted([f for f in JPEGS_DIR.iterdir() if f.is_dir()])

if not folders:
    print("No folders found in jpegs/")
else:
    for folder in folders:
        output_pdf = PDFS_DIR / f"{folder.name}.pdf"
        if output_pdf.exists():
            print(f"[skip] {output_pdf} already exists")
            continue

        spread_files = sorted([f for f in folder.iterdir() if f.suffix.lower() in EXTS])
        if not spread_files:
            print(f"[skip] No images found in {folder}")
            continue

        print(f"\n[{folder.name}] {len(spread_files)} spreads → {len(spread_files) * 2} pages")

        pages = []
        for spread_path in tqdm(spread_files, desc="Bisecting"):
            img = Image.open(spread_path).convert("RGB")
            w, h = img.size
            mid = w // 2
            right_half = img.crop((mid, 0, w, h))
            left_half = img.crop((0, 0, mid, h))
            pages.append(right_half)
            pages.append(left_half)

        first, rest = pages[0], pages[1:]
        first.save(str(output_pdf), save_all=True, append_images=rest)
        print(f"[done] Saved {output_pdf}")
