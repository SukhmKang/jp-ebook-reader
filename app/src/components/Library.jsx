import { useRef, useState } from 'react'
import { useBookList } from '../hooks/useBook'
import { saveBook, savePdf, saveOcr, deleteBook, getPdf, getPage } from '../db'
import { loadPdfDoc, renderPdfPage } from '../utils/pdfToImages'
import { fetchOcrJson } from '../utils/r2'

export default function Library({ onOpenBook }) {
  const { books, loading, reload } = useBookList()
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [covers, setCovers] = useState({})
  const fileInputRef = useRef(null)

  // Load cover image on demand
  async function getCover(book) {
    if (covers[book.id]) return
    if (book.storedAs === 'pdf') {
      const blob = await getPdf(book.id)
      if (!blob) return
      const doc = await loadPdfDoc(blob)
      const img = await renderPdfPage(doc, 0)
      setCovers((c) => ({ ...c, [book.id]: img }))
    } else {
      const img = await getPage(book.id, 0)
      if (img) setCovers((c) => ({ ...c, [book.id]: img }))
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setImporting(true)
    setProgress(0)

    try {
      const filename = file.name.replace(/\.pdf$/i, '')

      // Fetch OCR JSON from R2 and get page count from PDF in parallel
      const [ocrJson, pdfDoc] = await Promise.all([
        fetchOcrJson(filename),
        loadPdfDoc(file).then((doc) => { setProgress(0.5); return doc }),
      ])

      const pageCount = pdfDoc.numPages

      // Save PDF blob and OCR to IndexedDB (no pre-rendering)
      await savePdf(filename, file)
      await saveBook({ id: filename, title: filename.replace(/_/g, ' '), pageCount, storedAs: 'pdf', importedAt: Date.now() })
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
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Library</h1>
        <button
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          {importing ? 'Importing...' : '+ Import Book'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {importing && (
        <div className="mb-4">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-zinc-400 text-sm mt-1">{Math.round(progress * 100)}%</p>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : books.length === 0 ? (
        <p className="text-zinc-500">No books yet. Import a PDF to get started.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {books.map((book) => {
            getCover(book)
            return (
              <div
                key={book.id}
                className="relative group cursor-pointer"
                onClick={() => onOpenBook(book)}
                onContextMenu={(e) => { e.preventDefault(); handleDelete(book) }}
              >
                <div className="aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden">
                  {covers[book.id] ? (
                    <img src={covers[book.id]} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs p-2 text-center">
                      {book.title}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-400 truncate">{book.title}</p>
                <button
                  className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 text-xs hidden group-hover:flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); handleDelete(book) }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
