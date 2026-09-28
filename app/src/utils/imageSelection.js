const MIN_SELECTION_SIZE = 12

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function selectionRect(start, current, imageRect) {
  if (!start || !current || !imageRect) return null

  const minX = imageRect.offsetX
  const minY = imageRect.offsetY
  const maxX = minX + imageRect.width
  const maxY = minY + imageRect.height
  const startX = clamp(start.x, minX, maxX)
  const startY = clamp(start.y, minY, maxY)
  const endX = clamp(current.x, minX, maxX)
  const endY = clamp(current.y, minY, maxY)
  const rect = {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  }

  return rect.width >= MIN_SELECTION_SIZE && rect.height >= MIN_SELECTION_SIZE
    ? rect
    : null
}

export function sourceCropRect(rect, imageRect, naturalWidth, naturalHeight) {
  const scaleX = naturalWidth / imageRect.width
  const scaleY = naturalHeight / imageRect.height
  return {
    x: Math.round((rect.x - imageRect.offsetX) * scaleX),
    y: Math.round((rect.y - imageRect.offsetY) * scaleY),
    width: Math.max(1, Math.round(rect.width * scaleX)),
    height: Math.max(1, Math.round(rect.height * scaleY)),
  }
}

export function imageBounds(pages) {
  if (!pages.length) return null
  const left = Math.min(...pages.map(({ rect }) => rect.offsetX))
  const top = Math.min(...pages.map(({ rect }) => rect.offsetY))
  const right = Math.max(...pages.map(({ rect }) => rect.offsetX + rect.width))
  const bottom = Math.max(...pages.map(({ rect }) => rect.offsetY + rect.height))
  return { offsetX: left, offsetY: top, width: right - left, height: bottom - top }
}

export function pageCropLayers(selection, pages) {
  return pages.flatMap(({ image, rect }) => {
    const left = Math.max(selection.x, rect.offsetX)
    const top = Math.max(selection.y, rect.offsetY)
    const right = Math.min(selection.x + selection.width, rect.offsetX + rect.width)
    const bottom = Math.min(selection.y + selection.height, rect.offsetY + rect.height)
    if (right <= left || bottom <= top) return []

    const visible = { x: left, y: top, width: right - left, height: bottom - top }
    return [{
      image,
      source: sourceCropRect(visible, rect, image.naturalWidth, image.naturalHeight),
      destination: {
        x: left - selection.x,
        y: top - selection.y,
        width: visible.width,
        height: visible.height,
      },
    }]
  })
}

export function compressSpreadCrop(selection, pages, maxDimension = 1600) {
  const sourceDensity = Math.max(...pages.map(({ image, rect }) =>
    Math.max(image.naturalWidth / rect.width, image.naturalHeight / rect.height)
  ))
  const scale = Math.min(sourceDensity, maxDimension / Math.max(selection.width, selection.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(selection.width * scale))
  canvas.height = Math.max(1, Math.round(selection.height * scale))
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (const { image, source, destination } of pageCropLayers(selection, pages)) {
    context.drawImage(
      image,
      source.x, source.y, source.width, source.height,
      destination.x * scale, destination.y * scale,
      destination.width * scale, destination.height * scale,
    )
  }
  return canvas.toDataURL('image/jpeg', 0.82)
}
