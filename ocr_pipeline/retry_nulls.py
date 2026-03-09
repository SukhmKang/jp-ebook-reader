#!/usr/bin/env python3
"""
retry_nulls.py - Find pages with null OCR results in R2 and retry them.

For each JSON in the R2 bucket:
  1. Download and scan for null pages
  2. Re-run OCR on those pages using cached images
  3. Update the local JSON and re-upload to R2

Requires page images to already be cached locally in:
  {output_dir}/pages/{filename}/page_{index:03d}.jpg

Usage:
    python retry_nulls.py
    python retry_nulls.py --output-dir ./cache
"""

import argparse
import json
import os
import sys
from pathlib import Path

import boto3
from dotenv import load_dotenv
from tqdm import tqdm

from ocr_pipeline import get_env, make_r2_client, ocr_page, upload_to_r2

load_dotenv()


def list_r2_keys(client, bucket: str) -> list[str]:
    keys = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith(".json"):
                keys.append(obj["Key"])
    return keys


def download_json(client, bucket: str, key: str) -> dict:
    response = client.get_object(Bucket=bucket, Key=key)
    return json.loads(response["Body"].read().decode("utf-8"))


def retry_book(client, bucket: str, key: str, output_dir: Path, api_key: str) -> None:
    filename = key.removesuffix(".json")
    pages_dir = output_dir / "pages" / filename
    local_json_path = output_dir / "ocr" / f"{filename}.json"

    print(f"\n[{filename}] Downloading from R2...")
    data = download_json(client, bucket, key)

    pages = data.get("pages", [])
    null_indices = [i for i, p in enumerate(pages) if p is None]

    if not null_indices:
        print(f"  No null pages — skipping.")
        return

    print(f"  {len(null_indices)} null page(s): {null_indices}")

    if not pages_dir.exists():
        print(f"  [warn] Page image cache not found at {pages_dir} — cannot retry.", file=sys.stderr)
        return

    retried = 0
    for i in tqdm(null_indices, desc="  Retrying"):
        page_path = pages_dir / f"page_{i:03d}.jpg"
        if not page_path.exists():
            print(f"  [warn] page_{i:03d}.jpg not found, skipping.")
            continue

        result = ocr_page(page_path, api_key)
        if result is not None:
            result["page_index"] = i
            pages[i] = result
            retried += 1
        else:
            print(f"  [warn] page {i} still failed.")

    if retried == 0:
        print(f"  No pages recovered.")
        return

    print(f"  Recovered {retried}/{len(null_indices)} pages. Saving and uploading...")
    data["pages"] = pages
    json_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")

    local_json_path.parent.mkdir(parents=True, exist_ok=True)
    local_json_path.write_bytes(json_bytes)

    upload_to_r2(client, bucket, key, json_bytes)
    public_base = get_env("R2_PUBLIC_URL").rstrip("/")
    print(f"  [done] {public_base}/{key}")


def main():
    parser = argparse.ArgumentParser(description="Retry null OCR pages across all books in R2.")
    parser.add_argument("--output-dir", type=Path, default=Path("./cache"))
    args = parser.parse_args()

    api_key = get_env("GOOGLE_VISION_API_KEY")
    bucket = get_env("R2_BUCKET_NAME")

    r2 = make_r2_client()

    print("Listing R2 bucket...")
    keys = list_r2_keys(r2, bucket)
    print(f"Found {len(keys)} book(s).")

    for key in keys:
        try:
            retry_book(r2, bucket, key, args.output_dir, api_key)
        except Exception as e:
            print(f"  [error] {key}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
