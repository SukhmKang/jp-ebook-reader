import { useState } from 'react'
import Library from './components/Library'
import Reader from './components/Reader'

export default function App() {
  const [activeBook, setActiveBook] = useState(null)

  if (activeBook) {
    return <Reader book={activeBook} onBack={() => setActiveBook(null)} />
  }

  return <Library onOpenBook={setActiveBook} />
}
