import type { CSSProperties } from 'react'
import { useAsset } from './deckContext'
import { defineComponent } from './defineComponent'

export interface SvgProps {
  src: string
  alt?: string
  width?: string | number
  maxWidth?: string | number
  height?: string | number
  style?: CSSProperties
}

export const Svg = defineComponent<SvgProps>({
  Component: function SvgComponent({ src, alt = '', width = '100%', maxWidth, height, style }: SvgProps) {
    const url = useAsset(src)
    return <img src={url} alt={alt} style={{ display: 'block', width, maxWidth, height, ...style }} />
  },
  registry: {
    id: 'svg',
    name: 'Svg',
    category: 'component',
    description: 'Display an SVG file from the content folder.',
    props: [
      { name: 'src', type: 'string', description: 'Imported SVG or a path relative to the deck folder' },
      { name: 'alt', type: 'string', default: '""', description: 'Alternative text' },
      { name: 'width', type: 'string | number', default: '"100%"', description: 'Width' },
      { name: 'maxWidth', type: 'string | number', description: 'Maximum width' },
      { name: 'height', type: 'string | number', description: 'Height' },
    ],
    snippet: '<Svg src="images/diagram.svg" alt="Diagram" width={1200} />',
    previewCode: '<Slide scheme="dark">\n  <Title size="compact">Vector drawings from the deck folder</Title>\n</Slide>',
    keywords: ['svg', 'image', 'vector', 'graphic', 'diagram'],
    useCases: ['A diagram exported from a drawing tool'],
  },
})
