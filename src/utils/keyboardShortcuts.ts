import { isMac } from './environment'

/** The single source of truth for the shortcuts modal and help panel (Part 3 §1.9). */
export type AppMode = 'home' | 'presentation' | 'miniature' | 'dev' | 'editor'

export interface Shortcut {
  keys: string[]
  action: string
  category?: string
}

const GLOBAL: Shortcut[] = [
  { keys: ['Cmd', 'K'], action: 'Open command palette', category: 'General' },
  { keys: ['?'], action: 'Show keyboard shortcuts', category: 'General' },
]

const PRESENTING: Shortcut[] = [
  { keys: ['→'], action: 'Next step or slide', category: 'Navigation' },
  { keys: ['Space'], action: 'Next step or slide', category: 'Navigation' },
  { keys: ['←'], action: 'Previous step or slide', category: 'Navigation' },
  { keys: ['↓'], action: 'Next slide, skipping remaining steps', category: 'Navigation' },
  { keys: ['↑'], action: 'Previous slide', category: 'Navigation' },
  { keys: ['Home'], action: 'First slide', category: 'Navigation' },
  { keys: ['End'], action: 'Last slide', category: 'Navigation' },
  { keys: ['Click'], action: 'Next step or slide', category: 'Navigation' },
  { keys: ['Right click'], action: 'Previous step or slide', category: 'Navigation' },
  { keys: ['M'], action: 'Slide overview', category: 'Views' },
  { keys: ['Tab'], action: 'Slide overview', category: 'Views' },
  { keys: ['D'], action: 'Toggle dev mode', category: 'Views' },
  { keys: ['P'], action: 'Open presenter view', category: 'Views' },
  { keys: ['Esc'], action: 'Edit this slide', category: 'Views' },
]

const MODES: Record<AppMode, { label: string; shortcuts: Shortcut[] }> = {
  home: { label: 'Home', shortcuts: [] },
  presentation: {
    label: 'Presentation',
    shortcuts: [...PRESENTING, { keys: ['F'], action: 'Toggle fullscreen', category: 'Views' }],
  },
  miniature: {
    label: 'Overview',
    shortcuts: [
      { keys: ['←', '→'], action: 'Move focus', category: 'Navigation' },
      { keys: ['↑', '↓'], action: 'Move focus by a row', category: 'Navigation' },
      { keys: ['Home'], action: 'Focus first slide', category: 'Navigation' },
      { keys: ['End'], action: 'Focus last slide', category: 'Navigation' },
      { keys: ['Enter'], action: 'Go to focused slide', category: 'Navigation' },
      { keys: ['Tab'], action: 'Toggle large preview', category: 'Views' },
      { keys: ['Esc'], action: 'Close overview', category: 'Views' },
    ],
  },
  dev: {
    label: 'Dev',
    shortcuts: [...PRESENTING, { keys: ['F'], action: 'Switch fit and actual size', category: 'Dev' }],
  },
  editor: {
    label: 'Editor',
    shortcuts: [
      { keys: ['Cmd', 'S'], action: 'Save', category: 'File' },
      { keys: ['Cmd', 'Shift', 'Enter'], action: 'Start presentation', category: 'File' },
      { keys: ['Cmd', 'Z'], action: 'Undo', category: 'Editing' },
      { keys: ['Cmd', 'Shift', 'Z'], action: 'Redo', category: 'Editing' },
      { keys: ['PageUp'], action: 'Previous slide', category: 'Slides' },
      { keys: ['PageDown'], action: 'Next slide', category: 'Slides' },
      { keys: ['↑', '↓'], action: 'Previous or next slide (outside the editor)', category: 'Slides' },
      { keys: ['Alt', '↑'], action: 'Move slide up', category: 'Slides' },
      { keys: ['Alt', '↓'], action: 'Move slide down', category: 'Slides' },
      { keys: ['Esc'], action: 'Leave the text editor', category: 'Editing' },
      { keys: ['Enter'], action: 'Focus the text editor', category: 'Editing' },
    ],
  },
}

export const getModeLabel = (mode: AppMode): string => MODES[mode].label

export const getShortcutsForMode = (mode: AppMode): Shortcut[] => [...GLOBAL, ...MODES[mode].shortcuts]

/** Group by category, preserving first-seen order; uncategorised entries go under "Other". */
export function groupShortcutsByCategory(shortcuts: Shortcut[]): Map<string, Shortcut[]> {
  const groups = new Map<string, Shortcut[]>()
  for (const shortcut of shortcuts) {
    const category = shortcut.category ?? 'Other'
    groups.set(category, [...(groups.get(category) ?? []), shortcut])
  }
  return groups
}

const MAC_KEYS: Record<string, string> = { Cmd: '⌘', Alt: '⌥', Shift: '⇧' }

export function getDisplayKey(key: string, mac = isMac()): string {
  if (mac) return MAC_KEYS[key] ?? key
  return key === 'Cmd' ? 'Ctrl' : key
}
