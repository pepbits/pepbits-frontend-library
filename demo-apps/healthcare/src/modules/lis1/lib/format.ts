export const minutesLabel = (m?: number | null) => {
  if (m == null) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 48) return r ? `${h} h ${r} min` : `${h} h`;
  return `${Math.round(h / 24)} d`;
};
export const dueIn = (due?: string | null) => {
  if (!due) return { text: '—', overdue: false };
  const diff = Math.round((new Date(due).getTime() - Date.now()) / 60000);
  if (diff < 0) return { text: `${minutesLabel(-diff)} overdue`, overdue: true };
  return { text: `due in ${minutesLabel(diff)}`, overdue: false };
};
export const titleCase = (s?: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '');
export const cls = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
