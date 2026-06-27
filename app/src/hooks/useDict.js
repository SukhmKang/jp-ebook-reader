import { useEffect, useRef, useState } from 'react'
import { getDict as getDbDict, saveDict } from '../db'
import { buildLookupResults } from '../utils/lookup'

// Bump whenever the dict index format/content changes (and re-upload jmdict.json
// to R2 — see ../../upload_dict.py). A mismatch invalidates the IndexedDB cache
// and busts the HTTP/CDN cache so clients pull the new dict.
//   1 — original { reading, pos, meanings }
//   2 — adds `common` flag (build_dict.js)
const DICT_VERSION = 2

let dictSingleton = null
let dictPromise = null

function getDict() {
  if (dictSingleton) return Promise.resolve(dictSingleton)
  if (dictPromise) return dictPromise
  dictPromise = getDbDict().then((cached) => {
    if (cached && cached.version === DICT_VERSION) {
      dictSingleton = cached.data
      return cached.data
    }
    // Missing or stale cache — fetch from R2 (cache-busted) and persist
    const r2Base = import.meta.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, '')
    return fetch(`${r2Base}/jmdict.json?v=${DICT_VERSION}`)
      .then((r) => r.json())
      .then((d) => {
        dictSingleton = d
        saveDict(d, DICT_VERSION) // persist for offline use, don't await
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

    // Slice from charOffset to end of paragraph — the span we scan from.
    const searchText = (paraText ? paraText.slice(charOffset) : text) || text

    // Use kuromoji's analysis of the tapped word as a ranking hint: its part of
    // speech biases entry ordering, and its dictionary form is a deinflection
    // fallback for irregulars.
    let preferredPos = null
    let preferredSpelling = null
    if (tokenizer) {
      const token = tokenizer.tokenize(text)[0]
      if (token) {
        if (token.pos && token.pos !== '*') preferredPos = token.pos
        if (token.basic_form && token.basic_form !== '*') preferredSpelling = token.basic_form
      }
    }

    // Condition-aware deinflection + longest-span match + POS-affinity ranking,
    // ported from the `jp` CLI (see utils/lookup.js, utils/deinflect.js).
    return buildLookupResults(ref.current, searchText, preferredPos, preferredSpelling)
  }

  return { ready, lookup }
}
