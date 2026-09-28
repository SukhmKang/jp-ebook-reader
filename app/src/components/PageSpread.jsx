import { useCallback, useEffect, useRef, useState } from 'react'
import WordOverlay from './WordOverlay'
import { compressSpreadCrop, imageBounds, selectionRect } from '../utils/imageSelection'

function getContainedRect(containerW, containerH, naturalW, naturalH) {
  if (!naturalW || !naturalH) return null
  const containerRatio = containerW / containerH
  const imgRatio = naturalW / naturalH
  let renderedW, renderedH, offsetX, offsetY
  if (imgRatio > containerRatio) {
    renderedW = containerW
    renderedH = containerW / imgRatio
    offsetX = 0
    offsetY = (containerH - renderedH) / 2
  } else {
    renderedW = containerH * imgRatio
    renderedH = containerH
    offsetX = (containerW - renderedW) / 2
    offsetY = 0
  }
  return { width: renderedW, height: renderedH, offsetX, offsetY }
}

function PagePanel({ imageData, ocrPage, onWordTap, single = false }) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [imageRect, setImageRect] = useState(null)

  function updateRect() {
    const container = containerRef.current
    const img = imgRef.current
    if (!container || !img || !img.naturalWidth) return
    const rect = getContainedRect(
      container.clientWidth, container.clientHeight,
      img.naturalWidth, img.naturalHeight
    )
    setImageRect(rect)
  }

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(updateRect)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      data-page-panel
      className={`relative h-full ${single ? 'w-full' : 'flex-shrink-0'}`}
    >
      {imageData ? (
        <img
          ref={imgRef}
          src={imageData}
          alt=""
          className={single ? "h-full w-full object-contain" : "h-full w-auto"}
          draggable={false}
          onLoad={updateRect}
        />
      ) : (
        <div className="h-full aspect-[2/3] bg-zinc-900" />
      )}
      <WordOverlay ocrPage={ocrPage} imageRect={imageRect} onWordTap={onWordTap} />
    </div>
  )
}

export default function PageSpread({
  rightImage, leftImage,
  rightOcr, leftOcr,
  onWordTap, onImageSelect, onSwipeLeft, onSwipeRight,
  selectionMode = false,
  singlePage = false,
}) {
  const spreadRef = useRef(null)
  const startX = useRef(null)
  const multiTouch = useRef(false)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)
  const [drag, setDrag] = useState(null)

  function localPoint(event) {
    const bounds = spreadRef.current.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  function visiblePages() {
    const spread = spreadRef.current
    if (!spread) return []
    const spreadBounds = spread.getBoundingClientRect()
    return [...spread.querySelectorAll('[data-page-panel]')].flatMap((panel) => {
      const image = panel.querySelector('img')
      if (!image?.naturalWidth || !image.naturalHeight) return []
      const panelBounds = panel.getBoundingClientRect()
      const contained = getContainedRect(
        panel.clientWidth, panel.clientHeight, image.naturalWidth, image.naturalHeight,
      )
      return [{
        image,
        rect: {
          offsetX: panelBounds.left - spreadBounds.left + contained.offsetX,
          offsetY: panelBounds.top - spreadBounds.top + contained.offsetY,
          width: contained.width,
          height: contained.height,
        },
      }]
    })
  }

  function handlePointerDown(event) {
    if ((!event.shiftKey && !selectionMode) || event.button !== 0) return
    const pages = visiblePages()
    const point = localPoint(event)
    const onImage = pages.some(({ rect }) =>
      point.x >= rect.offsetX && point.x <= rect.offsetX + rect.width &&
      point.y >= rect.offsetY && point.y <= rect.offsetY + rect.height
    )
    if (!onImage) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = { start: point, current: point, pages, bounds: imageBounds(pages) }
    dragRef.current = next
    setDrag(next)
    suppressClickRef.current = true
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return
    event.preventDefault()
    const next = { ...dragRef.current, current: localPoint(event) }
    dragRef.current = next
    setDrag(next)
  }

  function handlePointerUp(event) {
    const active = dragRef.current
    if (!active) return
    event.preventDefault()
    event.stopPropagation()
    const completed = selectionRect(active.start, localPoint(event), active.bounds)
    dragRef.current = null
    setDrag(null)
    if (completed) onImageSelect?.(compressSpreadCrop(completed, active.pages))
    setTimeout(() => { suppressClickRef.current = false }, 100)
  }

  const visibleSelection = drag
    ? selectionRect(drag.start, drag.current, drag.bounds)
    : null

  const handleTouchStart = useCallback((e) => {
    if (selectionMode) { startX.current = null; return }
    if (e.touches.length > 1) { multiTouch.current = true; startX.current = null; return }
    multiTouch.current = false
    // Don't intercept swipes when zoomed in — let iOS handle pan/scroll
    if ((window.visualViewport?.scale ?? 1) > 1) { startX.current = null; return }
    startX.current = e.touches[0].clientX
  }, [selectionMode])

  const handleTouchEnd = useCallback((e) => {
    if (multiTouch.current || startX.current === null) { startX.current = null; return }
    if ((window.visualViewport?.scale ?? 1) > 1) { startX.current = null; return }
    const dx = e.changedTouches[0].clientX - startX.current
    if (Math.abs(dx) > 50) {
      dx < 0 ? onSwipeLeft?.() : onSwipeRight?.()
    }
    startX.current = null
  }, [onSwipeLeft, onSwipeRight])

  return (
    <div
      ref={spreadRef}
      className={`relative flex w-full h-full justify-center overflow-hidden ${selectionMode ? 'cursor-crosshair' : ''}`}
      style={{ touchAction: selectionMode ? 'none' : undefined }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null
        suppressClickRef.current = false
        setDrag(null)
      }}
      onClickCapture={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      <div className={`flex h-full ${singlePage ? 'w-full' : ''}`}>
        {!singlePage && (
          <PagePanel imageData={leftImage} ocrPage={leftOcr} onWordTap={onWordTap} />
        )}
        <PagePanel imageData={rightImage} ocrPage={rightOcr} onWordTap={onWordTap} single={singlePage} />
      </div>
      {visibleSelection && (
        <div
          className="pointer-events-none absolute z-20 border-2"
          style={{
            left: visibleSelection.x,
            top: visibleSelection.y,
            width: visibleSelection.width,
            height: visibleSelection.height,
            borderColor: 'var(--vermillion)',
            background: 'rgba(193, 67, 45, 0.16)',
          }}
        />
      )}
    </div>
  )
}
