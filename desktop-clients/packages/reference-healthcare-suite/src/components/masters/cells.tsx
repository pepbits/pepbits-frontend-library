import { Check, Minus } from 'lucide-react';
import { useFormat } from '../../lib/format';
import { ColumnDef } from '../../lib/masters';
import { Row } from '../../lib/types';
import { Badge, StatusBadge } from '../ui/display';

export function RenderCell({c, r}: {c: ColumnDef; r: Row}) {
  const { fmtDate, fmtTime, money, number } = useFormat();
  const v = r[c.key];
  if(['startTime','endTime'].includes(c.key))return <span className="hc-num">{fmtTime(v)}</span>;
  switch (c.kind) {
    case 'status': return <StatusBadge status={v} />;
    case 'badge': return v ? <Badge>{v}</Badge> : null;
    case 'code': return <span className="font-mono text-[12px] text-hc-ink-soft">{v}</span>;
    case 'money': return <span className="hc-num">{money(v)}</span>;
    case 'number': return <span className="hc-num">{number(Number(v))}</span>;
    case 'percent': return <span className="hc-num">{v}%</span>;
    case 'date': return <span className="hc-num whitespace-nowrap">{fmtDate(v)}</span>;
    case 'bool': return v ? <Check className="h-4 w-4 text-hc-ok-600" aria-label="Yes" /> : <Minus className="h-4 w-4 text-hc-ink-faint" aria-label="No" />;
    default: return <span className={c.key === 'name' ? 'font-medium text-hc-ink' : undefined}>{v}</span>;
  }
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (x: unknown) => { const s = String(x ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
