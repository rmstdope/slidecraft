import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { PASTEL_INK } from './accents'
import { defineComponent } from './defineComponent'
import { wavePath } from './SplitBackground'

export interface DefinitionLayoutProps {
  title: string
  subtitle: string
  leftContent?: ReactNode
  rightContent?: ReactNode
  backgroundColor?: string
  sidebarTitle?: string
}

const DIVIDER = 350

function DefinitionLayoutComponent({ title, subtitle, leftContent, rightContent, backgroundColor = '#dff3e8', sidebarTitle = 'Consists of' }: DefinitionLayoutProps) {
  return (
    <>
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: DIVIDER, background: '#ffffff' }} />
        <div style={{ position: 'absolute', top: DIVIDER, left: 0, right: 0, bottom: 0, background: backgroundColor }} />
        <svg viewBox="0 0 1920 24" preserveAspectRatio="none" style={{ position: 'absolute', top: DIVIDER - 12, left: 0, width: '100%', height: 24 }}>
          <path d={wavePath(1920, 96, 24)} fill={backgroundColor} />
        </svg>
      </div>
      <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ position: 'absolute', inset: 0, zIndex: 1, color: PASTEL_INK, textAlign: 'left' }}>
        <motion.div variants={itemVariants} style={{ height: DIVIDER, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 72, color: '#1a1a1a', marginBottom: 12, lineHeight: 1 }}>{title}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 34, fontStyle: 'italic', color: 'rgba(0,0,0,0.45)', lineHeight: 1.15 }}>{subtitle}</div>
        </motion.div>
        <div style={{ position: 'absolute', top: 412, left: 110, right: 110, bottom: 110, display: 'flex', gap: 68, alignItems: 'flex-start' }}>
          <motion.div variants={itemVariants} style={{ flex: 1 }}>{leftContent}</motion.div>
          <motion.div variants={itemVariants} style={{ width: 640, position: 'relative' }}>
            {sidebarTitle && (
              <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', background: '#ffffff', padding: '10px 36px', borderRadius: '6px 6px 0 0', fontFamily: 'var(--font-body)', fontSize: 29, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {sidebarTitle}
              </div>
            )}
            <div style={{ background: '#ffffff', borderRadius: 10, padding: '48px 40px 40px', fontFamily: 'var(--font-body)', fontSize: 18, lineHeight: 1.35 }}>{rightContent}</div>
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}

export const DefinitionLayout = defineComponent<DefinitionLayoutProps>({
  Component: DefinitionLayoutComponent,
  registry: {
    id: 'definition-layout',
    name: 'DefinitionLayout',
    category: 'component',
    description: 'Full-width colored slide with title, content, and sidebar card.',
    props: [
      { name: 'title', type: 'string', description: 'Term being defined' },
      { name: 'subtitle', type: 'string', description: 'Italic definition' },
      { name: 'leftContent', type: 'ReactNode', description: 'Main column' },
      { name: 'rightContent', type: 'ReactNode', description: 'Sidebar card content' },
      { name: 'backgroundColor', type: 'string', default: '"#dff3e8"', description: 'Lower zone colour' },
      { name: 'sidebarTitle', type: 'string', default: '"Consists of"', description: 'Tab above the sidebar card' },
    ],
    snippet:
      '<DefinitionLayout\n  title="Term"\n  subtitle="What the term means, in one sentence."\n  leftContent={<Text align="left">Explanation</Text>}\n  rightContent={<List compact><ListItem>Part one</ListItem></List>}\n/>',
    previewCode:
      '<Slide scheme="light" background="transparent">\n  <DefinitionLayout\n    title="Term"\n    subtitle="What the term means, in one sentence."\n    leftContent={<Text align="left">Explanation</Text>}\n    rightContent={<List compact><ListItem>Part one</ListItem></List>}\n  />\n</Slide>',
    keywords: ['definition', 'full-width', 'sidebar', 'card', 'colored'],
    useCases: ['Defining a term with its parts'],
  },
})
