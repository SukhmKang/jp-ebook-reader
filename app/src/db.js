import { openDB } from 'idb'

const DB_NAME = 'manga-reader'
const DB_VERSION = 3

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('books', { keyPath: 'id' })
          db.createObjectStore('pages', { keyPath: 'id' })
          db.createObjectStore('ocr', { keyPath: 'id' })
        }
        if (oldVersion < 2) {
          db.createObjectStore('pdfs', { keyPath: 'id' })
        }
        if (oldVersion < 3) {
          db.createObjectStore('dict', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// Books
export async function saveBook(book) {
  const db = await getDB()
  await db.put('books', book)
}

export async function getAllBooks() {
  const db = await getDB()
  return db.getAll('books')
}

export async function deleteBook(bookId) {
  const db = await getDB()
  const tx = db.transaction(['books', 'pages', 'ocr', 'pdfs'], 'readwrite')
  await tx.objectStore('books').delete(bookId)
  await tx.objectStore('ocr').delete(bookId)
  await tx.objectStore('pdfs').delete(bookId)

  // Delete all pages for this book (legacy image storage)
  const pageStore = tx.objectStore('pages')
  let cursor = await pageStore.openCursor()
  while (cursor) {
    if (cursor.value.bookId === bookId) await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

// Pages
export async function savePage(bookId, pageIndex, imageData) {
  const db = await getDB()
  await db.put('pages', { id: `${bookId}:${pageIndex}`, bookId, pageIndex, imageData })
}

export async function getPage(bookId, pageIndex) {
  const db = await getDB()
  const record = await db.get('pages', `${bookId}:${pageIndex}`)
  return record?.imageData ?? null
}

// PDF blob (on-demand rendering)
export async function savePdf(bookId, blob) {
  const db = await getDB()
  await db.put('pdfs', { id: bookId, blob })
}

export async function getPdf(bookId) {
  const db = await getDB()
  const record = await db.get('pdfs', bookId)
  return record?.blob ?? null
}

// Dictionary
export async function saveDict(data) {
  const db = await getDB()
  await db.put('dict', { id: 'jmdict', data })
}

export async function getDict() {
  const db = await getDB()
  const record = await db.get('dict', 'jmdict')
  return record?.data ?? null
}

// OCR
export async function saveOcr(bookId, pages) {
  const db = await getDB()
  await db.put('ocr', { id: bookId, pages })
}

export async function getOcr(bookId) {
  const db = await getDB()
  const record = await db.get('ocr', bookId)
  return record?.pages ?? null
}
