import { useAsset } from './deckContext'
import { defineComponent } from './defineComponent'

const POSITIONS = { center: 'center center', top: 'center top', bottom: 'center bottom', left: 'left center', right: 'right center' } as const
type Fade = 'none' | 'top' | 'bottom' | 'left' | 'right' | 'radial'

export interface BackgroundImageProps {
  src: string
  opacity?: number
  position?: keyof typeof POSITIONS
  /** Blur radius in px. */
  blur?: number
  fade?: Fade
  /** Blend the photo into the slide theme. */
  overlay?: boolean
}

export function fadeMask(fade: Fade): string | undefined {
  if (fade === 'none') return undefined
  if (fade === 'radial') return 'radial-gradient(ellipse at center, black 50%, transparent 100%)'
  const toward = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[fade]
  return `linear-gradient(to ${toward}, transparent, black 30%)`
}

function BackgroundImageComponent({ src, opacity = 1, position = 'center', blur = 0, fade = 'none', overlay = true }: BackgroundImageProps) {
  const url = useAsset(src)
  const mask = fadeMask(fade)
  const bleed = 2 * blur // over-extend so the blur has no soft edge
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, maskImage: mask, WebkitMaskImage: mask }}>
        <img
          src={url}
          alt=""
          style={{
            position: 'absolute',
            top: -bleed,
            left: -bleed,
            width: `calc(100% + ${2 * bleed}px)`,
            height: `calc(100% + ${2 * bleed}px)`,
            objectFit: 'cover',
            objectPosition: POSITIONS[position] ?? POSITIONS.center,
            opacity,
            filter: blur ? `blur(${blur}px)` : undefined,
          }}
        />
      </div>
      {overlay && <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'var(--bg)', opacity: 0.6 }} />}
    </div>
  )
}

export const BackgroundImage = defineComponent<BackgroundImageProps>({
  Component: BackgroundImageComponent,
  registry: {
    id: 'background-image',
    name: 'BackgroundImage',
    category: 'component',
    description: 'Full-bleed photo behind the slide content, with blur, fade and a theme overlay.',
    props: [
      { name: 'src', type: 'string', description: 'Imported image or a path relative to the deck folder' },
      { name: 'opacity', type: 'number', default: '1', description: 'Image opacity' },
      { name: 'position', type: '"center" | "top" | "bottom" | "left" | "right"', default: '"center"', description: 'Which part of the image stays in view' },
      { name: 'blur', type: 'number', default: '0', description: 'Blur radius in px' },
      { name: 'fade', type: '"none" | "top" | "bottom" | "left" | "right" | "radial"', default: '"none"', description: 'Fade toward an edge' },
      { name: 'overlay', type: 'boolean', default: 'true', description: 'Blend into the theme background' },
    ],
    snippet: '<BackgroundImage src="images/photo.jpg" blur={4} />',
    previewCode: '<Slide theme="dark">\n  <Title>Text over a photo</Title>\n</Slide>',
    keywords: ['background', 'image', 'photo', 'cover'],
    useCases: ['A mood photo behind a title'],
  },
  toolbar: [
    { prop: 'src', type: 'image' },
    { prop: 'opacity', type: 'number', min: 0, max: 1, step: 0.1 },
    { prop: 'blur', type: 'number', min: 0, max: 20, step: 1 },
    { prop: 'position', type: 'select', options: ['center', 'top', 'bottom', 'left', 'right'] },
    { prop: 'fade', type: 'select', options: ['none', 'top', 'bottom', 'left', 'right', 'radial'] },
    { prop: 'overlay', type: 'boolean' },
  ],
})
