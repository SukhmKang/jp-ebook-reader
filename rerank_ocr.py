#!/usr/bin/env python3
"""Add contextual sense rankings to cached OCR JSON and optionally upload it."""

import argparse
import json
import shutil
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "ocr_pipeline"))

from ocr_pipeline import get_env, make_r2_client, r2_object_exists, upload_to_r2
from sense_reranker import enrich_ocr_json

load_dotenv(ROOT / "ocr_pipeline" / ".env")
load_dotenv(ROOT / ".env")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Precompute dictionary-sense rankings for cached OCR JSON files."
    )
    parser.add_argument("ocr_json", type=Path, nargs="*", help="OCR JSON files; defaults to every cache file")
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--upload", action="store_true", help="Replace each corresponding R2 OCR object")
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=ROOT / "ocr_pipeline" / "cache" / "pre-sense-reranker",
        help="Directory for immutable pre-reranking OCR copies",
    )
    args = parser.parse_args()

    paths = args.ocr_json or sorted((ROOT / "ocr_pipeline" / "cache" / "ocr").glob("*.json"))
    if not paths:
        raise SystemExit("No OCR JSON files found.")

    r2 = make_r2_client() if args.upload else None
    bucket = get_env("R2_BUCKET_NAME") if args.upload else None
    for index, path in enumerate(paths, 1):
        path = path.resolve()
        print(f"\n[{index}/{len(paths)}] {path.name}")
        args.backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = args.backup_dir / path.name
        if not backup_path.exists():
            shutil.copy2(path, backup_path)
            print(f"[backup] Saved {backup_path}")
        count = enrich_ocr_json(
            path,
            app_dir=ROOT / "app",
            dictionary_path=ROOT / "app" / "public" / "dict" / "jmdict.json",
            batch_size=args.batch_size,
        )
        print(f"[sense] Ranked {count} ambiguous lookup occurrences.")
        if r2 is not None:
            filename = json.loads(path.read_text()).get("filename") or path.stem
            backup_key = f"backups/pre-sense-reranker/{filename}.json"
            if not r2_object_exists(r2, bucket, backup_key):
                upload_to_r2(r2, bucket, backup_key, backup_path.read_bytes())
                print(f"[backup] Uploaded {backup_key}")
            upload_to_r2(r2, bucket, f"{filename}.json", path.read_bytes())
            print(f"[r2] Uploaded {filename}.json")


if __name__ == "__main__":
    main()
