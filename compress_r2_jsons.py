#!/usr/bin/env python3
"""
Strip unused fields (symbols, bounding boxes on blocks/paragraphs, redundant text)
from all OCR JSONs in the R2 bucket and re-upload as compact JSON.
"""

import json
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent / "ocr_pipeline"))
from ocr_pipeline import get_env, make_r2_client

load_dotenv()


def strip_ocr(raw: dict) -> dict:
    """Keep only the fields the app actually uses."""
    stripped_pages = []
    for page in raw.get("pages") or []:
        if page is None:
            stripped_pages.append(None)
            continue
        stripped_blocks = []
        for block in page.get("blocks") or []:
            stripped_paras = []
            for para in block.get("paragraphs") or []:
                stripped_words = [
                    {"text": w["text"], "bounding_box": w["bounding_box"]}
                    for w in para.get("words") or []
                ]
                stripped_paras.append({
                    "text": para.get("text", ""),
                    "words": stripped_words,
                })
            stripped_blocks.append({"paragraphs": stripped_paras})
        stripped_pages.append({
            "width": page.get("width"),
            "height": page.get("height"),
            "full_text": page.get("full_text", ""),
            "blocks": stripped_blocks,
        })
    return {
        "filename": raw.get("filename"),
        "page_count": raw.get("page_count"),
        "pages": stripped_pages,
    }


def main():
    bucket = get_env("R2_BUCKET_NAME")
    r2 = make_r2_client()

    # List all JSON objects in the bucket
    print("[r2] Listing objects...")
    paginator = r2.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith(".json") and obj["Key"] != "jmdict.json":
                keys.append((obj["Key"], obj["Size"]))

    if not keys:
        print("[done] No JSON files found.")
        return

    print(f"[r2] Found {len(keys)} JSON files.\n")

    total_before = 0
    total_after = 0

    for key, original_size in keys:
        print(f"  {key} ({original_size / 1024 / 1024:.1f} MB) ...", end=" ", flush=True)

        # Download
        obj = r2.get_object(Bucket=bucket, Key=key)
        raw = json.loads(obj["Body"].read())

        # Strip
        stripped = strip_ocr(raw)
        compact = json.dumps(stripped, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        new_size = len(compact)

        # Re-upload only if smaller
        if new_size >= original_size:
            print(f"already compact, skipping")
            continue

        r2.put_object(
            Bucket=bucket,
            Key=key,
            Body=compact,
            ContentType="application/json",
        )

        total_before += original_size
        total_after += new_size
        saving = (1 - new_size / original_size) * 100
        print(f"→ {new_size / 1024 / 1024:.1f} MB  ({saving:.0f}% smaller)")

    if total_before:
        print(f"\n[done] Total: {total_before / 1024 / 1024:.1f} MB → {total_after / 1024 / 1024:.1f} MB  ({(1 - total_after / total_before) * 100:.0f}% reduction)")
    else:
        print("\n[done] Nothing to compress.")


if __name__ == "__main__":
    main()
