// SPDX-License-Identifier: GPL-3.0-or-later
//
// Deinflection adapter. The transform rules and the traversal engine are now
// Yomitan's, verbatim (japanese-transforms.js + language-transformer.js +
// language-transforms.js). This module is a thin shim that drives that engine
// and exposes the same three functions lookup.js already consumes, so the
// lookup pipeline is unchanged while the linguistics come straight from Yomitan.

import { LanguageTransformer } from './language-transformer.js'
import { japaneseTransforms } from './japanese-transforms.js'

const transformer = new LanguageTransformer()
transformer.addDescriptor(japaneseTransforms)

/**
 * Maps a JMdict part-of-speech code (e.g. v5r, vs-i, adj-ix) onto the Yomitan
 * condition name the transform graph reasons about (v5, vs, adj-i...). Yomitan's
 * own dictionaries store these condition names directly; JMdict uses finer codes,
 * so we collapse them here. Returns null for classes the graph doesn't gate on.
 */
function jmdictPosToCondition(wordClass) {
  if (wordClass === 'v1' || wordClass.startsWith('v1-')) return 'v1'
  if (wordClass.startsWith('v5')) return 'v5'
  if (wordClass.startsWith('vs')) return 'vs'
  if (wordClass === 'vk') return 'vk'
  if (wordClass === 'vz') return 'vz'
  if (wordClass === 'adj-i' || wordClass === 'adj-ix') return 'adj-i'
  return null
}

/**
 * Every dictionary-form candidate reachable from `text` by undoing inflections.
 * Each candidate carries `conditions`, a Yomitan condition-flag bitset (0 = the
 * uninflected source form, which is unconstrained and matches any entry).
 *
 * @param {string} text
 * @returns {{ term: string, conditions: number }[]}
 */
export function deinflect(text) {
  return transformer
    .transform(text)
    .map(({ text: term, conditions }) => ({ term, conditions }))
}

/**
 * True when a dictionary entry's word classes satisfy a candidate's inflection
 * conditions. Conditions of 0 (the source form) always pass.
 *
 * @param {string[]} wordClasses  JMdict pos codes for the entry
 * @param {number}   conditions   condition-flag bitset from a deinflect candidate
 */
export function entryMatchesConditions(wordClasses, conditions) {
  if (!conditions) return true
  const conditionNames = []
  for (const wordClass of wordClasses ?? []) {
    const name = jmdictPosToCondition(wordClass)
    if (name) conditionNames.push(name)
  }
  const entryFlags = transformer.getConditionFlagsFromConditionTypes(conditionNames)
  return LanguageTransformer.conditionsMatch(conditions, entryFlags)
}

/**
 * The dictionary lookup terms a candidate should be searched under. Handles
 * suru-verbs by also trying the noun stem (勉強する -> 勉強, condition vs).
 *
 * @param {{ term: string, conditions: number }} candidate
 * @returns {[string, number][]}  [term, conditionFlags] pairs
 */
export function dictionaryTermsForCandidate(candidate) {
  const terms = [[candidate.term, candidate.conditions]]
  if (candidate.term.endsWith('する') && candidate.term.length > 2) {
    terms.push([
      candidate.term.slice(0, -2),
      transformer.getConditionFlagsFromConditionType('vs'),
    ])
  }
  return terms
}
