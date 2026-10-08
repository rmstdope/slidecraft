import type { CSSProperties } from 'react'
import { defineComponent } from './defineComponent'

export interface YouTubeProps {
  videoId: string
  /** Seconds. */
  start?: number
  end?: number
  width?: number
  height?: number
  style?: CSSProperties
}

export function youTubeUrl(videoId: string, start?: number, end?: number): string {
  const params = new URLSearchParams()
  if (start != null) params.set('start', String(start))
  if (end != null) params.set('end', String(end))
  params.set('rel', '0')
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`
}

export const YouTube = defineComponent<YouTubeProps>({
  Component: ({ videoId, start, end, width = 960, height = 540, style }) => (
    <iframe
      data-no-advance
      src={youTubeUrl(videoId, start, end)}
      width={width}
      height={height}
      title="YouTube video"
      style={{ border: 'none', borderRadius: 8, ...style }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  ),
  registry: {
    id: 'youtube',
    name: 'YouTube',
    category: 'component',
    description: 'Embedded YouTube video.',
    props: [
      { name: 'videoId', type: 'string', description: 'The id from the video URL' },
      { name: 'start', type: 'number', description: 'Start at this second' },
      { name: 'end', type: 'number', description: 'Stop at this second' },
      { name: 'width', type: 'number', default: '960', description: 'Width in px' },
      { name: 'height', type: 'number', default: '540', description: 'Height in px' },
    ],
    snippet: '<YouTube videoId="VIDEO_ID" />',
    previewCode: '<Slide scheme="dark">\n  <Title size="compact">An embedded video plays here</Title>\n</Slide>',
    keywords: ['video', 'youtube', 'embed', 'media', 'player', 'iframe'],
    useCases: ['A short demo video'],
  },
})
