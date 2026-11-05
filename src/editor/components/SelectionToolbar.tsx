import type { SelectionInfo } from './SlideEditor'

const COLOURS = ['yellow', 'red', 'teal', 'navy'] as const

/** Wrap the selected text in an Accent (Part 3 §2.11). */
export function SelectionToolbar({ selection, onWrap }: { selection: SelectionInfo; onWrap(color: string): void }) {
  return (
    <div
      className="sc-app tw:fixed tw:z-40 tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-primary tw:py-1 tw:pr-1.5 tw:pl-2.5 tw:text-[12px] tw:text-on-primary tw:shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
      style={{ top: selection.position.top - 40, left: selection.position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="tw:mr-0.5 tw:opacity-70">Accent</span>
      {COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          className={`accent-${c} tw:size-5 tw:rounded-full tw:bg-(--accent) tw:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] tw:transition-transform tw:duration-150 tw:hover:scale-110`}
          title={c}
          aria-label={`Accent ${c}`}
          onClick={() => onWrap(c)}
        />
      ))}
    </div>
  )
}
