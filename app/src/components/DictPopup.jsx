import { useEffect, useRef, useState } from 'react'
import { useKuromoji } from '../hooks/useKuromoji'
import { useDict } from '../hooks/useDict'

export default function DictPopup({ tap, onClose }) {
  const { word, x, y } = tap
  const { tokenizer, ready: kReady } = useKuromoji()
  const { lookup, ready: dReady } = useDict()
  const [results, setResults] = useState(null)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!tap || !dReady) return
    setResults(lookup(tokenizer, tap))
  }, [tap, kReady, dReady])

  // Clamp position to viewport
  const [pos, setPos] = useState({ left: x, top: y })
  useEffect(() => {
    if (!popupRef.current) return
    const { offsetWidth: pw, offsetHeight: ph } = popupRef.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    setPos({
      left: Math.min(Math.max(x - pw / 2, 8), vw - pw - 8),
      top: Math.min(Math.max(y + 16, 8), vh - ph - 8),
    })
  }, [x, y, results])

  const loading = !dReady || results === null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={popupRef}
        className="absolute bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-80 max-h-96 overflow-y-auto p-3"
        style={{ left: pos.left, top: pos.top }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-lg font-bold">{word}</span>
          <button className="text-zinc-400 hover:text-white text-xl leading-none" onClick={onClose}>×</button>
        </div>

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
  )
}
