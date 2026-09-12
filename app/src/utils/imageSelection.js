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

export function compressCrop(image, crop, maxDimension = 1600) {
  const scale = Math.min(1, maxDimension / Math.max(crop.width, crop.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(crop.width * scale))
  canvas.height = Math.max(1, Math.round(crop.height * scale))
  canvas.getContext('2d').drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas.toDataURL('image/jpeg', 0.82)
}
