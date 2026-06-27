#!/usr/bin/env python3
"""
upload_dict.py - Upload the freshly built JMdict lookup index to R2.

Run after `node app/scripts/build_dict.js <jmdict-eng-*.json>`.

Requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
in the environment / a .env file (same as the OCR pipeline).

Usage:
    python upload_dict.py
"""

import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent / "ocr_pipeline"))
from ocr_pipeline import get_env, make_r2_client, upload_to_r2

# Credentials live alongside the OCR pipeline; fall back to a root .env too.
load_dotenv(Path(__file__).parent / "ocr_pipeline" / ".env")
load_dotenv()

DICT_PATH = Path("app/public/dict/jmdict.json")
R2_KEY = "jmdict.json"


def main() -> None:
    if not DICT_PATH.exists():
        raise SystemExit(
            f"{DICT_PATH} not found. Build it first:\n"
            "  node app/scripts/build_dict.js jmdict-eng-3.6.2.json"
        )

    data = DICT_PATH.read_bytes()
    bucket = get_env("R2_BUCKET_NAME")

    print(f"Uploading {DICT_PATH} ({len(data) / 1024 / 1024:.1f} MB) -> {bucket}/{R2_KEY} ...")
    upload_to_r2(make_r2_client(), bucket, R2_KEY, data)
    print("Done. Note: clients cache the dict in IndexedDB and will keep using")
    print("the old copy until that cache is cleared/invalidated.")


if __name__ == "__main__":
    main()
