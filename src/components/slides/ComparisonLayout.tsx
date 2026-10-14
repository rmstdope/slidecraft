import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { defineComponent } from './defineComponent'
import { useSlideLayout } from './slideLayoutContext'
import { accentZone, SplitBackground } from './SplitBackground'

interface Header {
  label?: string
  title: string
  subtitle?: string
}

export interface ComparisonLayoutProps {
  leftHeader: Header
  rightHeader: Header
  icon?: string
  centerTitle: string
  leftContent?: ReactNode
  rightContent?: ReactNode
  /** Defaults to the slide background. */
  topColor?: string
  /** Defaults to the slide background tinted with the accent. */
  bottomColor?: string
  /** Defaults to a tint of the accent. */
  iconColor?: string
}

function HeaderBlock({ header }: { header: Header }) {
  return (
    <motion.div variants={itemVariants} style={{ flex: 1, textAlign: 'center' }}>
      {header.label && <div style={{ fontFamily: 'var(--font-body)', fontSize: 24, color: 'var(--muted)', marginBottom: 8 }}>{header.label}</div>}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 'normal', color: 'var(--text)', marginBottom: 8 }}>{header.title}</div>
      {header.subtitle && <div style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontStyle: 'italic', color: 'var(--muted)', opacity: 0.85 }}>{header.subtitle}</div>}
    </motion.div>
  )
}

function ComparisonLayoutComponent({ leftHeader, rightHeader, icon = '⚙️', centerTitle, leftContent, rightContent, topColor, bottomColor, iconColor }: ComparisonLayoutProps) {
  const { scheme } = useSlideLayout()
  return (
    <>
      <SplitBackground topColor={topColor} bottomColor={bottomColor ?? accentZone(scheme)} topHeight={380} />
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 1, color: 'var(--text)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '80px 120px 0' }}>
          <HeaderBlock header={leftHeader} />
          <HeaderBlock header={rightHeader} />
        </div>
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '40px 0', zIndex: 10 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: iconColor ?? 'color-mix(in srgb, var(--accent) 30%, var(--bg))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{icon}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, marginTop: 12 }}>{centerTitle}</div>
        </motion.div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 120px', flex: 1 }}>
          <motion.div variants={itemVariants} style={{ flex: 1, paddingRight: 80 }}>{leftContent}</motion.div>
          <motion.div variants={itemVariants} style={{ flex: 1, paddingLeft: 80 }}>{rightContent}</motion.div>
        </div>
        <svg aria-hidden width={2} style={{ position: 'absolute', left: '50%', top: 80, bottom: 80, height: 'calc(100% - 160px)' }}>
          <line x1={1} y1={0} x2={1} y2="100%" style={{ stroke: 'color-mix(in srgb, var(--text) 25%, transparent)' }} strokeWidth={2} strokeDasharray="4,8" strokeLinecap="round" />
        </svg>
      </motion.div>
    </>
  )
}

export const ComparisonLayout = defineComponent<ComparisonLayoutProps>({
  Component: ComparisonLayoutComponent,
  registry: {
    id: 'comparison-layout',
    name: 'ComparisonLayout',
    category: 'component',
    description: 'Full-slide comparison with a two-tone background in the slide colours, an icon and two columns.',
    props: [
      { name: 'leftHeader', type: '{ label?: string; title: string; subtitle?: string }', description: 'Left column header' },
      { name: 'rightHeader', type: '{ label?: string; title: string; subtitle?: string }', description: 'Right column header' },
      { name: 'icon', type: 'string', default: '"⚙️"', description: 'Emoji in the centre' },
      { name: 'centerTitle', type: 'string', description: 'Title under the icon' },
      { name: 'leftContent', type: 'ReactNode', description: 'Left column content' },
      { name: 'rightContent', type: 'ReactNode', description: 'Right column content' },
      { name: 'topColor', type: 'string', description: 'Header band colour; defaults to the slide background' },
      { name: 'bottomColor', type: 'string', description: 'Lower band colour; defaults to the slide background tinted with the accent' },
      { name: 'iconColor', type: 'string', description: 'Icon tile colour; defaults to a tint of the accent' },
    ],
    snippet:
      '<ComparisonLayout\n  leftHeader={{ label: "Option A", title: "Build" }}\n  rightHeader={{ label: "Option B", title: "Buy" }}\n  centerTitle="Trade-offs"\n  leftContent={<List compact><ListItem>Full control</ListItem></List>}\n  rightContent={<List compact><ListItem>Faster start</ListItem></List>}\n/>',
    previewCode:
      '<Slide scheme="light" background="transparent">\n  <ComparisonLayout\n    leftHeader={{ label: "Option A", title: "Build" }}\n    rightHeader={{ label: "Option B", title: "Buy" }}\n    centerTitle="Trade-offs"\n    leftContent={<List compact><ListItem>Full control</ListItem></List>}\n    rightContent={<List compact><ListItem>Faster start</ListItem></List>}\n  />\n</Slide>',
    keywords: ['comparison', 'versus', 'split', 'two-column', 'contrast'],
    useCases: ['Two options compared on one slide'],
  },
})
