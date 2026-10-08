import { useEffect, useState } from 'react'
import type { Annotation, Point } from '../drawing/types'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../drawing/types'
import type { SyncChannel } from './sync'

const POINTER_TIMEOUT = 2000

/** The presenter's pointer and in-progress stroke, as received by the audience window (Part 5 §B.4). */
export function useRemoteOverlay(channel: SyncChannel, enabled: boolean) {
  const [pointer, setPointer] = useState<{ slideIndex: number; point: Point } | null>(null)
  const [preview, setPreview] = useState<{ slideIndex: number; annotation: Annotation } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let expiry: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = channel.subscribe((m) => {
      if (m.type === 'pointer') {
        clearTimeout(expiry)
        if (!m.point) return setPointer(null)
        setPointer({ slideIndex: m.slideIndex, point: m.point })
        expiry = setTimeout(() => setPointer(null), POINTER_TIMEOUT) // the heartbeat keeps a resting pointer alive
      } else if (m.type === 'annotation-preview') {
        setPreview(m.annotation ? { slideIndex: m.slideIndex, annotation: m.annotation } : null)
      }
    })
    return () => {
      clearTimeout(expiry)
      unsubscribe()
      setPointer(null)
      setPreview(null)
    }
  }, [channel, enabled])
  return { pointer, preview }
}

/** The red dot the audience sees where the presenter points. */
export function RemotePointer({ point }: { point: Point }) {
  return (
    <svg className="remote-pointer" viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <circle cx={point.x} cy={point.y} r={18} fill="#ff2d2d" stroke="#ffffff" strokeWidth={6} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
    </svg>
  )
}
