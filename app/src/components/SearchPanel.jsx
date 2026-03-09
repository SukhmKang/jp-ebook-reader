import { useEffect, useRef, useState } from 'react'
import { getOcr } from '../db'

export default function SearchPanel({ bookId, onJumpTo, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef(null)
  const ocrRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    // Load OCR once
    getOcr(bookId).then((pages) => { ocrRef.current = pages })
  }, [bookId])

  function handleSearch(q) {
    setQuery(q)
    if (!q.trim() || !ocrRef.current) {
      setResults([])
      return
    }
    setSearching(true)
    const lower = q.toLowerCase()
    const matches = []
    for (let i = 0; i < ocrRef.current.length; i++) {
      const page = ocrRef.current[i]
      if (!page?.full_text) continue
      const idx = page.full_text.indexOf(q)
      if (idx === -1) continue
      // Grab a snippet around the match
      const start = Math.max(0, idx - 20)
      const end = Math.min(page.full_text.length, idx + q.length + 40)
      const snippet = page.full_text.slice(start, end).replace(/\n/g, ' ')
      matches.push({ pageIndex: i, snippet, matchStart: idx - start })
      if (matches.length >= 50) break
    }
    setResults(matches)
    setSearching(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={onClose}>
      <div
        className="bg-zinc-900 border-b border-zinc-700 p-4 flex gap-3 items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search in book..."
          className="flex-1 bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button className="text-zinc-400 hover:text-white text-xl" onClick={onClose}>×</button>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {searching && <p className="text-zinc-500 text-sm p-4">Searching...</p>}
        {!searching && query && results.length === 0 && (
          <p className="text-zinc-500 text-sm p-4">No results found.</p>
        )}
        {results.map((r, i) => (
          <button
            key={i}
            className="w-full text-left px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800 transition-colors"
            onClick={() => { onJumpTo(r.pageIndex); onClose() }}
          >
            <span className="text-xs text-indigo-400 font-medium block mb-1">Page {r.pageIndex + 1}</span>
            <span className="text-sm text-zinc-300 leading-relaxed">
              {r.snippet.slice(0, r.matchStart)}
              <mark className="bg-indigo-500 text-white rounded px-0.5">
                {r.snippet.slice(r.matchStart, r.matchStart + query.length)}
              </mark>
              {r.snippet.slice(r.matchStart + query.length)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
