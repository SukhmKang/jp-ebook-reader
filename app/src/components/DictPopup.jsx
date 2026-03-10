import { useEffect, useRef, useState } from 'react'
import { useKuromoji } from '../hooks/useKuromoji'
import { useDict } from '../hooks/useDict'

export default function DictPopup({ tap, onClose }) {
  const { tokenizer, ready: kReady } = useKuromoji()
  const { lookup, ready: dReady } = useDict()
  const [results, setResults] = useState(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!tap || !dReady) return
    setResults(lookup(tokenizer, tap))
  }, [tap, kReady, dReady])

  // Pin overlay to visual viewport so it stays visible when zoomed in on iOS
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      if (!overlayRef.current) return
      overlayRef.current.style.top = `${vv.offsetTop}px`
      overlayRef.current.style.left = `${vv.offsetLeft}px`
      overlayRef.current.style.width = `${vv.width}px`
      overlayRef.current.style.height = `${vv.height}px`
    }

    update()
    vv.addEventListener('scroll', update)
    vv.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('scroll', update)
      vv.removeEventListener('resize', update)
    }
  }, [])

  const loading = !dReady || results === null

  return (
    <div
      ref={overlayRef}
      className="fixed z-50 flex flex-col justify-end"
      style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border-t border-zinc-700 rounded-t-2xl shadow-2xl max-h-64 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 pt-4 pb-2">
          <span className="text-lg font-bold">{tap.text}</span>
          <button className="text-zinc-400 hover:text-white text-xl leading-none" onClick={onClose}>×</button>
        </div>

        <div className="px-4 pb-4">
          {loading && <p className="text-zinc-400 text-sm">Looking up...</p>}

          {!loading && results.length === 0 && (
            <p className="text-zinc-400 text-sm">No results found.</p>
          )}

          {!loading && results.map(({ term, entries }) =>
            entries.map((entry, i) => (
              <div key={`${term}-${i}`} className="mb-3 border-t border-zinc-800 pt-2 first:border-0 first:pt-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-base font-semibold">{term}</span>
                  <span className="text-sm text-zinc-400">{entry.reading}</span>
                </div>
                <div className="text-xs text-zinc-500 mb-1">{entry.pos?.join(', ')}</div>
                <ol className="text-sm text-zinc-200 list-decimal list-inside space-y-0.5">
                  {entry.meanings?.map((m, mi) => <li key={mi}>{m}</li>)}
                </ol>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
