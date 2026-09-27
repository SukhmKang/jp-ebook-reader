"""Hugging Face Inference Endpoint handler for contextual sense ranking.

This file is uploaded to the private model repository as ``handler.py``.
Keep its input formatting in sync with ``sense_reranker.py``.
"""

from __future__ import annotations

import math

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MAX_LENGTH = 256
CANDIDATE_MAX_LENGTH = 72


def _crop_context(tokenizer, occurrence: dict, candidate_ids: list[int]) -> list[int]:
    text = occurrence["context"]
    start = occurrence["charOffset"]
    target = occurrence["target"]
    left = text[:start]
    right = text[start + len(target):]
    reading = occurrence.get("reading") or target
    header_ids = tokenizer.encode(f"{target}【{reading}】 ⟂ ", add_special_tokens=False)
    left_ids = tokenizer.encode(left, add_special_tokens=False)
    target_ids = tokenizer.encode(f"<t>{target}</t>", add_special_tokens=False)
    right_ids = tokenizer.encode(right, add_special_tokens=False)
    special = tokenizer.num_special_tokens_to_add(pair=True)
    available = max(0, MAX_LENGTH - len(candidate_ids) - special - len(header_ids) - len(target_ids))
    left_take = min(len(left_ids), available // 2)
    right_take = min(len(right_ids), available - left_take)
    left_take = min(len(left_ids), available - right_take)
    return header_ids + left_ids[-left_take:] + target_ids + right_ids[:right_take]


def _encode_pair(tokenizer, occurrence: dict, candidate: dict) -> dict:
    candidate_ids = tokenizer.encode(candidate["text"], add_special_tokens=False)[:CANDIDATE_MAX_LENGTH]
    context_ids = _crop_context(tokenizer, occurrence, candidate_ids)
    input_ids = [
        tokenizer.bos_token_id,
        *context_ids,
        tokenizer.eos_token_id,
        tokenizer.eos_token_id,
        *candidate_ids,
        tokenizer.eos_token_id,
    ]
    return {"input_ids": input_ids, "attention_mask": [1] * len(input_ids)}


def _softmax(values: list[float]) -> list[float]:
    peak = max(values)
    exps = [math.exp(value - peak) for value in values]
    total = sum(exps)
    return [value / total for value in exps]


class EndpointHandler:
    def __init__(self, path: str = ""):
        self.tokenizer = AutoTokenizer.from_pretrained(path)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            path,
            torch_dtype=torch.float16,
        ).to("cuda").eval()

    def __call__(self, data: dict) -> dict:
        occurrences = data.get("inputs", data.get("occurrences", []))
        batch_size = int(data.get("batch_size", 64))
        grouped = [[] for _ in occurrences]
        pending = []
        owners = []

        def flush() -> None:
            if not pending:
                return
            batch = self.tokenizer.pad(pending, padding=True, return_tensors="pt")
            batch = {key: value.to("cuda") for key, value in batch.items()}
            with torch.inference_mode():
                logits = self.model(**batch).logits[:, 0].float().cpu().tolist()
            for logit, (occurrence_index, candidate_index) in zip(logits, owners):
                grouped[occurrence_index].append((candidate_index, logit))
            pending.clear()
            owners.clear()

        for occurrence_index, occurrence in enumerate(occurrences):
            for candidate_index, candidate in enumerate(occurrence["candidates"]):
                pending.append(_encode_pair(self.tokenizer, occurrence, candidate))
                owners.append((occurrence_index, candidate_index))
                if len(pending) >= batch_size:
                    flush()
        flush()

        rankings = []
        for occurrence, scores in zip(occurrences, grouped):
            probabilities = _softmax([score for _, score in scores])
            ranked = [
                {
                    "id": occurrence["candidates"][candidate_index]["id"],
                    "score": round(probability, 6),
                }
                for (candidate_index, _), probability in zip(scores, probabilities)
            ]
            ranked.sort(key=lambda item: item["score"], reverse=True)
            rankings.append(ranked)
        return {"rankings": rankings}
