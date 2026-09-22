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

For one book:

```sh
venv-reranker/bin/python ocr_pipeline/ocr_pipeline.py pdfs/BOOK.pdf \
  --output-dir ocr_pipeline/cache --rerank-senses
```

For every PDF:

```sh
venv-reranker/bin/python bulk_ocr_upload.py --rerank-senses
```

`--rerank-batch-size` defaults to 24. Lower it if macOS reports MPS memory
pressure; increase it cautiously for throughput. Ordinary OCR without
`--rerank-senses` does not import or require PyTorch.

Each ranking is versioned by model revision, formatter version and source
dictionary SHA-256. The reader ignores incompatible rankings and falls back to
the native deterministic dictionary order.
