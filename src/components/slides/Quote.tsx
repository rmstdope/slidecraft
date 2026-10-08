import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { itemVariants } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface QuoteProps {
  children?: ReactNode
  author?: string
  noWrap?: boolean
  className?: string
}

export const Quote = defineComponent<QuoteProps>({
  Component: ({ children, author, noWrap = false, className }) => (
    <motion.blockquote
      className={className}
      variants={itemVariants}
      style={{
        position: 'relative',
        fontFamily: 'var(--font-display)',
        fontSize: 48,
        fontStyle: 'italic',
        lineHeight: 1.4,
        textAlign: 'center',
        color: 'var(--text)',
        width: noWrap ? 'auto' : 1400,
        whiteSpace: noWrap ? 'nowrap' : undefined,
        padding: '0 64px',
      }}
    >
      <span aria-hidden style={{ position: 'absolute', top: -16, left: 0, fontSize: 96, lineHeight: 1, color: 'var(--accent)', opacity: 0.3 }}>
        “
      </span>
      {children}
      {author && (
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 24,
            fontStyle: 'normal',
            fontWeight: 600,
            color: 'var(--accent)',
            marginTop: 32,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          — {author}
        </motion.footer>
      )}
    </motion.blockquote>
  ),
  registry: {
    id: 'quote',
    name: 'Quote',
    category: 'component',
    description: 'Styled quotation block with optional author.',
    props: [
      { name: 'author', type: 'string', default: '""', description: 'Attribution shown below' },
      { name: 'noWrap', type: 'boolean', default: 'false', description: 'Keep the quote on one line' },
    ],
    snippet: '<Quote author="Author Name">The quotation goes here.</Quote>',
    previewCode: '<Slide theme="dark">\n  <Quote author="Author Name">Simple things should be simple.</Quote>\n</Slide>',
    keywords: ['quotation', 'cite', 'attribution', 'blockquote'],
    useCases: ['A testimonial', 'A principle in someone’s words'],
  },
  toolbar: [{ prop: 'noWrap', type: 'boolean' }],
})
