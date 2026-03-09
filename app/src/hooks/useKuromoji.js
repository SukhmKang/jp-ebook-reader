import { useEffect, useRef, useState } from 'react'

// kuromoji is loaded as a global via public/kuromoji.js script tag
let tokenizerSingleton = null
let buildPromise = null

function getTokenizer() {
  if (tokenizerSingleton) return Promise.resolve(tokenizerSingleton)
  if (buildPromise) return buildPromise
  buildPromise = new Promise((resolve, reject) => {
    window.kuromoji.builder({ dicPath: '/kuromoji' }).build((err, tokenizer) => {
      if (err) return reject(err)
      tokenizerSingleton = tokenizer
      resolve(tokenizer)
    })
  })
  return buildPromise
}

export function useKuromoji() {
  const [ready, setReady] = useState(!!tokenizerSingleton)
  const ref = useRef(tokenizerSingleton)

  useEffect(() => {
    if (ref.current) return
    getTokenizer().then((t) => {
      ref.current = t
      setReady(true)
    }).catch((err) => {
      console.error('[kuromoji] failed to build tokenizer:', err)
    })
  }, [])

  return { tokenizer: ref.current, ready }
}
