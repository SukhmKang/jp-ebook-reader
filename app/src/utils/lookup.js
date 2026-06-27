// JavaScript port of jp_cli/lookup.py — drives the deinflection engine against
// the JMdict index to find the longest dictionary-matching span at a position,
// then ranks the matched entries by POS affinity, preferred spelling and
// commonness (the same intelligence the `jp` CLI uses).

import { deinflect, entryMatchesConditions, dictionaryTermsForCandidate } from './deinflect'

function isJapaneseChar(char) {
  const cp = char.codePointAt(0)
  return (
    (cp >= 0x3040 && cp <= 0x309f) || // Hiragana
    (cp >= 0x30a0 && cp <= 0x30ff) || // Katakana
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0xff66 && cp <= 0xff9f) // Half-width Katakana
  )
}

function containsJapanese(text) {
  for (const char of text) if (isJapaneseChar(char)) return true
  return false
}

function isLookupBoundary(char) {
  if (/\s/.test(char)) return true
  return '。、！？!?「」『』（）()［］[]【】・,;:'.includes(char)
}

/**
 * All prefixes of `text` that start a valid lookup span, longest first.
 * Skips prefixes that contain Japanese punctuation or whitespace before their
 * last character (those would span across a word/sentence boundary).
 */
function japanesePrefixes(text) {
  const chars = Array.from(text)
  const prefixes = []
  for (let length = chars.length; length > 0; length--) {
    const head = chars.slice(0, length)
    const prefix = head.join('')
    if (!containsJapanese(prefix)) continue
    if (head.slice(0, length - 1).some(isLookupBoundary)) continue
    prefixes.push(prefix)
  }
  return prefixes
}

// Maps a kuromoji POS (pos1) to the set of JMdict word classes it prefers, so a
// noun tap ranks noun senses above a coincidental verb homograph, etc.
const POS_AFFINITY = {
  名詞: new Set(['n', 'n-adv', 'n-pr', 'n-pref', 'n-suf', 'vs']),
  動詞: new Set(['v1', 'v5', 'vk', 'vs', 'vz']),
  形容詞: new Set(['adj-i', 'adj-ix']),
  副詞: new Set(['adv', 'adv-to']),
  連体詞: new Set(['adj-pn']),
}

function posAffinity(tokenizerPos, wordClasses) {
  const preferred = POS_AFFINITY[tokenizerPos]
  if (!preferred) return 0
  for (const wordClass of wordClasses ?? []) {
    const normalized = wordClass.startsWith('v5')
      ? 'v5'
      : wordClass.startsWith('vs')
        ? 'vs'
        : wordClass
    if (preferred.has(normalized)) return 1
  }
  return 0
}

const FUNCTIONAL_CLASSES = new Set(['prt', 'aux', 'aux-v', 'aux-adj', 'cop', 'conj'])

// Drop entries that are purely grammatical (particles, copula, auxiliaries) so a
// content-word span doesn't surface them as the headline result.
function isUsefulLookupEntry(record) {
  const classes = record.pos ?? []
  if (classes.length === 0) return true
  return !classes.every((c) => FUNCTIONAL_CLASSES.has(c))
}

// Lexicographic, descending. Higher = better match.
function rankTuple(term, record, preferredPos, preferredSpelling) {
  return [
    term === preferredSpelling ? 1 : 0,
    posAffinity(preferredPos, record.pos),
    record.common ? 1 : 0,
  ]
}

function compareRank(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i] - a[i]
  }
  return 0
}

/**
 * Deinflect a single span and collect dictionary matches, grouped by the
 * dictionary headword they matched under. Returns [{ term, entries }, ...]
 * ordered best-first, or [] if nothing in the index matches.
 */
function matchSpan(dict, span, preferredPos, preferredSpelling, seenRecords) {
  const groups = new Map() // term -> { entries: [{ record, rank }] }

  for (const candidate of deinflect(span)) {
    for (const [term, conditions] of dictionaryTermsForCandidate(candidate)) {
      const records = dict[term]
      if (!records) continue
      for (const record of records) {
        if (seenRecords.has(record)) continue
        if (!entryMatchesConditions(record.pos, conditions)) continue
        if (!isUsefulLookupEntry(record)) continue
        seenRecords.add(record)
        if (!groups.has(term)) groups.set(term, [])
        groups.get(term).push({
          record,
          rank: rankTuple(term, record, preferredPos, preferredSpelling),
        })
      }
    }
  }

  const result = []
  for (const [term, entries] of groups) {
    entries.sort((a, b) => compareRank(a.rank, b.rank))
    result.push({
      term,
      entries: entries.slice(0, 5).map((e) => e.record),
      _rank: entries[0].rank,
    })
  }
  result.sort((a, b) => compareRank(a._rank, b._rank))
  return result.map(({ term, entries }) => ({ term, entries }))
}

/**
 * Find the dictionary results for the word at the tap position.
 *
 * @param dict               JMdict index: { headword: [{ reading, pos, meanings, common? }] }
 * @param searchText         text from the tap position to end of paragraph
 * @param preferredPos       kuromoji pos1 of the tapped token (e.g. 名詞/動詞), optional
 * @param preferredSpelling  kuromoji basic_form of the tapped token, optional
 * @returns [{ term, entries, span }] for the longest matching span, best-first.
 *          `span` is the actual surface text that was matched (e.g. 答えた),
 *          which may extend past the tapped OCR fragment.
 */
export function buildLookupResults(dict, searchText, preferredPos = null, preferredSpelling = null) {
  for (const prefix of japanesePrefixes(searchText)) {
    const groups = matchSpan(dict, prefix, preferredPos, preferredSpelling, new Set())
    if (groups.length) return groups.map((g) => ({ ...g, span: prefix }))
  }

  // Fallback: the tokenizer's dictionary form, in case deinflection missed an
  // irregular that kuromoji resolved directly.
  if (preferredSpelling && preferredSpelling !== searchText) {
    const groups = matchSpan(dict, preferredSpelling, preferredPos, preferredSpelling, new Set())
    if (groups.length) return groups.map((g) => ({ ...g, span: preferredSpelling }))
  }

  return []
}
