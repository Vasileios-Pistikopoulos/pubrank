import { useState, useEffect, useRef, useCallback } from 'react'

export const PAGE_SIZE = 50

export function useInfiniteScroll(items) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const lenRef      = useRef(items.length)
  lenRef.current    = items.length
  const observerRef = useRef(null)

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [items.length])

  const sentinelRef = useCallback(el => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null }
    if (!el) return
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting)
        setVisibleCount(n => Math.min(n + PAGE_SIZE, lenRef.current))
    }, { rootMargin: '300px' })
    observerRef.current.observe(el)
  }, [])

  return {
    visible:    items.slice(0, visibleCount),
    sentinelRef,
    hasMore:    visibleCount < items.length,
    showing:    Math.min(visibleCount, items.length),
    total:      items.length,
  }
}

export function ScrollSentinel({ sentinelRef }) {
  return (
    <div ref={sentinelRef}
      style={{ height: 40, display: 'flex', alignItems: 'center',
               justifyContent: 'center', color: '#bbb', fontSize: '0.8rem' }}>
      Loading more…
    </div>
  )
}
