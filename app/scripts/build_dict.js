#!/usr/bin/env node
/**
 * build_dict.js — Pre-process jmdict-simplified JSON into a compact lookup index.
 *
 * Usage:
 *   node scripts/build_dict.js path/to/jmdict-eng-*.json
 *
 * Output:
 *   public/dict/jmdict.json (uploaded as a versioned R2 object)
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: node scripts/build_dict.js path/to/jmdict-eng-*.json')
  process.exit(1)
}

const outputPath = path.resolve('public/dict/jmdict.json')

console.log(`Reading ${inputPath}...`)
const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const words = raw.words ?? []
console.log(`Processing ${words.length} entries...`)

const index = {
  __meta__: {
    version: 4,
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex'),
  },
  terms: {},
  entries: {},
}

function addEntry(key, record) {
  if (!key) return
  index.entries[record.id] = record
  if (!index.terms[key]) index.terms[key] = []
  if (!index.terms[key].includes(record.id)) index.terms[key].push(record.id)
}

for (const entry of words) {
  const headword = entry.kanji?.[0]?.text ?? entry.kana?.[0]?.text ?? ''
  const readings = [...new Set((entry.kana ?? []).map((item) => item.text).filter(Boolean))]
  const pos = [...new Set((entry.sense ?? []).flatMap((sense) => sense.partOfSpeech ?? []))]
  const meanings = entry.sense
    ?.flatMap((sense) => sense.gloss
      ?.filter((gloss) => !gloss.lang || gloss.lang === 'eng')
      .map((gloss) => gloss.text) ?? [])
    .filter(Boolean)
    .slice(0, 6) ?? []
  // Sense IDs are stable across the upload pipeline and reader. The reranker
  // must never address senses by their temporary position in a result list.
  const senses = (entry.sense ?? []).map((sense, index) => ({
    id: `${entry.id}:${index + 1}`,
    number: index + 1,
    pos: sense.partOfSpeech ?? [],
    glosses: (sense.gloss ?? [])
      .filter((gloss) => !gloss.lang || gloss.lang === 'eng')
      .map((gloss) => gloss.text)
      .filter(Boolean),
    appliesToKanji: sense.appliesToKanji ?? ['*'],
    appliesToKana: sense.appliesToKana ?? ['*'],
    misc: sense.misc ?? [],
    field: sense.field ?? [],
    dialect: sense.dialect ?? [],
    info: sense.info ?? [],
  })).filter((sense) => sense.glosses.length)
  const common =
    (entry.kanji ?? []).some((k) => k.common) ||
    (entry.kana ?? []).some((k) => k.common)
  const rare = (entry.sense ?? []).some((sense) =>
    (sense.misc ?? []).some((marker) => ['rare', 'arch', 'obs'].includes(marker))
  )

  // Preserve the fields the CLI uses to rank homographs. Short property names
  // would save a little space, but named fields make the generated format easy
  // to inspect and backwards-compatible with the reader's existing records.
  const record = {
    id: String(entry.id),
    headword,
    readings,
    reading: readings[0] ?? '',
    pos,
    meanings,
    senses,
  }
  if (common) record.common = true
  if (rare) record.rare = true

  // Index under all kanji headwords
  for (const k of entry.kanji ?? []) {
    addEntry(k.text, record)
  }

  // Index under all kana readings (hiragana and katakana are both present as-is)
  for (const k of entry.kana ?? []) {
    addEntry(k.text, record)
  }
}

console.log(`Writing ${outputPath}...`)
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(index), 'utf8')

const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)
console.log(`Done! ${Object.keys(index.terms).length} keys, ${sizeMB} MB`)
