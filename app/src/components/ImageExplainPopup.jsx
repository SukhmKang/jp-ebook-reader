import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { explainImageInJapanese } from '../utils/openai'

export default function ImageExplainPopup({ imageData, onClose }) {
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState(null)
  const [explaining, setExplaining] = useState(true)
  const [userPrompt, setUserPrompt] = useState('')
  const requestIdRef = useRef(0)

  async function explain(prompt = '') {
    const requestId = ++requestIdRef.current
    setExplanation('')
    setError(null)
    setExplaining(true)
    try {
      await explainImageInJapanese(
        imageData,
        (chunk) => {
          if (requestId === requestIdRef.current) setExplanation((value) => value + chunk)
        },
        prompt,
      )
    } catch (requestError) {
      if (requestId === requestIdRef.current) setError(requestError.message)
    } finally {
      if (requestId === requestIdRef.current) setExplaining(false)
    }
  }

  useEffect(() => {
    explain()
    return () => { requestIdRef.current += 1 }
  }, [imageData])

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t-2 px-4 pb-4 shadow-2xl"
        style={{ background: 'var(--ink-soft)', borderColor: 'var(--vermillion)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img src={imageData} alt="Selected manga region" className="h-16 max-w-28 rounded object-contain" />
            <div>
              <p className="font-display text-sm" style={{ color: 'var(--paper)' }}>画像から説明</p>
              <p className="text-xs" style={{ color: 'var(--paper-faint)' }}>Terra is reading the selected region</p>
            </div>
          </div>
          <button className="text-xl" style={{ color: 'var(--paper-faint)' }} onClick={onClose}>×</button>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            value={userPrompt}
            onChange={(event) => setUserPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !explaining) explain(userPrompt)
            }}
            placeholder="追加の質問（任意）"
            className="min-w-0 flex-1 rounded-sm px-3 py-2 text-sm outline-none focus:ring-1"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          />
          <button
            onClick={() => explain(userPrompt)}
            disabled={explaining}
            className="rounded-sm border px-3 text-xs disabled:opacity-50"
            style={{ borderColor: 'var(--vermillion)', color: 'var(--vermillion)' }}
          >
            再説明
          </button>
        </div>

        {explaining && !explanation && <p className="text-sm" style={{ color: 'var(--paper-faint)' }}>画像を読んでいます…</p>}
        {error && <p className="text-sm" style={{ color: 'var(--vermillion)' }}>{error}</p>}
        {explanation && (
          <div className="prose prose-sm prose-invert max-w-none leading-relaxed" style={{ color: 'var(--paper-dim)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
            {explaining && <span className="animate-pulse">▌</span>}
          </div>
        )}
      </div>
    </div>
  )
}
