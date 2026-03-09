#!/usr/bin/env python3
"""
imgs_to_pdf.py - Bundle JPG/PNG images in a directory into a PDF
Usage: python imgs_to_pdf.py <input_dir> [output.pdf]
"""

import sys
import os
from pathlib import Path
from PIL import Image


def images_to_pdf(input_dir: str, output_path: str = "output.pdf"):
    input_dir = Path(input_dir)

    # Grab all jpg/png files, sorted by filename
    exts = {".jpg", ".jpeg", ".png"}
    images = sorted([f for f in input_dir.iterdir() if f.suffix.lower() in exts])

    if not images:
        print(f"No JPG/PNG files found in {input_dir}")
        sys.exit(1)

    print(f"Found {len(images)} images, bundling into {output_path}...")

    pil_images = []
    for img_path in images:
        img = Image.open(img_path).convert("RGB")
        pil_images.append(img)
        print(f"  + {img_path.name}")

    first, rest = pil_images[0], pil_images[1:]
    first.save(output_path, save_all=True, append_images=rest)
    print(f"\nDone! Saved to: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python imgs_to_pdf.py <input_dir> [output.pdf]")
        sys.exit(1)

    input_dir = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else "output.pdf"

    images_to_pdf(input_dir, output)