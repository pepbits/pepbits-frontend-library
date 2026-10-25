import clsx from 'clsx';

/** Settle brand mark: a balanced ledger line — two strokes meeting at zero. Fixed brand colours. */
export function Mark({className}: {className?: string}) {
  return (
    <svg viewBox="0 0 32 32" className={clsx('h-8 w-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0F6B5E" />
      <path d="M8 12h16" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 20h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
      <circle cx="23" cy="20" r="2.6" fill="#E9A100" />
    </svg>
  );
}
