import { useEffect, useState } from 'react'

const frameFor = () => ({
  width: Math.min(window.innerWidth, (window.innerHeight * 16) / 9),
  height: Math.min(window.innerHeight, (window.innerWidth * 9) / 16),
})

/** Dashed 16:9 outline shown with the guides on (dev mode in Part 1 §3.12). The guide controls sit in the player's control row. */
export function GuidesFrame() {
  const [frame, setFrame] = useState(frameFor)
  useEffect(() => {
    const onResize = () => setFrame(frameFor())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return <div className="guides-frame" aria-hidden style={{ width: frame.width, height: frame.height }} />
}
