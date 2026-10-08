import type { CSSProperties } from 'react'
import { useAsset } from './deckContext'
import { defineComponent } from './defineComponent'

export interface ContentImageProps {
  /** Imported image, a path relative to the deck folder, an absolute path, or a data: URL. */
  src: string
  alt?: string
  width?: string | number
  maxWidth?: string | number
  height?: string | number
  /** Soft radial fade at the edges. */
  fade?: boolean
  /** Percent of the image fully visible when fading. */
  fadeSize?: number
  style?: CSSProperties
}

function ContentImageComponent({ src, alt = '', width = '100%', maxWidth, height, fade = false, fadeSize = 70, style }: ContentImageProps) {
  const url = useAsset(src)
  const mask = fade ? `radial-gradient(ellipse at center, black ${fadeSize}%, transparent 100%)` : undefined
  return <img src={url} alt={alt} style={{ display: 'block', width, maxWidth, height, maskImage: mask, WebkitMaskImage: mask, ...style }} />
}

export const ContentImage = defineComponent<ContentImageProps>({
  Component: ContentImageComponent,
  registry: {
    id: 'content-image',
    name: 'ContentImage',
    category: 'component',
    description: 'Display an image from the content folder with optional fade effect.',
    props: [
      { name: 'src', type: 'string', description: 'Imported image or a path relative to the deck folder' },
      { name: 'alt', type: 'string', default: '""', description: 'Alternative text' },
      { name: 'width', type: 'string | number', default: '"100%"', description: 'Width' },
      { name: 'maxWidth', type: 'string | number', description: 'Maximum width' },
      { name: 'height', type: 'string | number', description: 'Height' },
      { name: 'fade', type: 'boolean', default: 'false', description: 'Soft radial fade at the edges' },
      { name: 'fadeSize', type: 'number', default: '70', description: 'Percent fully visible when fading' },
    ],
    snippet: '<ContentImage src="images/photo.png" alt="Description" width={800} />',
    previewCode: '<Slide theme="dark">\n  <Title size="compact">Images come from the deck folder</Title>\n  <Text muted>import photo from "./images/photo.png"</Text>\n</Slide>',
    keywords: ['image', 'picture', 'photo', 'graphic', 'png', 'jpg'],
    useCases: ['A screenshot', 'A photo with a soft edge'],
  },
  toolbar: [
    { prop: 'src', type: 'image' },
    { prop: 'fade', type: 'boolean' },
  ],
})
