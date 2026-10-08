import { useEffect, useState } from 'react'

export interface DevOverlayProps {
  fitMode: boolean
  onToggleFit: () => void
  onExit: () => void
}

const frameFor = () => ({
  width: Math.min(window.innerWidth, (window.innerHeight * 16) / 9),
  height: Math.min(window.innerHeight, (window.innerWidth * 9) / 16),
})

/** Dashed 16:9 outline plus the dev toolbar (Part 1 §3.12). */
export function DevOverlay({ fitMode, onToggleFit, onExit }: DevOverlayProps) {
  const [frame, setFrame] = useState(frameFor)
  useEffect(() => {
    const onResize = () => setFrame(frameFor())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <>
      <div className="dev-frame" aria-hidden style={{ width: frame.width, height: frame.height }} />
      <div className="dev-toolbar" data-no-advance>
        <button type="button" className="presentation-view-button" onClick={onExit}>
          Present
        </button>
        <button type="button" className="presentation-view-button" onClick={onToggleFit} title="F">
          {fitMode ? 'Fit Mode' : 'Actual Mode'}
        </button>
        <span className="dev-toolbar__badge">DEV</span>
      </div>
    </>
  )
}
