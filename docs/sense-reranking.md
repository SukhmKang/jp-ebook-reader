# Contextual dictionary sense ranking

The OCR pipeline can precompute which JMdict sense best fits every ambiguous
tap location. The reader uses those rankings offline and always leaves all
other senses visible as fallbacks.

## One-time setup

Build the version 4 sense-aware dictionary and upload it:

```sh
cd app
node scripts/build_dict.js ../jmdict-eng-3.6.2.json
cd ..
python upload_dict.py
```

Create an Apple Silicon environment for the optional model stage:

```sh
python3 -m venv venv-reranker
venv-reranker/bin/pip install -r ocr_pipeline/requirements.txt
venv-reranker/bin/pip install -r ocr_pipeline/requirements-reranker.txt
```

`HF_API_KEY` or `HF_TOKEN` must be available in the environment because the
model repository is private. The first run downloads about 1.1 GB; later runs
reuse the Hugging Face cache.

## Process books

The standalone migration command works with existing OCR caches and avoids
rerunning Google Vision. For one book:

```sh
venv-reranker/bin/python rerank_ocr.py \
  ocr_pipeline/cache/ocr/BOOK.json --upload
```

For every cached book:

```sh
venv-reranker/bin/python rerank_ocr.py --upload
```

The OCR commands also accept `--rerank-senses` locally, allowing newly scanned
books to be ranked before their initial upload.

`--rerank-batch-size` defaults to 24. Lower it if macOS reports MPS memory
pressure; increase it cautiously for throughput. Ordinary OCR without
`--rerank-senses` does not import or require PyTorch.

Each ranking is versioned by model revision, formatter version and source
dictionary SHA-256. The reader ignores incompatible rankings and falls back to
the native deterministic dictionary order.

Before changing an OCR file, `rerank_ocr.py` saves its original under
`ocr_pipeline/cache/pre-sense-reranker/`. With `--upload`, it also preserves the
original R2 object under `backups/pre-sense-reranker/` before replacing the live
copy. These backups are never overwritten by subsequent runs.
