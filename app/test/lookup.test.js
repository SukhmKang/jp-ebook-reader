import test from 'node:test'
import assert from 'node:assert/strict'

import { deinflect, entryMatchesConditions } from '../src/utils/deinflect.js'
import { buildLookupResults } from '../src/utils/lookup.js'

function termsFor(source) {
  return new Set(deinflect(source).map(({ term }) => term))
}

test('matches the CLI for common chained conjugations', () => {
  for (const [source, expected] of [
    ['食べなかった', '食べる'],
    ['言われた', '言う'],
    ['読んでいる', '読む'],
    ['書きませんでした', '書く'],
    ['高くなかった', '高い'],
    ['勉強させられました', '勉強する'],
  ]) {
    assert.ok(termsFor(source).has(expected), `${source} should deinflect to ${expected}`)
  }
})

test('validates deinflections against JMdict word classes', () => {
  const verbCandidate = deinflect('読んだ').find(({ term }) => term === '読む')
  const adjectiveCandidate = deinflect('高くない').find(({ term }) => term === '高い')
  assert.ok(verbCandidate)
  assert.ok(adjectiveCandidate)
  assert.equal(entryMatchesConditions(['v5m', 'vt'], verbCandidate.conditions), true)
  assert.equal(entryMatchesConditions(['n'], verbCandidate.conditions), false)
  assert.equal(entryMatchesConditions(['adj-i'], adjectiveCandidate.conditions), true)
})

test('particle lookup excludes unrelated kana homographs', () => {
  const dict = {
    'に': [
      { id: 'cargo', headword: '荷', readings: ['に'], pos: ['n'], meanings: ['cargo'], common: true },
      { id: 'particle', headword: 'に', readings: ['に'], pos: ['prt'], meanings: ['at; in; to'], common: true },
    ],
  }
  const results = buildLookupResults(dict, 'に言われた', '助詞', 'に', 'に')
  assert.deepEqual(results.map(({ term }) => term), ['に'])
  assert.deepEqual(results[0].entries.map(({ id }) => id), ['particle'])
})

test('uses longest grammar-valid span and prefers the tokenizer lemma', () => {
  const dict = {
    '言う': [
      { id: 'say', headword: '言う', readings: ['いう'], pos: ['v5u', 'vt'], meanings: ['to say'], common: true },
    ],
  }
  const results = buildLookupResults(dict, '言われたこと', '動詞', '言う', '言われた')
  assert.equal(results[0].span, '言われた')
  assert.equal(results[0].entries[0].headword, '言う')
})
