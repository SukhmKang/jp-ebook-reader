#!/usr/bin/env node
/**
 * build_dict.js — Pre-process jmdict-simplified JSON into a compact lookup index.
 *
 * Usage:
 *   node scripts/build_dict.js path/to/jmdict-eng-*.json
 *
 * Output:
 *   public/dict/jmdict.json
 */

import fs from 'fs'
import path from 'path'

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

const index = {}

function addEntry(key, record) {
  if (!key) return
  if (!index[key]) index[key] = []
  index[key].push(record)
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
  const common =
    (entry.kanji ?? []).some((k) => k.common) ||
    (entry.kana ?? []).some((k) => k.common)
  const rare = (entry.sense ?? []).some((sense) =>
    (sense.misc ?? []).some((marker) => ['rare', 'arch', 'obs'].includes(marker))
  )

  // Preserve the fields the CLI uses to rank homographs. Short property names
  // would save a little space, but named fields make the generated format easy
  // to inspect and backwards-compatible with the reader's existing records.
  const record = { id: String(entry.id), headword, readings, reading: readings[0] ?? '', pos, meanings }
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
console.log(`Done! ${Object.keys(index).length} keys, ${sizeMB} MB`)
