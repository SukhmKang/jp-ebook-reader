const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, '')

function stripOcr(raw) {
  return (raw.pages ?? []).map((page) => {
    if (!page) return { width: 0, height: 0, full_text: '', blocks: [] }
    return {
      width: page.width,
      height: page.height,
      full_text: page.full_text,
      blocks: (page.blocks ?? []).map((block) => ({
        paragraphs: (block.paragraphs ?? []).map((para) => ({
          text: para.text,
          words: (para.words ?? []).map((word) => ({
            text: word.text,
            bounding_box: word.bounding_box,
          })),
        })),
      })),
    }
  })
}

export async function fetchOcrJson(filename) {
  if (!R2_PUBLIC_URL) throw new Error('VITE_R2_PUBLIC_URL is not set')
  const url = `${R2_PUBLIC_URL}/${filename}.json`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`OCR data not found for "${filename}". Run the pipeline first.`)
  const raw = await res.json()
  return { pages: stripOcr(raw) }
}
