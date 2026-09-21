import { useEffect, useState } from 'react'
import { getAllBooks, getPage, getOcr, saveBook, saveOcr, savePage } from '../db'
import { loadPdfDoc, renderPdfPage } from '../utils/pdfToImages'
import { fetchOcrJson } from '../utils/r2'

// Session-level cache: survives navigation between books, cleared on page reload
const sessionPdfDocs = new Map()

export function useBookList() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    setBooks(await getAllBooks())
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  return { books, loading, reload }
}

export function useBookReader(book, pageIndex, pdfFile) {
  const [leftImage, setLeftImage] = useState(null)
  const [rightImage, setRightImage] = useState(null)
  const [ocrPages, setOcrPages] = useState(null)
  const [pdfPageCount, setPdfPageCount] = useState(null)
  const [pdfReady, setPdfReady] = useState(
    () => !book || book.storedAs !== 'pdf' || sessionPdfDocs.has(book.id)
  )

  // Reset and load OCR when book changes
  useEffect(() => {
    if (!book) return
    setOcrPages(null)
    setPdfPageCount(null)
    setLeftImage(null)
    setRightImage(null)
    getOcr(book.id).then(setOcrPages)

    if (book.storedAs === 'pdf') {
      setPdfReady(sessionPdfDocs.has(book.id))
    } else {
      setPdfReady(true)
    }
  }, [book?.id])

  // Load PDF doc into session cache when user provides a file
  useEffect(() => {
    if (!pdfFile || !book || book.storedAs !== 'pdf') return
    if (sessionPdfDocs.has(book.id)) { setPdfReady(true); return }
    loadPdfDoc(pdfFile).then((doc) => {
      sessionPdfDocs.set(book.id, doc)
      setPdfReady(true)
    })
  }, [pdfFile, book?.id])

  // A regenerated PDF can legitimately gain or lose normalization pages.
  // Reconcile its cached metadata and OCR from the canonical source whenever
  // the selected file's real page count changes, without any per-book rules.
  useEffect(() => {
    if (!book || book.storedAs !== 'pdf' || !pdfReady) return
    const doc = sessionPdfDocs.get(book.id)
    if (!doc) return
    setPdfPageCount(doc.numPages)
    if (doc.numPages === book.pageCount) return

    let cancelled = false
    fetchOcrJson(book.id).then(async ({ pages }) => {
      if (cancelled || pages.length !== doc.numPages) return
      setOcrPages(pages)
      await Promise.all([
        saveOcr(book.id, pages),
        saveBook({ ...book, pageCount: doc.numPages }),
      ])
    }).catch(() => {
      // The PDF remains readable offline; OCR refresh will retry next time.
    })
    return () => { cancelled = true }
  }, [book, pdfReady])

  // Render pages on demand
  useEffect(() => {
    if (!book) return

    if (book.storedAs === 'pdf') {
      if (!pdfReady) return
      const doc = sessionPdfDocs.get(book.id)
      if (!doc) return
      setRightImage(null)
      setLeftImage(null)
      renderPdfPage(doc, pageIndex).then((img) => {
        setRightImage(img)
        // Cache page 0 as cover thumbnail for the library
        if (pageIndex === 0) savePage(book.id, 0, img)
      })
      if (pageIndex + 1 < book.pageCount) {
        renderPdfPage(doc, pageIndex + 1).then(setLeftImage)
      }
    } else {
      // Legacy: pre-rendered images in IndexedDB
      getPage(book.id, pageIndex).then(setRightImage)
      getPage(book.id, pageIndex + 1).then(setLeftImage)
    }
  }, [book?.id, pageIndex, pdfReady])

  return {
    rightImage,
    leftImage,
    rightOcr: ocrPages?.[pageIndex] ?? null,
    leftOcr: ocrPages?.[pageIndex + 1] ?? null,
    ocrPages,
    pageCount: pdfPageCount ?? book?.pageCount ?? 0,
    needsPdf: book?.storedAs === 'pdf' && !pdfReady,
  }
}
