#!/usr/bin/env python3
"""
OCR Pipeline — extract pages from a PDF, run Google Cloud Vision OCR,
and upload results as structured JSON to Cloudflare R2.
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path

import boto3
import httpx
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from pdf2image import convert_from_path
from PIL import Image
from tqdm import tqdm

load_dotenv()

VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_env(key: str) -> str:
    val = os.getenv(key)
    if not val:
        print(f"[error] Missing environment variable: {key}", file=sys.stderr)
        sys.exit(1)
    return val


def vertices_to_bbox(vertices: list[dict]) -> dict:
    """Convert Vision API vertices list to {x, y, w, h}."""
    xs = [v.get("x", 0) for v in vertices]
    ys = [v.get("y", 0) for v in vertices]
    x, y = min(xs), min(ys)
    return {"x": x, "y": y, "w": max(xs) - x, "h": max(ys) - y}


def image_to_base64(image_path: Path) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


# ---------------------------------------------------------------------------
# Vision API
# ---------------------------------------------------------------------------

def ocr_page(image_path: Path, api_key: str) -> dict | None:
    """Send a page image to Cloud Vision and return parsed page data, or None on failure."""
    content = image_to_base64(image_path)
    payload = {
        "requests": [
            {
                "image": {"content": content},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
            }
        ]
    }

    try:
        response = httpx.post(
            VISION_API_URL,
            params={"key": api_key},
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
    except httpx.HTTPError as e:
        print(f"\n[warn] Vision API request failed: {e}", file=sys.stderr)
        return None

    data = response.json()
    annotation = data.get("responses", [{}])[0]

    if "error" in annotation:
        print(f"\n[warn] Vision API error: {annotation['error']}", file=sys.stderr)
        return None

    full_text_annotation = annotation.get("fullTextAnnotation", {})
    full_text = full_text_annotation.get("text", "")

    with Image.open(image_path) as img:
        width, height = img.size

    blocks = []
    for page in full_text_annotation.get("pages", []):
        for block in page.get("blocks", []):
            block_text_parts = []
            paragraphs = []

            for para in block.get("paragraphs", []):
                para_text_parts = []
                words = []

                for word in para.get("words", []):
                    word_text = "".join(
                        sym.get("text", "") for sym in word.get("symbols", [])
                    )
                    word_verts = word.get("boundingBox", {}).get("vertices", [])
                    words.append({
                        "text": word_text,
                        "bounding_box": vertices_to_bbox(word_verts),
                    })
                    para_text_parts.append(word_text)

                para_text = "".join(para_text_parts)
                para_verts = para.get("boundingBox", {}).get("vertices", [])
                paragraphs.append({
                    "text": para_text,
                    "bounding_box": vertices_to_bbox(para_verts),
                    "words": words,
                })
                block_text_parts.append(para_text)

            block_text = "".join(block_text_parts)
            block_verts = block.get("boundingBox", {}).get("vertices", [])
            blocks.append({
                "text": block_text,
                "bounding_box": vertices_to_bbox(block_verts),
                "paragraphs": paragraphs,
            })

    return {
        "width": width,
        "height": height,
        "full_text": full_text,
        "blocks": blocks,
    }


# ---------------------------------------------------------------------------
# R2 / S3
# ---------------------------------------------------------------------------

def make_r2_client():
    account_id = get_env("R2_ACCOUNT_ID")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=get_env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=get_env("R2_SECRET_ACCESS_KEY"),
    )


def r2_object_exists(client, bucket: str, key: str) -> bool:
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def upload_to_r2(client, bucket: str, key: str, data: bytes) -> None:
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType="application/json",
    )


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_pipeline(pdf_path: Path, dpi: int, output_dir: Path, force: bool) -> None:
    if not pdf_path.exists():
        print(f"[error] PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    api_key = get_env("GOOGLE_VISION_API_KEY")
    bucket = get_env("R2_BUCKET_NAME")
    public_base = get_env("R2_PUBLIC_URL").rstrip("/")

    filename = pdf_path.stem
    r2_key = f"{filename}.json"
    local_json_path = output_dir / "ocr" / f"{filename}.json"
    pages_dir = output_dir / "pages" / filename

    r2 = make_r2_client()

    # --- Check if already uploaded ---
    if not force and r2_object_exists(r2, bucket, r2_key):
        print(f"[skip] Already in R2: {public_base}/{r2_key}")
        return

    # --- Load from local cache if available ---
    if not force and local_json_path.exists():
        print(f"[cache] Using local OCR cache: {local_json_path}")
        json_bytes = local_json_path.read_bytes()
    else:
        # --- Extract pages ---
        pages_dir.mkdir(parents=True, exist_ok=True)
        print(f"[pdf] Extracting pages at {dpi} DPI...")
        pdf_pages = convert_from_path(str(pdf_path), dpi=dpi)
        page_count = len(pdf_pages)
        print(f"[pdf] {page_count} pages found.")

        # Save page images
        page_paths: list[Path] = []
        for i, img in enumerate(tqdm(pdf_pages, desc="Saving pages")):
            page_path = pages_dir / f"page_{i:03d}.jpg"
            if not page_path.exists():
                img.save(page_path, "JPEG", quality=90)
            page_paths.append(page_path)

        # --- Run OCR ---
        page_results = []
        for i, page_path in enumerate(tqdm(page_paths, desc="Running OCR")):
            result = ocr_page(page_path, api_key)
            if result is not None:
                result["page_index"] = i
            page_results.append(result)

        # --- Bundle JSON ---
        output = {
            "filename": filename,
            "page_count": page_count,
            "dpi": dpi,
            "pages": page_results,
        }
        json_bytes = json.dumps(output, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

        # Save local cache
        local_json_path.parent.mkdir(parents=True, exist_ok=True)
        local_json_path.write_bytes(json_bytes)
        print(f"[cache] Saved local JSON: {local_json_path}")

    # --- Upload to R2 ---
    print(f"[r2] Uploading {r2_key} ({len(json_bytes) / 1024:.1f} KB)...")
    try:
        upload_to_r2(r2, bucket, r2_key, json_bytes)
        print(f"[done] {public_base}/{r2_key}")
    except Exception as e:
        print(f"[error] R2 upload failed: {e}", file=sys.stderr)
        print(f"[info] Local cache preserved at: {local_json_path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Run OCR on a PDF and upload results to Cloudflare R2."
    )
    parser.add_argument("pdf_path", type=Path, help="Path to input PDF")
    parser.add_argument("--dpi", type=int, default=150, help="DPI for page extraction (default: 150)")
    parser.add_argument("--output-dir", type=Path, default=Path("./cache"), help="Local cache directory (default: ./cache)")
    parser.add_argument("--force", action="store_true", help="Re-process even if already cached/uploaded")
    args = parser.parse_args()

    run_pipeline(
        pdf_path=args.pdf_path,
        dpi=args.dpi,
        output_dir=args.output_dir,
        force=args.force,
    )


if __name__ == "__main__":
    main()
