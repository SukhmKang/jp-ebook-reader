// PDFs are normalized so the first page is the right-hand side of the first
// spread. Landscape therefore pairs pages 1-2, 3-4, ... without book-specific
// offsets. Source PDFs with a lone cover must include an inside-cover blank.

export function normalizeSpreadStart(pageIndex) {
  const index = Math.max(0, pageIndex)
  return index - (index % 2)
}

export function nextPageIndex(pageIndex, totalPages, landscape) {
  const lastPage = Math.max(0, totalPages - 1)
  if (!landscape) return Math.min(lastPage, pageIndex + 1)
  return Math.min(lastPage, pageIndex + 2)
}

export function previousPageIndex(pageIndex, landscape) {
  if (!landscape) return Math.max(0, pageIndex - 1)
  return Math.max(0, pageIndex - 2)
}

export function spreadState(pageIndex, totalPages, landscape) {
  const hasFacingPage = landscape && pageIndex + 1 < totalPages
  const lastVisiblePage = hasFacingPage ? pageIndex + 1 : pageIndex
  const nextIndex = nextPageIndex(pageIndex, totalPages, landscape)

  return {
    singlePage: !hasFacingPage,
    lastVisiblePage,
    canGoForward: nextIndex > lastVisiblePage,
  }
}
