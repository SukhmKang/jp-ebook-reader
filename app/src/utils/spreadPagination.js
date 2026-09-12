// BookWalker captures contain one centered cover followed by right/left page
// pairs. PDF index 0 is therefore a singleton; landscape spreads start at the
// odd zero-based indices 1, 3, 5... (PDF pages 2-3, 4-5...).

export function normalizeSpreadStart(pageIndex) {
  if (pageIndex <= 0) return 0
  return pageIndex % 2 === 1 ? pageIndex : pageIndex - 1
}

export function nextPageIndex(pageIndex, totalPages, landscape) {
  const lastPage = Math.max(0, totalPages - 1)
  if (!landscape) return Math.min(lastPage, pageIndex + 1)
  if (pageIndex === 0) return Math.min(lastPage, 1)
  return Math.min(lastPage, pageIndex + 2)
}

export function previousPageIndex(pageIndex, landscape) {
  if (!landscape) return Math.max(0, pageIndex - 1)
  if (pageIndex <= 1) return 0
  return pageIndex - 2
}

export function spreadState(pageIndex, totalPages, landscape) {
  const hasFacingPage = landscape && pageIndex > 0 && pageIndex + 1 < totalPages
  const lastVisiblePage = hasFacingPage ? pageIndex + 1 : pageIndex
  const nextIndex = nextPageIndex(pageIndex, totalPages, landscape)

  return {
    singlePage: !hasFacingPage,
    lastVisiblePage,
    canGoForward: nextIndex > lastVisiblePage,
  }
}
