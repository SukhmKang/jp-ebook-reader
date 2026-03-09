import { useCallback, useEffect, useRef, useState } from 'react'
import { useBookReader } from '../hooks/useBook'
import { useOrientation } from '../hooks/useOrientation'
import PageSpread from './PageSpread'
import DictPopup from './DictPopup'
import SearchPanel from './SearchPanel'

function getProgress(bookId) {
  try { return parseInt(localStorage.getItem(`progress:${bookId}`) || '0', 10) } catch { return 0 }
}
function saveProgress(bookId, page) {
  try { localStorage.setItem(`progress:${bookId}`, page) } catch {}
}

export default function Reader({ book, onBack }) {
  const [pageIndex, setPageIndex] = useState(() => getProgress(book.id))
  const [popup, setPopup] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [editingPage, setEditingPage] = useState(false)
  const [pageInput, setPageInput] = useState('')
  const pageInputRef = useRef(null)
  const landscape = useOrientation()
  const step = landscape ? 2 : 1
  const totalPages = book.pageCount

  const { rightImage, leftImage, rightOcr, leftOcr } = useBookReader(book.id, pageIndex)

  const pageDisplay = `${pageIndex + 1}${landscape && pageIndex + 1 < totalPages ? `–${pageIndex + 2}` : ''} / ${totalPages}`

  useEffect(() => { saveProgress(book.id, pageIndex) }, [book.id, pageIndex])

  const goBack = useCallback(() => {
    setPageIndex((p) => Math.max(0, p - step))
    setPopup(null)
  }, [step])

  const goForward = useCallback(() => {
    setPageIndex((p) => Math.min(totalPages - 1, p + step))
    setPopup(null)
  }, [step, totalPages])

  const jumpTo = useCallback((index) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, index))
    setPageIndex(landscape ? clamped - (clamped % 2) : clamped)
    setPopup(null)
  }, [landscape, totalPages])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      if (showSearch || editingPage) return
      if (e.key === 'ArrowLeft') goForward()   // RTL: left = forward
      if (e.key === 'ArrowRight') goBack()      // RTL: right = back
      if (e.key === 'Escape') setPopup(null)
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goBack, goForward, showSearch, editingPage])

  // Snap to even page on landscape switch
  useEffect(() => {
    if (landscape) setPageIndex((p) => p % 2 === 0 ? p : p - 1)
  }, [landscape])

  function handlePageClick() {
    setPageInput(String(pageIndex + 1))
    setEditingPage(true)
    setTimeout(() => pageInputRef.current?.select(), 0)
  }

  function commitPageInput() {
    const n = parseInt(pageInput, 10)
    if (!isNaN(n)) jumpTo(n - 1)
    setEditingPage(false)
  }

  const handleWordTap = useCallback((tap) => {
    setPopup(tap)
  }, [])

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 z-10">
        <button className="text-zinc-300 hover:text-white text-sm" onClick={onBack}>← Library</button>
        <span className="text-zinc-400 text-sm truncate max-w-xs">{book.title}</span>
        <div className="flex items-center gap-3">
          <button
            className="text-zinc-400 hover:text-white text-sm"
            onClick={() => setShowSearch(true)}
            title="Search (⌘F)"
          >
            ⌕
          </button>
          {editingPage ? (
            <input
              ref={pageInputRef}
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => { if (e.key === 'Enter') commitPageInput(); if (e.key === 'Escape') setEditingPage(false) }}
              className="w-20 bg-zinc-800 text-white text-sm text-center rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <button
              className="text-zinc-500 text-sm hover:text-zinc-300"
              onClick={handlePageClick}
              title="Click to jump to page"
            >
              {pageDisplay}
            </button>
          )}
        </div>
      </div>

      {/* Page spread */}
      <div className="flex-1 overflow-hidden">
        <PageSpread
          rightImage={rightImage}
          leftImage={leftImage}
          rightOcr={rightOcr}
          leftOcr={leftOcr}
          onWordTap={handleWordTap}
          onSwipeLeft={goBack}
          onSwipeRight={goForward}
          singlePage={!landscape}
        />
      </div>

      {/* Bottom nav */}
      <div className="flex justify-between items-center px-8 py-2 bg-zinc-900/80">
        <button
          className="text-zinc-300 hover:text-white px-4 py-1 rounded disabled:opacity-30"
          onClick={goForward}
          disabled={pageIndex + step > totalPages - 1}
        >
          ←
        </button>
        <button
          className="text-zinc-300 hover:text-white px-4 py-1 rounded disabled:opacity-30"
          onClick={goBack}
          disabled={pageIndex === 0}
        >
          →
        </button>
      </div>

      {popup && (
        <DictPopup tap={popup} onClose={() => setPopup(null)} />
      )}

      {showSearch && (
        <SearchPanel
          bookId={book.id}
          onJumpTo={jumpTo}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}
