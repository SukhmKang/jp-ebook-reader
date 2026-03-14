import { useEffect, useRef, useState } from 'react'
import { getDict as getDbDict, saveDict } from '../db'

let dictSingleton = null
let dictPromise = null

function getDict() {
  if (dictSingleton) return Promise.resolve(dictSingleton)
  if (dictPromise) return dictPromise
  dictPromise = getDbDict().then((cached) => {
    if (cached) {
      dictSingleton = cached
      return cached
    }
    // Not in IndexedDB — fetch from R2 and persist
    const r2Base = import.meta.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, '')
    return fetch(`${r2Base}/jmdict.json`)
      .then((r) => r.json())
      .then((d) => {
        dictSingleton = d
        saveDict(d) // persist for offline use, don't await
        return d
      })
  })
  return dictPromise
}

export function useDict() {
  const [ready, setReady] = useState(!!dictSingleton)
  const ref = useRef(dictSingleton)

  useEffect(() => {
    if (ref.current) return
    getDict().then((d) => {
      ref.current = d
      setReady(true)
    })
  }, [])

  // lookup({ text, paraText, charOffset }, tokenizer)
  function lookup(tokenizer, { text, paraText, charOffset }) {
    if (!ref.current) return []

    // Slice from charOffset to end of paragraph — this is our search string
    const searchText = paraText ? paraText.slice(charOffset) : text

    // Generate all prefixes of searchText, longest first
    const chars = Array.from(searchText)
    const prefixes = chars.map((_, i) => chars.slice(0, chars.length - i).join(''))

    // Also try kuromoji dictionary form of the tapped word as a fallback
    const extraForms = new Set()
    if (tokenizer) {
      const tokens = tokenizer.tokenize(text)
      const dictForm = tokens[0]?.basic_form
      if (dictForm && dictForm !== '*' && dictForm !== text) {
        extraForms.add(dictForm)
      }
    }

    const results = []
    const seen = new Set()

    for (const prefix of prefixes) {
      if (seen.has(prefix)) continue
      seen.add(prefix)
      const entries = ref.current[prefix]
      if (entries) results.push({ term: prefix, entries })
    }

    for (const form of extraForms) {
      if (seen.has(form)) continue
      const entries = ref.current[form]
      if (entries) results.push({ term: form, entries })
    }

    // Rank by how many characters of the search text (paragraph slice from
    // tap position) the term shares as a common prefix. This handles kanji
    // vs hiragana mismatches from kuromoji dict forms correctly.
    function commonPrefixLen(a, b) {
      let i = 0
      while (i < a.length && i < b.length && a[i] === b[i]) i++
      return i
    }

    results.sort((a, b) =>
      commonPrefixLen(b.term, searchText) - commonPrefixLen(a.term, searchText)
    )

    return results
  }

  return { ready, lookup }
}
