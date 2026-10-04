/** Pictogrammes des rituels (trait fin, cohérents avec ui/Icon). */
export type RitualGlyphName = 'circle' | 'lantern' | 'carnet';

export function RitualGlyph({ name, size = 30 }: { name: RitualGlyphName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'circle' && (
        <>
          <path d="M9.2 7.6A10 10 0 0 1 22.8 7.6" />
          <path d="M25.6 12.2a10 10 0 0 1-3.3 12.6" />
          <path d="M9.7 24.8A10 10 0 0 1 6.4 12.2" />
          <circle cx="16" cy="5.6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="7" cy="20.2" r="1.5" fill="currentColor" stroke="none" opacity="0.8" />
          <circle cx="25" cy="20.2" r="1.5" fill="currentColor" stroke="none" opacity="0.8" />
          <path d="M16 13.2c-1.2-1.7-4-1-3.6 1.2.3 1.6 2.4 2.9 3.6 3.8 1.2-.9 3.3-2.2 3.6-3.8.4-2.2-2.4-2.9-3.6-1.2Z" />
        </>
      )}
      {name === 'lantern' && (
        <>
          <path d="M16 3v4" />
          <path d="M13 7h6M13.4 25h5.2" />
          <path d="M16 7c5.2 0 7.4 3.6 7.4 9s-2.2 9-7.4 9-7.4-3.6-7.4-9 2.2-9 7.4-9Z" />
          <path d="M9.3 12.6c4.4 1 9 1 13.4 0M8.7 16.2c4.8 1 9.8 1 14.6 0M9.3 19.8c4.4 1 9 1 13.4 0" opacity="0.55" />
          <path d="M16 25v4" />
        </>
      )}
      {name === 'carnet' && (
        <>
          <path d="M16 8.5c-2.6-1.8-6.2-2.3-10-1.8v17c3.8-.5 7.4 0 10 1.8 2.6-1.8 6.2-2.3 10-1.8v-17c-3.8-.5-7.4 0-10 1.8Z" />
          <path d="M16 8.5v17" />
          <path d="M19.4 18.6c.4-3.4 2.4-5.4 4-5.8-.2 3.2-1.6 5.4-4 5.8Zm0 0 2.2-3" />
          <path d="M9 12.5c1.6-.2 3.2 0 4.6.6M9 16c1.6-.2 3.2 0 4.6.6" opacity="0.55" />
        </>
      )}
    </svg>
  );
}
