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
  const [pdfFile, setPdfFile] = useState(null)
  const pageInputRef = useRef(null)
  const pdfInputRef = useRef(null)
  const landscape = useOrientation()
  const step = landscape ? 2 : 1
  const totalPages = book.pageCount

  const { rightImage, leftImage, rightOcr, leftOcr, needsPdf } = useBookReader(book, pageIndex, pdfFile)

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
      if (showSearch || editingPage || needsPdf) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
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
  }, [goBack, goForward, showSearch, editingPage, needsPdf])

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

  function handlePdfSelect(e) {
    const file = e.target.files?.[0]
    if (file) setPdfFile(file)
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 z-10 border-b"
        style={{ background: 'rgba(21,18,15,0.92)', borderColor: 'var(--ink-line)' }}
      >
        <button
          className="text-sm font-display transition-colors"
          style={{ color: 'var(--paper-dim)' }}
          onClick={onBack}
        >
          ← 図書室
        </button>
        <span className="text-sm truncate max-w-xs font-display" style={{ color: 'var(--paper-dim)' }}>{book.title}</span>
        <div className="flex items-center gap-3">
          <button
            className="text-sm transition-colors"
            style={{ color: 'var(--paper-faint)' }}
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
              className="w-20 text-sm text-center rounded-sm px-2 py-0.5 outline-none focus:ring-1"
              style={{ background: 'var(--ink-soft)', color: 'var(--paper)', borderColor: 'var(--vermillion)' }}
            />
          ) : (
            <button
              className="text-sm transition-colors"
              style={{ color: 'var(--paper-faint)' }}
              onClick={handlePageClick}
              title="Click to jump to page"
            >
              {pageDisplay}
            </button>
          )}
        </div>
      </div>

      {/* Page spread */}
      <div className="flex-1 overflow-hidden relative">
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

        {/* PDF select overlay */}
        {needsPdf && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20"
            style={{ background: 'rgba(21,18,15,0.97)' }}
          >
            <p className="text-sm font-display" style={{ color: 'var(--paper-dim)' }}>{book.title}</p>
            <p className="text-xs text-center px-8" style={{ color: 'var(--paper-faint)' }}>
              Select the PDF file from your Files app to start reading.
            </p>
            <label
              className="px-6 py-3 rounded-sm border-2 text-sm font-display cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ borderColor: 'var(--vermillion)', color: 'var(--vermillion)', letterSpacing: '0.1em' }}
            >
              Select PDF
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfSelect}
              />
            </label>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div
        className="flex justify-between items-center px-8 py-2 border-t"
        style={{ background: 'rgba(21,18,15,0.92)', borderColor: 'var(--ink-line)' }}
      >
        <button
          className="px-4 py-1 rounded-sm disabled:opacity-30 transition-colors"
          style={{ color: 'var(--paper-dim)' }}
          onClick={goForward}
          disabled={pageIndex + step > totalPages - 1}
        >
          ←
        </button>
        <button
          className="px-4 py-1 rounded-sm disabled:opacity-30 transition-colors"
          style={{ color: 'var(--paper-dim)' }}
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
