"""Precompute contextual JMdict sense rankings for reader OCR data.

The heavy ML dependencies are imported lazily, so ordinary OCR continues to
work without PyTorch installed. Rankings are attached to their OCR word and
therefore remain available to the reader offline.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import tempfile
from pathlib import Path

# The Xet transfer path has proven unreliable for this private 1.1 GB file on
# macOS. Plain Hub HTTP is resumable and is only used for the first download.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

MODEL_ID = "sukhmkang/japanese-sense-reranker-xlmr-large"
MODEL_REVISION = "76a5ce8020db7b5717b88973db8cefafd13eb1b1"
FORMATTER_VERSION = 1
MAX_LENGTH = 256
CANDIDATE_MAX_LENGTH = 72
_MODEL_CACHE = None


def _crop_context(tokenizer, occurrence: dict, candidate_ids: list[int]) -> list[int]:
    """Create segment A while guaranteeing that the marked target survives."""
    text = occurrence["context"]
    start = occurrence["charOffset"]
    target = occurrence["target"]
    left = text[:start]
    right = text[start + len(target):]
    reading = occurrence.get("reading") or target
    header = f"{target}【{reading}】 ⟂ "

    header_ids = tokenizer.encode(header, add_special_tokens=False)
    left_ids = tokenizer.encode(left, add_special_tokens=False)
    target_ids = tokenizer.encode(f"<t>{target}</t>", add_special_tokens=False)
    right_ids = tokenizer.encode(right, add_special_tokens=False)
    special = tokenizer.num_special_tokens_to_add(pair=True)
    available = max(0, MAX_LENGTH - len(candidate_ids) - special - len(header_ids) - len(target_ids))

    # Share the context budget, then give unused space from either side to the
    # other. Keep the context closest to the target.
    left_take = min(len(left_ids), available // 2)
    right_take = min(len(right_ids), available - left_take)
    left_take = min(len(left_ids), available - right_take)
    return header_ids + left_ids[-left_take:] + target_ids + right_ids[:right_take]


def _encode_pair(tokenizer, occurrence: dict, candidate: dict) -> dict:
    candidate_ids = tokenizer.encode(candidate["text"], add_special_tokens=False)[:CANDIDATE_MAX_LENGTH]
    context_ids = _crop_context(tokenizer, occurrence, candidate_ids)
    # XLM-R sentence pairs use: <s> A </s></s> B </s>. Construct this
    # directly because Transformers 5 removed prepare_for_model from the slow
    # tokenizer class shipped with this repository.
    input_ids = [tokenizer.bos_token_id, *context_ids, tokenizer.eos_token_id,
                 tokenizer.eos_token_id, *candidate_ids, tokenizer.eos_token_id]
    return {"input_ids": input_ids, "attention_mask": [1] * len(input_ids)}


def _softmax(values: list[float]) -> list[float]:
    peak = max(values)
    exps = [math.exp(value - peak) for value in values]
    total = sum(exps)
    return [value / total for value in exps]


def _load_model():
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE
    try:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
    except ImportError as error:
        raise RuntimeError(
            "Sense reranking requires the optional dependencies in "
            "ocr_pipeline/requirements-reranker.txt"
        ) from error

    token = os.environ.get("HF_API_KEY") or os.environ.get("HF_TOKEN")
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float16 if device == "mps" else torch.float32
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, revision=MODEL_REVISION, token=token)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_ID,
        revision=MODEL_REVISION,
        token=token,
        dtype=dtype,
    ).to(device).eval()
    _MODEL_CACHE = torch, tokenizer, model, device
    return _MODEL_CACHE


def score_occurrences(requests: dict, batch_size: int = 24) -> list[list[dict]]:
    torch, tokenizer, model, device = _load_model()
    from tqdm import tqdm

    occurrences = requests["occurrences"]
    grouped = [[] for _ in occurrences]
    pending = []
    owners = []
    progress = tqdm(
        total=sum(len(occurrence["candidates"]) for occurrence in occurrences),
        desc="Ranking senses",
        unit="pair",
    )

    def flush() -> None:
        if not pending:
            return
        batch = tokenizer.pad(pending, padding=True, return_tensors="pt")
        batch = {key: value.to(device) for key, value in batch.items()}
        with torch.inference_mode():
            values = model(**batch).logits[:, 0].float().cpu().tolist()
        for logit, (occurrence_index, candidate_index) in zip(values, owners):
            grouped[occurrence_index].append((candidate_index, logit))
        progress.update(len(values))
        pending.clear()
        owners.clear()

    for occurrence_index, occurrence in enumerate(occurrences):
        for candidate_index, candidate in enumerate(occurrence["candidates"]):
            pending.append(_encode_pair(tokenizer, occurrence, candidate))
            owners.append((occurrence_index, candidate_index))
            if len(pending) >= batch_size:
                flush()
    flush()
    progress.close()

    rankings = []
    for occurrence, scores in zip(occurrences, grouped):
        probabilities = _softmax([score for _, score in scores])
        ranked = [
            {"id": occurrence["candidates"][candidate_index]["id"], "score": round(probability, 6)}
            for (candidate_index, _), probability in zip(scores, probabilities)
        ]
        ranked.sort(key=lambda item: item["score"], reverse=True)
        rankings.append(ranked)
    return rankings


def enrich_ocr_json(
    ocr_path: Path,
    app_dir: Path,
    dictionary_path: Path,
    batch_size: int = 24,
) -> int:
    ocr_path = ocr_path.resolve()
    app_dir = app_dir.resolve()
    dictionary_path = dictionary_path.resolve()
    if not dictionary_path.exists():
        raise FileNotFoundError(
            f"Sense-aware dictionary not found: {dictionary_path}. Rebuild it with app/scripts/build_dict.js."
        )

    with tempfile.TemporaryDirectory(prefix="sense-reranker-") as temp_dir:
        request_path = Path(temp_dir) / "requests.json"
        subprocess.run(
            [
                "node",
                str(app_dir / "scripts" / "build_rerank_requests.js"),
                str(ocr_path),
                str(dictionary_path),
                str(request_path),
            ],
            cwd=app_dir,
            check=True,
        )
        requests = json.loads(request_path.read_text())

    if not requests["occurrences"]:
        return 0
    if not requests.get("dictionarySha256"):
        raise RuntimeError("Dictionary is missing __meta__.sourceSha256; rebuild dictionary version 4.")

    rankings = score_occurrences(requests, batch_size=batch_size)
    ocr = json.loads(ocr_path.read_text())
    for occurrence, ranking in zip(requests["occurrences"], rankings):
        word = ocr["pages"][occurrence["pageIndex"]]["blocks"][occurrence["blockIndex"]]["paragraphs"][occurrence["paragraphIndex"]]["words"][occurrence["wordIndex"]]
        word["sense_ranking"] = {
            "dictionarySha256": requests["dictionarySha256"],
            "model": MODEL_ID,
            "modelRevision": MODEL_REVISION,
            "formatterVersion": FORMATTER_VERSION,
            "senses": ranking,
        }

    ocr["sense_reranker"] = {
        "dictionarySha256": requests["dictionarySha256"],
        "model": MODEL_ID,
        "modelRevision": MODEL_REVISION,
        "formatterVersion": FORMATTER_VERSION,
        "occurrenceCount": len(rankings),
    }

    ocr_path.write_text(json.dumps(ocr, ensure_ascii=False, separators=(",", ":")))
    return len(rankings)
