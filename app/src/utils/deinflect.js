// SPDX-License-Identifier: GPL-3.0-or-later
// Adapted from Yomitan's language transformer and Japanese transform rules.
// Copyright (C) 2024-2026 Yomitan Authors.
//
// JavaScript port of jp_cli/deinflect.py — a condition-aware transform graph
// that turns an inflected Japanese surface form into its dictionary form(s),
// tracking which word classes (v1/v5/vs/vk/adj-i...) each result is valid for.

function setKey(conditions) {
  if (conditions === null) return 'null'
  return [...conditions].sort().join(',')
}

function rule(inflectedSuffix, dictionarySuffix, conditionsIn, conditionsOut, reason) {
  return {
    inflectedSuffix,
    dictionarySuffix,
    conditionsIn: new Set(conditionsIn),
    conditionsOut: new Set(conditionsOut),
    reason,
  }
}

function godanRules(endings, conditionsIn, reason) {
  return endings.map(([inflected, dictionary]) =>
    rule(inflected, dictionary, conditionsIn, ['v5'], reason)
  )
}

const GODAN_I = [
  ['い', 'う'], ['き', 'く'], ['ぎ', 'ぐ'], ['し', 'す'], ['ち', 'つ'],
  ['に', 'ぬ'], ['び', 'ぶ'], ['み', 'む'], ['り', 'る'],
]
const GODAN_A = [
  ['わ', 'う'], ['か', 'く'], ['が', 'ぐ'], ['さ', 'す'], ['た', 'つ'],
  ['な', 'ぬ'], ['ば', 'ぶ'], ['ま', 'む'], ['ら', 'る'],
]
const GODAN_E = [
  ['え', 'う'], ['け', 'く'], ['げ', 'ぐ'], ['せ', 'す'], ['て', 'つ'],
  ['ね', 'ぬ'], ['べ', 'ぶ'], ['め', 'む'], ['れ', 'る'],
]
const GODAN_O = [
  ['お', 'う'], ['こ', 'く'], ['ご', 'ぐ'], ['そ', 'す'], ['と', 'つ'],
  ['の', 'ぬ'], ['ぼ', 'ぶ'], ['も', 'む'], ['ろ', 'る'],
]
const GODAN_TE = [
  ['って', 'う'], ['って', 'つ'], ['って', 'る'], ['いて', 'く'], ['いで', 'ぐ'],
  ['して', 'す'], ['んで', 'ぬ'], ['んで', 'ぶ'], ['んで', 'む'],
]
const GODAN_TA = [
  ['った', 'う'], ['った', 'つ'], ['った', 'る'], ['いた', 'く'], ['いだ', 'ぐ'],
  ['した', 'す'], ['んだ', 'ぬ'], ['んだ', 'ぶ'], ['んだ', 'む'],
]

const suffix = (endings, tail) => endings.map(([a, b]) => [a + tail, b])

