import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  const isComposingRef = useRef(false)
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
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl max-h-64 overflow-y-auto border-t-2"
        style={{ background: 'var(--ink-soft)', borderColor: 'var(--vermillion)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 pt-4 pb-2">
          <span className="text-lg font-display" style={{ color: 'var(--paper)' }}>{tap.text}</span>
          <button className="text-xl leading-none transition-colors" style={{ color: 'var(--paper-faint)' }} onClick={onClose}>×</button>
        </div>

        <div className="px-4 pb-4">
          {loading && <p className="text-sm" style={{ color: 'var(--paper-faint)' }}>Looking up...</p>}

          {!loading && results.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--paper-faint)' }}>No results found.</p>
          )}

          {!loading && results.map(({ term, entries }) =>
            entries.map((entry, i) => (
              <div key={`${term}-${i}`} className="mb-3 border-t pt-2 first:border-0 first:pt-0" style={{ borderColor: 'var(--ink-line)' }}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-base font-display" style={{ color: 'var(--paper)' }}>{term}</span>
                  <span className="text-sm" style={{ color: 'var(--paper-faint)' }}>{entry.reading}</span>
                </div>
                <div className="text-xs mb-1" style={{ color: 'var(--paper-faint)' }}>{entry.pos?.join(', ')}</div>
                <ol className="text-sm list-decimal list-inside space-y-0.5" style={{ color: 'var(--paper-dim)' }}>
                  {entry.meanings?.map((m, mi) => <li key={mi}>{m}</li>)}
                </ol>
              </div>
            ))
          )}

          {/* Explain section */}
          {!loading && (
            <div className="border-t mt-3 pt-3" style={{ borderColor: 'var(--ink-line)' }}>
              <p className="text-xs mb-1 truncate" style={{ color: 'var(--paper-faint)' }}>「{tap.paraText}」</p>
              <input
                type="text"
                placeholder="気になる点（任意）"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onCompositionStart={() => { isComposingRef.current = true }}
                onCompositionEnd={() => { isComposingRef.current = false }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isComposingRef.current && !explaining) handleExplain()
                }}
                className="w-full text-sm rounded-sm px-3 py-1.5 mb-2 outline-none focus:ring-1 placeholder:opacity-60"
                style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--vermillion)' }}
              />
              <button
                onClick={handleExplain}
                disabled={explaining}
                className="text-xs disabled:opacity-50 px-3 py-1.5 rounded-sm w-full font-display border transition-colors"
                style={{ borderColor: 'var(--vermillion)', color: 'var(--vermillion)', letterSpacing: '0.1em' }}
              >
                {explaining && !explanation ? 'やさしく説明中…' : 'やさしく説明'}
              </button>

              {explainError && (
                <p className="text-xs mt-2" style={{ color: 'var(--vermillion)' }}>{explainError}</p>
              )}

              {explanation && (
                <div className="text-sm mt-3 leading-relaxed prose prose-sm prose-invert prose-p:my-1 prose-li:my-0 max-w-none" style={{ color: 'var(--paper-dim)' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
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
