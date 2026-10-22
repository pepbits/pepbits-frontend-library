const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const money = (n: number | null | undefined, opts: { sign?: boolean; whole?: boolean } = {}) => {
  const v = Number(n || 0);
  const abs = (opts.whole ? inr0 : inr).format(Math.abs(v));
  const sign = v < 0 ? '−' : opts.sign && v > 0 ? '+' : '';
  return `${sign}₹${abs}`;
};
export const num = (n: number) => inr0.format(n);
export const isZero = (n: number) => Math.abs(n) < 0.005;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const dtf = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const df = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const tf = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
export const dateTime = (s?: string | null) => (s ? dtf.format(new Date(s)) : '—');
export const date = (s?: string | null) => (s ? df.format(new Date(s)) : '—');
export const time = (s?: string | null) => (s ? tf.format(new Date(s)) : '—');
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const daysAgoISO = (n: number) => {
  const d = new Date(Date.now() - n * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const relative = (s?: string | null) => {
  if (!s) return '—';
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return date(s);
};
export const age = (dob?: string | null) => {
  if (!dob) return null;
  const d = new Date(dob);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a;
};

export const STATUS = {
  A: { label: 'Open', tone: 'sky' },
  F: { label: 'Finalized', tone: 'indigo' },
  C: { label: 'Closed', tone: 'pine' },
  X: { label: 'Cancelled', tone: 'rose' },
} as const;

export const billTypeLabel = (t: 'P' | 'C') => (t === 'P' ? 'Bill Now' : 'Bill Later');
export const restrictionLabel = (r: string) => ({ N: 'Hospital', P: 'Pharmacy', T: 'Test' }[r] || r);
export const availabilityLabel = (a: string) => ({ H: 'Hospital', P: 'Pharmacy', B: 'Hospital & pharmacy' }[a] || a);
export const claimStatusLabel = (s: string) => ({ O: 'Not sent', S: 'Sent', R: 'Received' }[s] || s);
export const roleLabel = (r: string) => ({ admin: 'Administrator', billing: 'Billing executive', cashier: 'Cashier', finance: 'Finance manager' }[r] || r);
export const kindLabel = (k: string) => ({ discount: 'Discount', writeoff: 'Write-off', cancellation: 'Bill cancellation' }[k] || k);

export const GROUP_LABEL: Record<string, string> = {
  REG: 'Registration', DOC: 'Consultation', DIA: 'Diagnostics', BED: 'Room', ICU: 'ICU', OPE: 'Surgery', MED: 'Medicines', ITE: 'Consumables',
  OTC: 'Other', SNP: 'Nursing', DIE: 'Diet', ROF: 'Round-off', PKG: 'Package',
};

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
