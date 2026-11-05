/**
 * The small part of Markdown that agent replies use: paragraphs, bullet and numbered lists, code
 * blocks, **bold** and `code`. Built as React elements, never as HTML, so a reply cannot inject
 * markup into the page.
 */
import type { ReactNode } from 'react'

export type MdBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'code'; text: string }

const BULLET = /^\s*[-*•]\s+/
const NUMBER = /^\s*\d+[.)]\s+/

export function parseBlocks(source: string): MdBlock[] {
  const blocks: MdBlock[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join('\n') })
    paragraph = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      flush()
      const code: string[] = []
      for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++) code.push(lines[i])
      blocks.push({ kind: 'code', text: code.join('\n') })
      continue
    }
    const list = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null
    if (list) {
      flush()
      const last = blocks[blocks.length - 1]
      const item = line.replace(list === 'ul' ? BULLET : NUMBER, '')
      if (last?.kind === list) last.items.push(item)
      else blocks.push({ kind: list, items: [item] })
      continue
    }
    if (!line.trim()) flush()
    else paragraph.push(line)
  }
  flush()
  return blocks
}

/** **bold** and `code` inside one block of text. */
export function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let n = 0
  for (const match of text.matchAll(re)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    parts.push(token.startsWith('**') ? <strong key={n++}>{token.slice(2, -2)}</strong> : <code key={n++}>{token.slice(1, -1)}</code>)
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((block, i) => {
        if (block.kind === 'code') return <pre key={i}>{block.text}</pre>
        if (block.kind === 'p') return <p key={i}>{inline(block.text)}</p>
        const List = block.kind
        return (
          <List key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        )
      })}
    </>
  )
}
