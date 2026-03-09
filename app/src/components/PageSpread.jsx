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

function PagePanel({ imageData, ocrPage, onWordTap }) {
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
    <div ref={containerRef} className="relative flex-1 h-full overflow-hidden">
      {imageData ? (
        <img
          ref={imgRef}
          src={imageData}
          alt=""
          className="w-full h-full object-contain"
          draggable={false}
          onLoad={updateRect}
        />
      ) : (
        <div className="w-full h-full bg-zinc-900" />
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

  const handleTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (startX.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    if (Math.abs(dx) > 50) {
      dx < 0 ? onSwipeLeft?.() : onSwipeRight?.()
    }
    startX.current = null
  }, [onSwipeLeft, onSwipeRight])

  return (
    <div
      className="flex w-full h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {!singlePage && (
        <PagePanel imageData={leftImage} ocrPage={leftOcr} onWordTap={onWordTap} />
      )}
      <PagePanel imageData={rightImage} ocrPage={rightOcr} onWordTap={onWordTap} />
    </div>
  )
}
