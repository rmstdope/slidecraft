import { motion } from 'motion/react'
import { useStepMotion } from '../../animations/stepMotion'
import { itemVariants } from '../../animations/variants'
import { accentColors, tint, type AccentColor } from './accents'
import { useAsset } from './deckContext'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface PersonCardProps {
  image?: string
  name: string
  role?: string
  team?: string
  email?: string
  /** object-position inside the circle. */
  imagePosition?: string
  /** Photo diameter in px. */
  size?: number
  accent?: AccentColor
  step?: number
  morph?: string
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function PersonCardComponent({ image, name, role, team, email, imagePosition = 'center top', size = 280, accent: accentProp, step, morph }: PersonCardProps) {
  const accent = useAccent(accentProp)
  const color = accentColors[accent]
  const url = useAsset(image)
  const stepMotion = useStepMotion(step, morph)
  const ring = { width: size, height: size, borderRadius: '50%', border: `4px solid ${color}`, boxShadow: `0 0 0 12px ${tint(accent, 0.12)}`, marginBottom: 20 }
  return (
    <motion.div variants={itemVariants} {...stepMotion} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', textAlign: 'center' }}>
      {url ? (
        <img src={url} alt={name} style={{ ...ring, objectFit: 'cover', objectPosition: imagePosition }} />
      ) : (
        <div aria-hidden style={{ ...ring, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tint(accent, 0.18), fontFamily: 'var(--font-display)', fontSize: size * 0.32, color }}>
          {initials(name)}
        </div>
      )}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1.15, color: 'var(--text)' }}>{name}</div>
      {role && <div style={{ fontFamily: 'var(--font-body)', fontSize: 30, color: 'var(--text)' }}>{role}</div>}
      {team && <div style={{ fontFamily: 'var(--font-body)', fontSize: 26, color: 'var(--muted)' }}>{team}</div>}
      {email && <div style={{ fontFamily: 'var(--font-body)', fontSize: 24, color, wordBreak: 'break-word' }}>{email}</div>}
    </motion.div>
  )
}

export const PersonCard = defineComponent<PersonCardProps>({
  Component: PersonCardComponent,
  registry: {
    id: 'person-card',
    name: 'PersonCard',
    category: 'component',
    description: 'A photo in a circle with name, role and contact address.',
    props: [
      { name: 'image', type: 'string', description: 'Imported image or a path relative to the deck folder; initials when omitted' },
      { name: 'name', type: 'string', description: 'Full name' },
      { name: 'role', type: 'string', description: 'Role' },
      { name: 'team', type: 'string', description: 'Team' },
      { name: 'email', type: 'string', description: 'Contact address' },
      { name: 'imagePosition', type: 'string', default: '"center top"', description: 'Which part of the photo stays in the circle' },
      { name: 'size', type: 'number', default: '280', description: 'Photo diameter in px' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
    ],
    snippet: '<PersonCard name="Jane Doe" role="Software Engineer" email="jane.doe@example.com" />',
    previewCode: '<Slide scheme="dark">\n  <PersonCard name="Jane Doe" role="Software Engineer" email="jane.doe@example.com" />\n</Slide>',
    keywords: ['person', 'people', 'contact', 'avatar', 'photo', 'team', 'bio', 'headshot'],
    useCases: ['Who to contact', 'The speaker'],
  },
  toolbar: [
    { prop: 'image', type: 'image' },
    { prop: 'size', type: 'number', min: 160, max: 420, step: 20 },
  ],
})
