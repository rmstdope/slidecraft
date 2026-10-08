import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentColors, isAccent, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface AppShellDiagramProps {
  title: string
  topBar: { label: string; items?: string[] }
  sidebar: { label: string; items?: string[] }
  mainArea: { label: string; subtitle?: string }
  accent?: AccentColor
}

const WIDTH = 1200
const HEIGHT = 600
const TOP_BAR = 80
const SIDEBAR = 200
const PAD = 16

function AppShellDiagramComponent({ title, topBar, sidebar, mainArea, accent: accentProp }: AppShellDiagramProps) {
  const accent = useAccent(accentProp)
  const color = accentColors[accent]
  const darkInk = isAccent(accentProp) && accentProp === 'yellow'
  const fillInk = accent === 'yellow' ? '#1a1a1a' : '#ffffff'
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <motion.div variants={itemVariants} style={{ position: 'relative', width: WIDTH, height: HEIGHT, border: `3px solid ${color}`, borderRadius: 16, background: 'rgba(0,0,0,0.2)', overflow: 'hidden', padding: PAD, display: 'grid', gridTemplateRows: `${TOP_BAR}px 1fr`, gridTemplateColumns: `${SIDEBAR}px 1fr`, gap: PAD, fontFamily: 'var(--font-body)' }}>
        <div style={{ position: 'absolute', top: -1, right: 40, background: color, padding: '8px 24px', borderRadius: '0 0 8px 8px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: darkInk ? '#1a1a1a' : '#ffffff', zIndex: 1 }}>{title}</div>
        <motion.div variants={itemVariants} style={{ gridColumn: '1 / 3', borderRadius: 12, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#2a2a2a' }}>{topBar.label}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {(topBar.items ?? []).map((item, i) => (
              <span key={i} style={{ fontSize: 14, padding: '6px 12px', borderRadius: 6, background: 'rgba(0,0,0,0.05)', color: '#2a2a2a' }}>{item}</span>
            ))}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} style={{ borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '2px dashed rgba(255,255,255,0.3)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }}>{sidebar.label}</span>
          {(sidebar.items ?? []).map((item, i) => (
            <span key={i} style={{ fontSize: 14, padding: '8px 10px', borderRadius: 6, background: i === 0 ? color : 'rgba(255,255,255,0.06)', color: i === 0 ? fillInk : 'rgba(255,255,255,0.85)' }}>{item}</span>
          ))}
        </motion.div>
        <motion.div variants={itemVariants} style={{ borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#ffffff' }}>{mainArea.label}</span>
          {mainArea.subtitle && <span style={{ fontSize: 18, fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>{mainArea.subtitle}</span>}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export const AppShellDiagram = defineComponent<AppShellDiagramProps>({
  Component: AppShellDiagramComponent,
  registry: {
    id: 'app-shell-diagram',
    name: 'AppShellDiagram',
    category: 'component',
    description: 'Architecture diagram showing app shell with topbar, sidebar, and main area.',
    props: [
      { name: 'title', type: 'string', description: 'Badge text on the frame' },
      { name: 'topBar', type: '{ label: string; items?: string[] }', description: 'Top bar' },
      { name: 'sidebar', type: '{ label: string; items?: string[] }', description: 'Sidebar; the first item is highlighted' },
      { name: 'mainArea', type: '{ label: string; subtitle?: string }', description: 'Main area' },
      { name: 'accent', type: '"yellow" | "teal" | "navy" | "red" | "gray"', description: 'Defaults to the slide accent' },
    ],
    snippet: '<AppShellDiagram\n  title="Host app"\n  topBar={{ label: "Top bar", items: ["Search", "Profile"] }}\n  sidebar={{ label: "Modules", items: ["Decks", "Gallery", "Chat"] }}\n  mainArea={{ label: "Main area", subtitle: "The active module renders here" }}\n/>',
    previewCode: '<Slide theme="dark">\n  <AppShellDiagram title="Host app" topBar={{ label: "Top bar", items: ["Search"] }} sidebar={{ label: "Modules", items: ["Decks", "Gallery"] }} mainArea={{ label: "Main area" }} />\n</Slide>',
    keywords: ['architecture', 'shell', 'diagram', 'layout', 'host', 'sidebar'],
    useCases: ['How a host app frames its modules'],
  },
  toolbar: [{ prop: 'accent', type: 'select', options: ['yellow', 'teal', 'navy', 'red'] }],
})
