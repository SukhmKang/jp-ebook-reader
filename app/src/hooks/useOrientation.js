import { useEffect, useState } from 'react'

function isLandscape() {
  return window.matchMedia('(orientation: landscape)').matches
}

export function useOrientation() {
  const [landscape, setLandscape] = useState(isLandscape)

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const handler = (e) => setLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return landscape
}