// Condition-aware transform graph. Rules output intermediate conditions so
// transformations can be chained safely (e.g. polite past -> past -> stem).
const RULES = [
  rule('ている', 'て', ['v1'], ['-te'], 'progressive'),
  rule('でいる', 'で', ['v1'], ['-te'], 'progressive'),
  rule('てる', 'て', ['v1'], ['-te'], 'progressive (contracted)'),
  rule('でる', 'で', ['v1'], ['-te'], 'progressive (contracted)'),
  rule('ておく', 'て', ['v5'], ['-te'], 'in advance'),
  rule('でおく', 'で', ['v5'], ['-te'], 'in advance'),
  rule('とく', 'て', ['v5'], ['-te'], 'in advance (contracted)'),
  rule('どく', 'で', ['v5'], ['-te'], 'in advance (contracted)'),
  rule('てしまう', 'て', ['v5'], ['-te'], 'completion/regret'),
  rule('でしまう', 'で', ['v5'], ['-te'], 'completion/regret'),
  rule('ちゃう', 'て', ['v5'], ['-te'], 'completion/regret (contracted)'),
  rule('じゃう', 'で', ['v5'], ['-te'], 'completion/regret (contracted)'),
  rule('なかった', 'ない', ['adj-i'], ['adj-i'], 'past'),
  rule('なくて', 'ない', ['adj-i'], ['adj-i'], 'te-form'),
  rule('なければ', 'ない', ['adj-i'], ['adj-i'], 'conditional'),
  rule('なかった', 'る', ['-ta'], ['v1'], 'negative'),
  rule('ない', 'る', ['adj-i'], ['v1'], 'negative'),
  rule('ない', 'くる', ['adj-i'], ['vk'], 'negative'),
  rule('ない', 'する', ['adj-i'], ['vs'], 'negative'),
  rule('ませんでした', 'る', ['-ta'], ['v1'], 'polite negative past'),
  rule('ませんでした', 'くる', ['-ta'], ['vk'], 'polite negative past'),
  rule('ませんでした', 'する', ['-ta'], ['vs'], 'polite negative past'),
  rule('ません', 'る', ['v1'], ['v1'], 'polite negative'),
  rule('ません', 'くる', ['vk'], ['vk'], 'polite negative'),
  rule('ません', 'する', ['vs'], ['vs'], 'polite negative'),
  rule('ました', 'る', ['-ta'], ['v1'], 'polite past'),
  rule('ました', 'くる', ['-ta'], ['vk'], 'polite past'),
  rule('ました', 'する', ['-ta'], ['vs'], 'polite past'),
  rule('ます', 'る', ['v1'], ['v1'], 'polite'),
  rule('ます', 'くる', ['vk'], ['vk'], 'polite'),
  rule('ます', 'する', ['vs'], ['vs'], 'polite'),
  rule('た', 'る', ['-ta'], ['v1'], 'past'),
  rule('て', 'る', ['-te'], ['v1'], 'te-form'),
  rule('れば', 'る', ['v1'], ['v1'], 'conditional'),
  rule('ろ', 'る', ['v1'], ['v1'], 'imperative'),
  rule('よ', 'る', ['v1'], ['v1'], 'imperative'),
  rule('よう', 'る', [], ['v1'], 'volitional'),
  rule('られる', 'る', ['v1'], ['v1'], 'potential/passive'),
  rule('させる', 'る', ['v1'], ['v1'], 'causative'),
  rule('させられる', 'る', ['v1'], ['v1'], 'causative passive'),
  rule('たい', 'る', ['adj-i'], ['v1'], 'desiderative'),
  rule('すぎる', 'る', ['v1'], ['v1'], 'excessive'),
  rule('かった', 'い', ['-ta'], ['adj-i'], 'past'),
  rule('くて', 'い', ['-te'], ['adj-i'], 'te-form'),
  rule('ければ', 'い', [], ['adj-i'], 'conditional'),
  rule('くない', 'い', ['adj-i'], ['adj-i'], 'negative'),
  rule('すぎる', 'い', ['v1'], ['adj-i'], 'excessive'),
  rule('そう', 'い', [], ['adj-i'], 'appearance'),
  rule('かった', '', ['-ta'], ['adj-i'], 'past'),
  rule('くて', '', ['-te'], ['adj-i'], 'te-form'),
  rule('した', 'する', ['-ta'], ['vs'], 'past'),
  rule('して', 'する', ['-te'], ['vs'], 'te-form'),
  rule('すれば', 'する', [], ['vs'], 'conditional'),
  rule('しろ', 'する', [], ['vs'], 'imperative'),
  rule('せよ', 'する', [], ['vs'], 'imperative'),
  rule('しよう', 'する', [], ['vs'], 'volitional'),
  rule('される', 'する', ['v1'], ['vs'], 'passive'),
  rule('させる', 'する', ['v1'], ['vs'], 'causative'),
  rule('させられる', 'する', ['v1'], ['vs'], 'causative passive'),
  rule('したい', 'する', ['adj-i'], ['vs'], 'desiderative'),
  rule('できる', 'する', ['v1'], ['vs'], 'potential'),
  rule('きた', 'くる', ['-ta'], ['vk'], 'past'),
  rule('きて', 'くる', ['-te'], ['vk'], 'te-form'),
  rule('くれば', 'くる', [], ['vk'], 'conditional'),
  rule('こい', 'くる', [], ['vk'], 'imperative'),
  rule('こよう', 'くる', [], ['vk'], 'volitional'),
  rule('こられる', 'くる', ['v1'], ['vk'], 'potential/passive'),
  rule('こさせる', 'くる', ['v1'], ['vk'], 'causative'),
  rule('きたい', 'くる', ['adj-i'], ['vk'], 'desiderative'),
  rule('行った', '行く', ['-ta'], ['v5'], 'past'),
  rule('行って', '行く', ['-te'], ['v5'], 'te-form'),
  ...godanRules(GODAN_I, ['v5'], 'continuative'),
  ...godanRules(suffix(GODAN_I, 'ます'), ['v5'], 'polite'),
  ...godanRules(suffix(GODAN_I, 'ました'), ['-ta'], 'polite past'),
  ...godanRules(suffix(GODAN_I, 'ません'), ['v5'], 'polite negative'),
  ...godanRules(suffix(GODAN_I, 'ませんでした'), ['-ta'], 'polite negative past'),
  ...godanRules(GODAN_TE, ['-te'], 'te-form'),
  ...godanRules(GODAN_TA, ['-ta'], 'past'),
  ...godanRules(suffix(GODAN_A, 'ない'), ['adj-i'], 'negative'),
  ...godanRules(suffix(GODAN_A, 'なかった'), ['-ta'], 'negative past'),
  ...godanRules(suffix(GODAN_A, 'れる'), ['v1'], 'passive'),
  ...godanRules(suffix(GODAN_A, 'せる'), ['v1'], 'causative'),
  ...godanRules(suffix(GODAN_A, 'せられる'), ['v1'], 'causative passive'),
  ...godanRules(suffix(GODAN_E, 'ば'), [], 'conditional'),
  ...godanRules(suffix(GODAN_E, 'る'), ['v1'], 'potential'),
  ...godanRules(suffix(GODAN_O, 'よう'), [], 'volitional'),
  ...godanRules(suffix(GODAN_I, 'たい'), ['adj-i'], 'desiderative'),
]

