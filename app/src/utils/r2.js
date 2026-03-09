const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, '')

export async function fetchOcrJson(filename) {
  if (!R2_PUBLIC_URL) throw new Error('VITE_R2_PUBLIC_URL is not set')
  const url = `${R2_PUBLIC_URL}/${filename}.json`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`OCR data not found for "${filename}". Run the pipeline first.`)
  return res.json()
}
