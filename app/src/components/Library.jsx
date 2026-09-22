import { useRef, useState } from 'react'
import { useBookList } from '../hooks/useBook'
import { saveBook, saveOcr, deleteBook, getPage } from '../db'
import { fetchOcrJson } from '../utils/r2'


export default function Library({ onOpenBook }) {
  const { books, loading, reload } = useBookList()
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [covers, setCovers] = useState({})
  const fileInputRef = useRef(null)

  // Cover is stored as a single page thumbnail during import
  async function getCover(book) {
    if (covers[book.id]) return
    const img = await getPage(book.id, 0)
    if (img) setCovers((c) => ({ ...c, [book.id]: img }))
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setImporting(true)
    setProgress(0)

    try {
      const filename = file.name.replace(/\.pdf$/i, '')

      // Fetch OCR JSON from R2 — no PDF loading during import
      const ocrJson = await fetchOcrJson(filename)
      setProgress(0.7)

      // Save book metadata and OCR only (cover is cached after first read)
      await saveBook({
        id: filename,
        title: filename.replace(/_/g, ' '),
        pageCount: ocrJson.pages.length,
        storedAs: 'pdf',
        importedAt: Date.now(),
        senseReranker: ocrJson.senseReranker,
      })
      await saveOcr(filename, ocrJson.pages)
      setProgress(1)

      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
      setProgress(0)
      e.target.value = ''
    }
  }

  async function handleDelete(book) {
    if (!confirm(`Delete "${book.title}"?`)) return
    await deleteBook(book.id)
    await reload()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      <header className="border-b" style={{ borderColor: 'var(--ink-line)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-xl" style={{ color: 'var(--paper)' }}>
              図書室
            </h1>
            <span className="text-xs" style={{ color: 'var(--paper-faint)' }}>
              Library
            </span>
          </div>

          <button
            className="shrink-0 rounded border px-4 py-2 text-sm transition-colors disabled:opacity-50"
            style={{
              background: 'var(--ink-soft)',
              borderColor: 'var(--ink-line)',
              color: 'var(--paper)',
            }}
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? '読込中…' : '＋ 本を追加'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        {importing && (
          <div className="mb-6 max-w-md">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--ink-line)' }}>
              <div
                className="h-full transition-all duration-200"
                style={{ width: `${Math.round(progress * 100)}%`, background: 'var(--vermillion)' }}
              />
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--paper-dim)' }}>
              {Math.round(progress * 100)}%
            </p>
          </div>
        )}

        {error && (
          <div
            className="mb-6 max-w-md rounded-sm p-3 text-sm border"
            style={{ borderColor: 'var(--vermillion)', color: 'var(--vermillion)', background: 'var(--vermillion-soft)' }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--paper-faint)' }}>読み込み中…</p>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 gap-2">
            <p className="font-display text-2xl" style={{ color: 'var(--paper-dim)' }}>
              本棚は空です
            </p>
            <p className="text-sm" style={{ color: 'var(--paper-faint)' }}>
              No books yet — import a PDF to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {books.map((book) => {
              getCover(book)
              return (
                <div
                  key={book.id}
                  className="group cursor-pointer"
                  onClick={() => onOpenBook(book)}
                  onContextMenu={(e) => { e.preventDefault(); handleDelete(book) }}
                >
                  <div
                    className="relative aspect-[2/3] overflow-hidden rounded border transition-colors"
                    style={{
                      background: 'var(--ink-soft)',
                      borderColor: 'var(--ink-line)',
                      boxShadow: '0 0 0 0 transparent',
                    }}
                  >
                    {covers[book.id] ? (
                      <img src={covers[book.id]} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-xs p-3 text-center font-display"
                        style={{ color: 'var(--paper-faint)' }}
                      >
                        {book.title}
                      </div>
                    )}

                    <button
                      className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded text-sm group-hover:flex"
                      style={{ background: 'var(--ink)', color: 'var(--paper-dim)' }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(book) }}
                    >
                      ×
                    </button>
                  </div>
                  <p
                    className="mt-2 truncate text-sm"
                    style={{ color: 'var(--paper-dim)' }}
                  >
                    {book.title}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
