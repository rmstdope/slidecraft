import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { sanitizeReaderNotes, stripLeadingTimingNotation } from '../src/components/presentation/readerNotes'

describe('reader notes (Part 1 §11.2)', () => {
  test('strips a leading timing range in its common spellings', () => {
    expect(stripLeadingTimingNotation('0:30-1:10. This slide builds')).toBe('This slide builds')
    expect(stripLeadingTimingNotation('[0:00-1:30] Open with a question')).toBe('Open with a question')
    expect(stripLeadingTimingNotation('(12:00 – 13:15): Wrap up')).toBe('Wrap up')
    expect(stripLeadingTimingNotation('8:40—9:00; Frames')).toBe('Frames')
  })

  test('leaves notes without a leading range alone', () => {
    expect(stripLeadingTimingNotation('Mention 0:30-1:10 later')).toBe('Mention 0:30-1:10 later')
    expect(stripLeadingTimingNotation('10:30 is the start time')).toBe('10:30 is the start time')
  })

  test('only the first non-empty text node in the tree changes', () => {
    const notes = (
      <>
        {' '}
        <p>
          <strong>0:30-1:10.</strong> Keep 1:00-2:00 here.
        </p>
        <p>2:00-3:00 stays too.</p>
      </>
    )
    expect(renderToStaticMarkup(<>{sanitizeReaderNotes(notes)}</>)).toBe(' <p><strong></strong> Keep 1:00-2:00 here.</p><p>2:00-3:00 stays too.</p>')
  })
})
