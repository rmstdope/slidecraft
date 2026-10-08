import type { SelectionInfo } from './SlideEditor'

const COLOURS = ['yellow', 'red', 'teal', 'navy'] as const

/** Wrap the selected text in an Accent (Part 3 §2.11). */
export function SelectionToolbar({ selection, onWrap }: { selection: SelectionInfo; onWrap(color: string): void }) {
  return (
    <div className="selection-toolbar" style={{ top: selection.position.top - 40, left: selection.position.left }} onMouseDown={(e) => e.preventDefault()}>
      <span>Accent</span>
      {COLOURS.map((c) => (
        <button key={c} type="button" className={`selection-toolbar__dot accent-${c}`} title={c} aria-label={`Accent ${c}`} onClick={() => onWrap(c)} />
      ))}
    </div>
  )
}
