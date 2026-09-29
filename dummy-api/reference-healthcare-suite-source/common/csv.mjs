// Adapted from healthcare-suite/backend/src/common/csv.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
export function parseCsv(input) {
    const text = input.replace(/^\uFEFF/, '');
    const out = [];
    let row = [];
    let field = '';
    let quoted = false;
    for(let i = 0; i < text.length; i++){
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else quoted = false;
            } else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            out.push(row);
            row = [];
            field = '';
        } else field += c;
    }
    if (field !== '' || row.length) {
        row.push(field);
        out.push(row);
    }
    return out.filter((r)=>!(r.length === 1 && r[0] === ''));
}
export function toCsvCell(v) {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
