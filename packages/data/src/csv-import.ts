/** Strict comma-delimited UTF-8 CSV, including quoted commas/newlines and escaped quotes. */
export function parseCsv(source: string, maximumRows = 500): {
    headers: string[];
    rows: string[][];
} {
    if (source.length > 2 * 1024 * 1024)
        throw new Error('Choose a CSV file up to 2 MB.');
    const text = source.replace(/^\uFEFF/, '');
    const records: string[][] = [];
    let row: string[] = [], value = '', quoted = false, closed = false;
    const pushRow = () => { row.push(value); if (row.some(cell => cell.trim()))
        records.push(row); row = []; value = ''; closed = false; if (records.length > maximumRows + 1)
        throw new Error(maximumRows===500?'Import at most 500 data rows at a time.':'designer.datasetLimit'); };
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    value += '"';
                    i++;
                }
                else {
                    quoted = false;
                    closed = true;
                }
            }
            else
                value += c;
            continue;
        }
        if (c === '"') {
            if (value || closed)
                throw new Error('A quote must start at the beginning of a CSV cell.');
            quoted = true;
        }
        else if (c === ',') {
            row.push(value);
            value = '';
            closed = false;
        }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n')
                i++;
            pushRow();
        }
        else {
            if (closed)
                throw new Error('Unexpected text after a closing quote.');
            value += c;
        }
    }
    if (quoted)
        throw new Error('The CSV contains an unclosed quoted cell.');
    if (value || row.length || closed)
        pushRow();
    if (records.length < 2)
        throw new Error('Include a header and at least one data row.');
    const headers = records.shift()!.map(cell => cell.trim());
    if (headers.length > 80 || headers.some(header => !header) || new Set(headers.map(header => header.toLowerCase())).size !== headers.length)
        throw new Error('Use 1–80 unique, non-empty column headers.');
    for (const [index, cells] of records.entries())
        if (cells.length !== headers.length)
            throw new Error(`Data row ${index + 1} has ${cells.length} cells; expected ${headers.length}.`);
    return { headers, rows: records };
}
export function suggestMapping(headers: string[], fields: Array<{
    id: string;
    label: string;
}>): Record<string, string> {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return Object.fromEntries(fields.map(field => [field.id, String(headers.findIndex(header => normalize(header) === normalize(field.id) || normalize(header) === normalize(field.label)))]).filter(([, index]) => index !== '-1'));
}
export function mapImportRows(rows: string[][], mapping: Record<string, string>): Array<Record<string, string>> {
    const entries = Object.entries(mapping).filter(([, column]) => column !== '');
    if (new Set(entries.map(([, column]) => column)).size !== entries.length)
        throw new Error('Map each CSV column to at most one application field.');
    return rows.map(row => Object.fromEntries(entries.map(([field, column]) => {
        const index = Number(column);
        if (!Number.isInteger(index) || index < 0 || index >= row.length)
            throw new Error('Invalid column mapping.');
        return [field, row[index]!];
    })));
}
export interface ImportRowResult {
    row: number;
    values: Record<string, unknown>;
    errors: Record<string, string>;
    status: 'pending' | 'invalid' | 'success' | 'failed';
    retryable?: boolean;
    recordId?: string;
}
export interface ImportJob {
    id: string;
    productId: string;
    pageId: string;
    rows: ImportRowResult[];
    confirmed: boolean;
    createdAt: string;
}
export interface ImportAdapter {
    preview(productId: string, pageId: string, rows: Array<Record<string, string>>, id: string): Promise<ImportJob>;
    latest(productId: string, pageId: string): Promise<ImportJob | null>;
    run(id: string, retry?: boolean): Promise<ImportJob>;
}
export class ImportRequestError extends Error {
    constructor(message: string, public status: number, public reference?: string) { super(message); }
}
export function createHttpImportAdapter(request: (path: string, init?: RequestInit) => Promise<Response>): ImportAdapter {
    const call = async (body: object, nullable = false): Promise<ImportJob | null> => {
        const response = await request('/imports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json().catch(() => null);
        if (!response.ok)
            throw new ImportRequestError(data?.error ?? 'Import service is unavailable. Retry to check the result.', response.status, response.headers.get('X-Sentinel-Reference')??undefined);
        const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
        const job = data?.job;
        if (job === null && nullable)
            return null;
        if (!object(job) || typeof job.id !== 'string' || typeof job.productId !== 'string' || typeof job.pageId !== 'string' || typeof job.confirmed !== 'boolean' || typeof job.createdAt !== 'string' || !Array.isArray(job.rows) || job.rows.some(row => !object(row) || !Number.isInteger(row.row) || !object(row.values) || !object(row.errors) || Object.values(row.errors).some(error => typeof error !== 'string') || !['pending', 'invalid', 'success', 'failed'].includes(String(row.status))))
            throw new Error('Invalid import service response.');
        return data.job;
    };
    return { preview: async (productId, pageId, rows, id) => (await call({ action: 'preview', productId, pageId, rows, id }))!, latest: (productId, pageId) => call({ action: 'latest', productId, pageId }, true), run: async (id, retry = false) => (await call({ action: 'run', id, retry }))! };
}
