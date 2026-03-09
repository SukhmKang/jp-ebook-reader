export default function WordOverlay({ ocrPage, imageRect, onWordTap }) {
  if (!ocrPage || !imageRect) return null

  const { width: srcW, height: srcH } = ocrPage
  const { width: dW, height: dH, offsetX, offsetY } = imageRect
  const scaleX = dW / srcW
  const scaleY = dH / srcH

  return (
    <div className="absolute inset-0 pointer-events-none">
      {ocrPage.blocks?.flatMap((block, bi) =>
        block.paragraphs?.flatMap((para, pi) => {
          // Compute each word's char offset within the paragraph text
          let charOffset = 0
          return para.words?.map((word, wi) => {
            const offset = charOffset
            charOffset += word.text.length

            const { x, y, w, h } = word.bounding_box
            const sx = offsetX + x * scaleX - 4
            const sy = offsetY + y * scaleY - 4
            const sw = w * scaleX + 8
            const sh = h * scaleY + 8

            return (
              <div
                key={`${bi}-${pi}-${wi}`}
                className="absolute pointer-events-auto cursor-pointer"
                style={{ left: sx, top: sy, width: sw, height: sh }}
                onClick={(e) => {
                  e.stopPropagation()
                  onWordTap({
                    text: word.text,
                    paraText: para.text,
                    charOffset: offset,
                    x: sx + sw / 2,
                    y: sy + sh / 2,
                  })
                }}
              />
            )
          })
        })
      )}
    </div>
  )
}