function isDisjoint(a, b) {
  for (const item of a) if (b.has(item)) return false
  return true
}

/**
 * Returns every dictionary-form candidate reachable from `text` by undoing
 * inflections, each tagged with the word-class conditions it is valid under.
 * The original surface is always included (conditions=null = unconstrained).
 */
export function deinflect(text, maxDepth = 8) {
  const results = [{ term: text, conditions: null, reasons: [] }]
  const seen = new Set([`${text} null`])

  for (let i = 0; i < results.length; i++) {
    const candidate = results[i]
    if (candidate.reasons.length >= maxDepth) continue
    for (const transform of RULES) {
      if (candidate.conditions !== null && transform.conditionsIn.size) {
        if (isDisjoint(candidate.conditions, transform.conditionsIn)) continue
      }
      if (!candidate.term.endsWith(transform.inflectedSuffix)) continue
      const stem = candidate.term.slice(0, candidate.term.length - transform.inflectedSuffix.length)
      const transformed = stem + transform.dictionarySuffix
      if (!transformed || transformed === candidate.term) continue
      const stateKey = `${transformed} ${setKey(transform.conditionsOut)}`
      if (seen.has(stateKey)) continue
      seen.add(stateKey)
      results.push({
        term: transformed,
        conditions: transform.conditionsOut,
        reasons: [...candidate.reasons, transform.reason],
      })
    }
  }
  return results
}

/**
 * True when a dictionary entry's word classes are compatible with the
 * inflection conditions of a deinflection candidate. Unconstrained (null/empty)
 * conditions always pass.
 */
export function entryMatchesConditions(wordClasses, conditions) {
  if (conditions === null || conditions.size === 0) return true

  const entryConditions = new Set()
  for (const wordClass of wordClasses ?? []) {
    if (wordClass === 'v1' || wordClass.startsWith('v1-')) entryConditions.add('v1')
    else if (wordClass.startsWith('v5')) entryConditions.add('v5')
    else if (wordClass.startsWith('vs')) entryConditions.add('vs')
    else if (wordClass === 'vk') entryConditions.add('vk')
    else if (wordClass === 'vz') entryConditions.add('vz')
    else if (wordClass === 'adj-i' || wordClass === 'adj-ix') entryConditions.add('adj-i')
  }

  return !isDisjoint(conditions, entryConditions)
}

/**
 * The dictionary lookup terms a candidate should be searched under. Handles
 * suru-verbs by also trying the noun stem (勉強する -> 勉強, condition vs).
 */
export function dictionaryTermsForCandidate(candidate) {
  const terms = [[candidate.term, candidate.conditions]]
  if (candidate.term.endsWith('する') && candidate.term.length > 2) {
    terms.push([candidate.term.slice(0, -2), new Set(['vs'])])
  }
  return terms
}
