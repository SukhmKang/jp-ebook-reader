import { useCallback, useEffect, useRef, useState } from 'react'
import WordOverlay from './WordOverlay'

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
    <div ref={containerRef} className={`relative h-full ${single ? 'w-full' : 'flex-shrink-0'}`}>
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
  onWordTap, onSwipeLeft, onSwipeRight,
  singlePage = false,
}) {
  const startX = useRef(null)
  const multiTouch = useRef(false)

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length > 1) { multiTouch.current = true; startX.current = null; return }
    multiTouch.current = false
    // Don't intercept swipes when zoomed in — let iOS handle pan/scroll
    if ((window.visualViewport?.scale ?? 1) > 1) { startX.current = null; return }
    startX.current = e.touches[0].clientX
  }, [])

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
      className="flex w-full h-full justify-center overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`flex h-full ${singlePage ? 'w-full' : ''}`}>
        {!singlePage && (
          <PagePanel imageData={leftImage} ocrPage={leftOcr} onWordTap={onWordTap} />
        )}
        <PagePanel imageData={rightImage} ocrPage={rightOcr} onWordTap={onWordTap} single={singlePage} />
      </div>
    </div>
  )
}
