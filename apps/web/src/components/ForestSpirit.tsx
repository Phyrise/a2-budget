/** Petit esprit décoratif : aucune interaction, aucun mouvement permanent. */
export function ForestSpirit({ className = '' }: { className?: string }) {
  return (
    <svg className={`forest-spirit ${className}`} viewBox="0 0 54 76" fill="none" aria-hidden="true" focusable="false">
      <path d="M19 42c-5 6-5 17-6 22l-7 7c-2 3 1 5 5 4l12-6 5 1 12 5c4 1 7-2 4-5l-7-7c0-9-1-17-5-22Z" fill="#F6F7E9" stroke="#5B7161" strokeOpacity=".24" strokeWidth="1.5" />
      <path d="M6 26C3 11 12 3 26 4c15-2 25 7 23 22-1 14-10 22-23 21C13 48 7 39 6 26Z" fill="#FBFBED" stroke="#5B7161" strokeOpacity=".24" strokeWidth="1.5" />
      <ellipse cx="19" cy="22" rx="4" ry="5" fill="#3D5145" />
      <ellipse cx="35" cy="20" rx="3.5" ry="4.5" fill="#3D5145" />
      <ellipse cx="27" cy="33" rx="3" ry="3.5" fill="#3D5145" />
      <path d="m17 49-8 7m26-7 7 7" stroke="#F6F7E9" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
