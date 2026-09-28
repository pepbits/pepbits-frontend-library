/** Keystone mark: the wedge at the top of an arch that holds the rest in place. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M9.5 9h13l-3 14h-7z" fill="var(--rail)" />
      <path d="M5 25.5c2.2-1.6 4.4-2.4 7-2.5M27 25.5c-2.2-1.6-4.4-2.4-7-2.5" stroke="var(--rail)" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
