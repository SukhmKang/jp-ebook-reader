function textForPage(page) {
  if (!page) return ''
  const paragraphText = page.blocks
    ?.flatMap((block) => block.paragraphs?.map((paragraph) => paragraph.text?.trim()).filter(Boolean) ?? [])
    .join('\n')
  return paragraphText || page.full_text?.trim() || ''
}

export function buildStoryContext(pages, currentPageIndex, lookback = 12, maxChars = 12000) {
  if (!Array.isArray(pages) || pages.length === 0 || currentPageIndex < 0) return ''

  const end = Math.min(currentPageIndex, pages.length - 1)
  const start = Math.max(0, end - lookback)
  const sections = []
  let remaining = maxChars

  // Work backwards so the most recent story context always survives the cap,
  // then restore chronological order for the model.
  for (let index = end; index >= start && remaining > 0; index -= 1) {
    const text = textForPage(pages[index])
    if (!text) continue
    const label = `[Page ${index + 1}]\n`
    const available = Math.max(0, remaining - label.length)
    if (!available) break
    const excerpt = text.slice(0, available)
    sections.unshift(`${label}${excerpt}`)
    remaining -= label.length + excerpt.length + 2
  }

  return sections.join('\n\n')
}
