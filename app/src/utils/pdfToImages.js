import * as pdfjsLib from 'pdfjs-dist'

// Resolve worker from installed package so versions always match
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

export async function loadPdfDoc(blob) {
  const buffer = await blob.arrayBuffer()
  return pdfjsLib.getDocument({ data: buffer }).promise
}

export async function renderPdfPage(pdfDoc, pageIndex) {
  const page = await pdfDoc.getPage(pageIndex + 1) // pdfjs is 1-indexed
  const viewport = page.getViewport({ scale: 1.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.85)
}

export async function pdfToImages(file, onProgress) {
  const pdf = await loadPdfDoc(file)
  const images = []

  for (let i = 0; i < pdf.numPages; i++) {
    images.push(await renderPdfPage(pdf, i))
    onProgress((i + 1) / pdf.numPages)
  }

  return images
}
