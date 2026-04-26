import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useKuromoji } from '../hooks/useKuromoji'
import { useDict } from '../hooks/useDict'
import { explainInJapanese } from '../utils/claude'

export default function DictPopup({ tap, onClose }) {
  const { tokenizer, ready: kReady } = useKuromoji()
  const { lookup, ready: dReady } = useDict()
  const [results, setResults] = useState(null)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [explainError, setExplainError] = useState(null)
  const [userPrompt, setUserPrompt] = useState('')
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!tap || !dReady) return
    setResults(lookup(tokenizer, tap))
    setExplaining(false)
    setExplanation('')
    setExplainError(null)
    setUserPrompt('')
  }, [tap, kReady, dReady])

  async function handleExplain() {
    setExplaining(true)
    setExplanation('')
    setExplainError(null)
    try {
      await explainInJapanese(
        tap.paraText,
        tap.pageText ?? null,
        (chunk) => setExplanation((s) => s + chunk),
        userPrompt,
      )
    } catch (err) {
      setExplainError(err.message)
    }
  }

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
      className="fixed z-50"
      style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 rounded-t-2xl shadow-2xl max-h-64 overflow-y-auto"
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

          {/* Explain section */}
          {!loading && (
            <div className="border-t border-zinc-800 mt-3 pt-3">
              <p className="text-xs text-zinc-500 mb-1 truncate">「{tap.paraText}」</p>
              <input
                type="text"
                placeholder="気になる点（任意）"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.isComposing && !explaining) handleExplain() }}
                className="w-full bg-zinc-800 text-white text-sm rounded px-3 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-indigo-500 placeholder-zinc-600"
              />
              <button
                onClick={handleExplain}
                disabled={explaining}
                className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded w-full"
              >
                {explaining && !explanation ? 'やさしく説明中…' : 'やさしく説明'}
              </button>

              {explainError && (
                <p className="text-red-400 text-xs mt-2">{explainError}</p>
              )}

              {explanation && (
                <div className="text-sm text-zinc-200 mt-3 leading-relaxed prose prose-sm prose-invert prose-p:my-1 prose-li:my-0 max-w-none">
                  <ReactMarkdown>{explanation}</ReactMarkdown>
                  {explaining && <span className="animate-pulse">▌</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
