import { useEffect, useRef, useState } from 'react'
import { getAllBooks, getPage, getOcr, getPdf } from '../db'
import { loadPdfDoc, renderPdfPage } from '../utils/pdfToImages'

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

export function useBookReader(book, pageIndex) {
  const [leftImage, setLeftImage] = useState(null)
  const [rightImage, setRightImage] = useState(null)
  const [ocrPages, setOcrPages] = useState(null)
  const pdfDocRef = useRef(null)
  const [pdfReady, setPdfReady] = useState(false)

  // Load OCR and PDF doc when book changes
  useEffect(() => {
    if (!book) return
    setOcrPages(null)
    setLeftImage(null)
    setRightImage(null)
    setPdfReady(false)
    pdfDocRef.current = null

    getOcr(book.id).then(setOcrPages)

    if (book.storedAs === 'pdf') {
      getPdf(book.id).then((blob) => {
        if (!blob) return
        return loadPdfDoc(blob)
      }).then((doc) => {
        if (!doc) return
        pdfDocRef.current = doc
        setPdfReady(true)
      })
    }
  }, [book?.id])

  // Render pages on demand
  useEffect(() => {
    if (!book) return

    if (book.storedAs === 'pdf') {
      if (!pdfReady || !pdfDocRef.current) return
      const doc = pdfDocRef.current
      renderPdfPage(doc, pageIndex).then(setRightImage)
      if (pageIndex + 1 < book.pageCount) {
        renderPdfPage(doc, pageIndex + 1).then(setLeftImage)
      } else {
        setLeftImage(null)
      }
    } else {
      // Legacy: pre-rendered images stored in IndexedDB
      getPage(book.id, pageIndex).then(setRightImage)
      getPage(book.id, pageIndex + 1).then(setLeftImage)
    }
  }, [book, pageIndex, pdfReady])

  return {
    rightImage,
    leftImage,
    rightOcr: ocrPages?.[pageIndex] ?? null,
    leftOcr: ocrPages?.[pageIndex + 1] ?? null,
  }
}
