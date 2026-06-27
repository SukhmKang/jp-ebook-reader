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
      {/* Banner */}
      <header className="relative overflow-hidden border-b" style={{ borderColor: 'var(--ink-line)' }}>
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at 85% -10%, var(--vermillion-soft), transparent 55%), radial-gradient(ellipse at 10% 110%, rgba(201,162,39,0.10), transparent 60%)',
          }}
        />
        <div className="relative flex items-center justify-between gap-6 px-6 sm:px-10 py-8">
          <div className="flex items-baseline gap-5">
            <h1
              className="font-display leading-none"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', color: 'var(--paper)', letterSpacing: '0.08em' }}
            >
              図書室
            </h1>
            <div className="flex flex-col gap-1">
              <span
                className="text-[0.65rem] sm:text-xs uppercase"
                style={{ color: 'var(--paper-dim)', letterSpacing: '0.35em' }}
              >
                Reading Room
              </span>
              <span className="h-px w-16" style={{ background: 'var(--vermillion)' }} />
            </div>
          </div>

          <button
            className="relative shrink-0 font-display text-sm sm:text-base px-5 sm:px-7 py-3 rounded-sm border-2 transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              borderColor: 'var(--vermillion)',
              color: 'var(--vermillion)',
              letterSpacing: '0.15em',
            }}
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? '読込中…' : '+ 蔵書を追加'}
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

      <main className="px-6 sm:px-10 py-8">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6">
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
                    className="relative aspect-[2/3] overflow-hidden rounded-sm border transition-all duration-300 group-hover:-translate-y-1"
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

                    {/* Hover frame accent */}
                    <div
                      className="absolute inset-0 border-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{ borderColor: 'var(--vermillion)' }}
                    />

                    {/* Bottom gradient + title overlay */}
                    <div
                      className="absolute inset-x-0 bottom-0 px-2 pt-6 pb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
                    >
                      <p className="text-xs truncate" style={{ color: 'var(--paper)' }}>{book.title}</p>
                    </div>

                    <button
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full text-xs hidden group-hover:flex items-center justify-center transition-colors"
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--paper)' }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(book) }}
                    >
                      ×
                    </button>
                  </div>
                  <p
                    className="mt-2 text-xs truncate font-display"
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
