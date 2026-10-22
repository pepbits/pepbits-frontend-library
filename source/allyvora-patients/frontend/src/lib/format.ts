const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' }) : null;

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (!rtf) return new Date(iso).toLocaleString();
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return dateTime(iso, { time: false });
}

export function dateTime(iso: string, opts: { time?: boolean } = {}): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(opts.time === false ? {} : { hour: '2-digit', minute: '2-digit' }),
  });
}

export function clock(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function initials(name: string): string {
  const parts = name.replace(/^(Mr|Mrs|Ms|Miss|Master|Baby|Dr|Prof|Rev|Sr)\s+/i, '').split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts.length > 1 ? parts[parts.length - 1]![0]!.toUpperCase() : '');
}

export const SEX_SHORT: Record<string, string> = { male: 'M', female: 'F', other: 'O', unknown: 'U' };
