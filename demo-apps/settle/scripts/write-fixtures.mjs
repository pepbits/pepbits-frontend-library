// Captures frozen unit-test fixtures from the unchanged Settle backend.
// Usage (under the shared heavy-check lock): node demo-apps/settle/scripts/write-fixtures.mjs
// Starts source/settle/backend on a free loopback port with temporary SQLite storage,
// reads the GET contracts the app uses and writes src/test/fixtures.json. Stops the API on exit.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const backend = join(root, 'source/settle/backend');
const data = mkdtempSync(join(tmpdir(), 'settle-fixtures-'));
const port = await new Promise(resolve => {const s = createServer(); s.listen(0, '127.0.0.1', () => {const p = s.address().port; s.close(() => resolve(p));});});
const api = spawn(process.execPath, ['src/server.js'], {cwd: backend, env: {...process.env, PORT: String(port), SETTLE_DATA_DIR: data}, stdio: ['ignore', 'pipe', 'pipe'], detached: true});
const stop = () => {try {process.kill(-api.pid, 'SIGTERM');} catch {} };
process.once('exit', () => {stop(); rmSync(data, {recursive: true, force: true});});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => process.exit(1));
const base = `http://127.0.0.1:${port}/api`;
for (let i = 0; ; i++) {try {if ((await fetch(base + '/health')).ok) break;} catch {} if (i > 60) throw new Error('Settle API did not start'); await new Promise(r => setTimeout(r, 500));}
const get = async (path, user = 1) => {const r = await fetch(base + path, {headers: {'x-user-id': String(user)}}); if (!r.ok) throw new Error(path + ' ' + r.status); return r.json();};
const out = {};
const put = async (key, path, user) => {out[key] = await get(path, user);};
await put('/meta', '/meta');
await put('/meta#cashier', '/meta', 3);
await put('/meta#finance', '/meta', 4);
await put('/dashboard', '/dashboard');
await put('/bills', '/bills?size=30');
for (const no of ['BL002001', 'BN001002']) await put('/bills/' + no, '/bills/' + no);
await put('/catalogue', '/catalogue?q=');
await put('/patients', '/patients');
await put('/patients/MR240107', '/patients/MR240107');
await put('/patients/MR240107/visits', '/patients/MR240107/visits');
await put('/receipts', '/receipts?size=50');
const firstReceipt = out['/receipts'].rows.find(r => r.kind === 'bill');
await put('/receipts/:no', '/receipts/' + firstReceipt.no);
await put('/deposits/unrealized', '/deposits/unrealized');
await put('/approvals', '/approvals?status=pending');
await put('/daybook', '/daybook');
for (const key of ['collections', 'payment-consolidated', 'patient-dues', 'sponsor-dues', 'outstanding-deposits', 'reward-points', 'finance-postings']) await put('/reports/' + key, '/reports/' + key);
await put('/audit', '/audit?size=60');
for (const section of ['payment-modes', 'counters', 'number-series', 'discount-categories', 'rate-plans', 'users', 'preferences']) await put('/settings/' + section, '/settings/' + section);
await put('/search', '/search?q=BL');
await put('/plans', '/plans');
// Keep the frozen file small: list endpoints keep their first rows only.
if (out['/receipts'].rows.length > 20) out['/receipts'].rows = out['/receipts'].rows.slice(0, 20);
if (out['/audit'].rows.length > 20) out['/audit'].rows = out['/audit'].rows.slice(0, 20);
writeFileSync(new URL('../src/test/fixtures.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(JSON.stringify({captured: Object.keys(out).length, port}));
stop();
process.exit(0);
