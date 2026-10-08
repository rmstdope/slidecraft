import { useEffect, useRef, useState } from 'react'

/** Becomes true once the element comes within `rootMargin` of the viewport, then stays true. */
export function useInView<T extends Element>(rootMargin = '400px'): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') return setInView(true)
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, inView])
  return [ref, inView]
}
