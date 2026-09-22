#!/usr/bin/env node

/**
 * Build contextual dictionary-sense candidate lists from an OCR JSON file.
 *
 * This intentionally imports the reader's lookup implementation so upload-time
 * precomputation and tap-time lookup cannot drift apart.
 */

import fs from 'fs'
import path from 'path'
import kuromoji from 'kuromoji'
import { buildLookupResults } from '../src/utils/lookup.js'

const [ocrPath, dictPath, outputPath] = process.argv.slice(2)
if (!ocrPath || !dictPath || !outputPath) {
  console.error('Usage: node build_rerank_requests.js OCR_JSON DICT_JSON OUTPUT_JSON')
  process.exit(1)
}

function buildTokenizer() {
  const dictDir = path.resolve('node_modules/kuromoji/dict')
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: dictDir }).build((error, tokenizer) => {
      if (error) reject(error)
      else resolve(tokenizer)
    })
  })
}

function wordOffset(paragraph, word, cursor) {
  const found = paragraph.indexOf(word, cursor)
  return found >= 0 ? found : cursor
}

function readingForSpan(tokenizer, span) {
  return tokenizer.tokenize(span)
    .map((token) => token.reading && token.reading !== '*' ? token.reading : token.surface_form)
    .join('')
}

function candidateText(entry, sense) {
  const reading = entry.readings?.[0] ?? entry.reading ?? ''
  const head = reading ? `${entry.headword}【${reading}】` : entry.headword
  const tags = [...new Set([
    ...(sense.pos ?? []),
    ...(sense.misc ?? []),
    ...(sense.field ?? []),
    ...(sense.dialect ?? []),
  ])]
  const tagText = tags.length ? ` (${tags.join(', ')})` : ''
  const notes = sense.info?.length ? ` — ${sense.info.join('; ')}` : ''
  return `${head}${tagText} ${sense.glosses.join('; ')}${notes}`
}

const ocr = JSON.parse(fs.readFileSync(ocrPath, 'utf8'))
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'))
const tokenizer = await buildTokenizer()
const occurrences = []

for (let pageIndex = 0; pageIndex < (ocr.pages ?? []).length; pageIndex++) {
  const page = ocr.pages[pageIndex]
  if (!page) continue
  for (let blockIndex = 0; blockIndex < (page.blocks ?? []).length; blockIndex++) {
    const block = page.blocks[blockIndex]
    for (let paragraphIndex = 0; paragraphIndex < (block.paragraphs ?? []).length; paragraphIndex++) {
      const paragraph = block.paragraphs[paragraphIndex]
      let cursor = 0
      for (let wordIndex = 0; wordIndex < (paragraph.words ?? []).length; wordIndex++) {
        const word = paragraph.words[wordIndex]
        const charOffset = wordOffset(paragraph.text, word.text, cursor)
        cursor = charOffset + word.text.length
        const token = tokenizer.tokenize(word.text)[0]
        const results = buildLookupResults(
          dict,
          paragraph.text.slice(charOffset),
          token?.pos && token.pos !== '*' ? token.pos : null,
          token?.basic_form && token.basic_form !== '*' ? token.basic_form : null,
          word.text,
        )
        if (!results.length) continue

        const span = results[0].span
        const candidates = []
        const seen = new Set()
        for (const group of results) {
          for (const entry of group.entries) {
            for (const sense of entry.senses ?? []) {
              if (seen.has(sense.id)) continue
              seen.add(sense.id)
              candidates.push({ id: sense.id, text: candidateText(entry, sense) })
            }
          }
        }
        if (candidates.length < 2) continue
        occurrences.push({
          pageIndex,
          blockIndex,
          paragraphIndex,
          wordIndex,
          charOffset,
          target: span,
          reading: readingForSpan(tokenizer, span),
          context: paragraph.text,
          candidates,
        })
      }
    }
  }
}

fs.writeFileSync(outputPath, JSON.stringify({
  dictionarySha256: dict.__meta__?.sourceSha256 ?? null,
  occurrences,
}))
console.log(`Prepared ${occurrences.length} ambiguous lookup occurrences.`)
