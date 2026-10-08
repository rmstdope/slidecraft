/** Small stroke icons for the tool UI (24×24, currentColor). */
const icon = (d: string) =>
  function Icon({ size = 16 }: { size?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    )
  }

export const EditIcon = icon('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z')
export const ChatIcon = icon('M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z')
export const PlusIcon = icon('M12 5v14M5 12h14')
export const AlertIcon = icon('M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z')
export const PlayIcon = icon('M6 4l14 8-14 8Z')
