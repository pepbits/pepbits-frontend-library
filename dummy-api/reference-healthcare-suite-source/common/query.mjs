// Adapted from healthcare-suite/backend/src/common/query.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import './csv-store.service.mjs';
const RESERVED = new Set([
    'search',
    'page',
    'pageSize',
    'sort',
    'dir'
]);
export function paginate(rows, q, searchFields) {
    let r = rows;
    const s = String(q.search ?? '').trim().toLowerCase();
    if (s) {
        const terms = s.split(/\s+/);
        r = r.filter((x)=>terms.every((t)=>searchFields.some((f)=>String(x[f] ?? '').toLowerCase().includes(t))));
    }
    for (const [k, v] of Object.entries(q)){
        if (RESERVED.has(k) || v === undefined || v === '' || v === 'All') continue;
        const values = String(v).split(',');
        r = r.filter((x)=>k in x && values.includes(String(x[k])));
    }
    if (q.sort) {
        const dir = q.dir === 'desc' ? -1 : 1;
        const key = String(q.sort);
        r = [
            ...r
        ].sort((a, b)=>{
            const av = a[key];
            const bv = b[key];
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
                numeric: true
            }) * dir;
        });
    }
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number(q.pageSize) || 25));
    return {
        data: r.slice((page - 1) * pageSize, page * pageSize),
        total: r.length,
        page,
        pageSize
    };
}
export const round2 = (n)=>Math.round((n + Number.EPSILON) * 100) / 100;
export const todayIso = ()=>{
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const nowIso = ()=>new Date().toISOString();
export const toMinutes = (hhmm)=>{
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
};
export const toHhmm = (min)=>`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const ageFrom = (dob)=>{
    if (!dob) return null;
    const d = new Date(dob);
    const n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || n.getMonth() === d.getMonth() && n.getDate() < d.getDate()) a--;
    return a;
};
export const localDate = (iso)=>{
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
