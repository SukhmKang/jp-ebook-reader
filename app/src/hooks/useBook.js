import { useEffect, useState } from 'react'
import { getAllBooks, getPage, getOcr } from '../db'

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

export function useBookReader(bookId, pageIndex) {
  const [leftImage, setLeftImage] = useState(null)
  const [rightImage, setRightImage] = useState(null)
  const [ocrPages, setOcrPages] = useState(null)

  useEffect(() => {
    if (!bookId) return
    getOcr(bookId).then(setOcrPages)
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    getPage(bookId, pageIndex).then(setRightImage)
    getPage(bookId, pageIndex + 1).then(setLeftImage)
  }, [bookId, pageIndex])

  return {
    rightImage,
    leftImage,
    rightOcr: ocrPages?.[pageIndex] ?? null,
    leftOcr: ocrPages?.[pageIndex + 1] ?? null,
  }
}
