// Exercises the RCM money adapter against the ACTUAL Python mock services over real
// loopback HTTP: `python3 -m mockpay` (payments/refunds) and
// `python3 -m mockpay.collection_mock` (collection intents), each started fresh per
// test with a disposable SQLite file under /tmp and torn down afterward. No global
// mock-services configuration is touched. All data is synthetic (SIMULATED — NO MONEY
// MOVED); nothing here is production credentials or a real provider.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as createNetServer} from 'node:net';
import {createServer as createHttpServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {createRcmMoneyProvider, RcmMoneyProviderError} from './healthcare-suite-rcm-money-provider.mjs';

const MOCK_SERVICES_ROOT = process.env.HC_RCM_MOCK_REPO ?? new URL('../../../tools/pepbits-mock-services',import.meta.url).pathname;

async function freePort() {
 const socket = createNetServer();
 await new Promise(r => socket.listen(0, '127.0.0.1', r));
 const port = socket.address().port;
 await new Promise(r => socket.close(r));
 return port;
}

async function waitReady(baseUrl, child, label) {
 for (let i = 0; i < 200; i++) {
  if (child.exitCode !== null) throw new Error(`${label} exited early with code ${child.exitCode}`);
  try {
   const response = await fetch(baseUrl + '/health');
   if (response.status === 200) return;
  } catch {
   // not listening yet
  }
  await new Promise(r => setTimeout(r, 25));
 }
 throw new Error(`${label} did not become ready`);
}

async function stop(child) {
 if (child && child.exitCode === null) {
  child.kill();
  await new Promise(r => child.once('exit', r));
 }
}

// Starts a private mockpay (payments/refunds) process on an ephemeral loopback port
// with its own disposable SQLite file; returns {baseUrl, apiKey, child}.
async function startPayments(t, dir) {
 const port = await freePort();
 const apiKey = randomBytes(24).toString('hex');
 const child = spawn('python3', ['-m', 'mockpay', '--port', String(port), '--db', join(dir, 'payments.sqlite'), '--quiet'], {
  cwd: MOCK_SERVICES_ROOT,
  env: {...process.env, MOCK_ENV: 'test', MOCK_API_KEY: apiKey, MOCK_WEBHOOK_SECRET: randomBytes(24).toString('hex')},
  stdio: ['ignore', 'pipe', 'pipe'],
 });
 let output = '';
 child.stdout.on('data', x => output += x);
 child.stderr.on('data', x => output += x);
 const baseUrl = `http://127.0.0.1:${port}`;
 t.after(() => stop(child));
 try {
  await waitReady(baseUrl, child, 'mockpay');
 } catch (e) {
  throw new Error(`${e.message}: ${output}`);
 }
 return {baseUrl, apiKey, child};
}

// Starts a private collection-intent process the same way, standalone from mockpay.
async function startCollections(t, dir) {
 const port = await freePort();
 const apiKey = randomBytes(24).toString('hex');
 const child = spawn('python3', ['-m', 'mockpay.collection_mock', '--port', String(port), '--db', join(dir, 'collections.sqlite'), '--quiet'], {
  cwd: MOCK_SERVICES_ROOT,
  env: {...process.env, MOCK_ENV: 'test', MOCK_API_KEY: apiKey, MOCK_WEBHOOK_SECRET: randomBytes(24).toString('hex')},
  stdio: ['ignore', 'pipe', 'pipe'],
 });
 let output = '';
 child.stdout.on('data', x => output += x);
 child.stderr.on('data', x => output += x);
 const baseUrl = `http://127.0.0.1:${port}`;
 t.after(() => stop(child));
 try {
  await waitReady(baseUrl, child, 'mockpay.collection_mock');
 } catch (e) {
  throw new Error(`${e.message}: ${output}`);
 }
 return {baseUrl, apiKey, child};
}

async function startRealProvider(t, {timeoutMs} = {}) {
 const dir = mkdtempSync(join(tmpdir(), 'rcm-money-provider-'));
 t.after(() => rmSync(dir, {recursive: true, force: true}));
 const [payments, collections] = await Promise.all([startPayments(t, dir), startCollections(t, dir)]);
 const provider = createRcmMoneyProvider({
  payments: {origin: payments.baseUrl, apiKey: payments.apiKey},
  collections: {origin: collections.baseUrl, apiKey: collections.apiKey},
  ...(timeoutMs !== undefined ? {timeoutMs} : {}),
 });
 return {provider, payments, collections};
}

let keyCounter = 0;
function nextKey(label) {
 keyCounter += 1;
 return `${label}-${keyCounter}-${randomBytes(4).toString('hex')}`;
}

const SCOPE_A = {tenantId: 'tenant-a', merchantId: 'merchant-a'};
const SCOPE_B = {tenantId: 'tenant-b', merchantId: 'merchant-b'};

test('capture and refund: successful, refused and pending outcomes against the real payment simulator', async t => {
 const {provider} = await startRealProvider(t);

 const captureKey = nextKey('cap');
 const captured = await provider.capture({scope: SCOPE_A, key: captureKey, amountMinor: 5000, currency: 'USD'});
 assert.equal(captured.status, 'captured');
 assert.equal(captured.amountMinor, 5000);
 assert.equal(captured.currency, 'USD');
 assert.match(captured.paymentRef, /^pay_/);
 assert.match(captured.digest, /^[0-9a-f]{64}$/);

 // Idempotent replay of the same key/body must return the same underlying payment.
 const replay = await provider.capture({scope: SCOPE_A, key: captureKey, amountMinor: 5000, currency: 'USD'});
 assert.equal(replay.paymentRef, captured.paymentRef);
 assert.equal(replay.amountMinor, captured.amountMinor);

 const succeeded = await provider.refund({scope: SCOPE_A, key: nextKey('rf'), paymentId: captured.paymentRef, amountMinor: 1500, scenario: 'success'});
 assert.equal(succeeded.status, 'succeeded');
 assert.equal(succeeded.amountMinor, 1500);
 assert.equal(succeeded.currency, 'USD');
 assert.match(succeeded.providerRef, /^re_/);

 const declined = await provider.refund({scope: SCOPE_A, key: nextKey('rf'), paymentId: captured.paymentRef, amountMinor: 500, scenario: 'decline'});
 assert.equal(declined.status, 'failed');

 const pending = await provider.refund({scope: SCOPE_A, key: nextKey('rf'), paymentId: captured.paymentRef, amountMinor: 500, scenario: 'pending'});
 assert.equal(pending.status, 'pending');
 const pendingStatus = await provider.refundStatus({scope: SCOPE_A, refundId: pending.providerRef});
 assert.equal(pendingStatus.status, 'pending');
 assert.equal(pendingStatus.amountMinor, 500);
});

test('refund timeout_after_accept surfaces an unknown outcome that reconciles via refundStatus', async t => {
 const {provider} = await startRealProvider(t);
 const captured = await provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 9000, currency: 'USD'});

 const timedOut = await provider.refund({scope: SCOPE_A, key: nextKey('rf'), paymentId: captured.paymentRef, amountMinor: 4000, scenario: 'timeout_after_accept'});
 assert.equal(timedOut.status, 'unknown');
 assert.match(timedOut.providerRef, /^re_/);
 assert.equal(timedOut.currency, undefined);

 // No client-marked success: only reconciliation via a fresh GET proves the true outcome.
 const reconciled = await provider.refundStatus({scope: SCOPE_A, refundId: timedOut.providerRef});
 assert.equal(reconciled.status, 'succeeded');
 assert.equal(reconciled.amountMinor, 4000);
});

test('collection intents: successful, refused, pending, partial and timeout/reconcile outcomes', async t => {
 const {provider} = await startRealProvider(t);

 const success = await provider.collect({scope: SCOPE_A, key: nextKey('coll'), amountMinor: 2500, currency: 'INR', reference: 'INV-1', scenario: 'success'});
 assert.equal(success.status, 'captured');
 assert.equal(success.capturedAmountMinor, 2500);
 assert.match(success.providerRef, /^coll_/);

 const declined = await provider.collect({scope: SCOPE_A, key: nextKey('coll'), amountMinor: 1000, currency: 'INR', reference: 'INV-2', scenario: 'decline'});
 assert.equal(declined.status, 'declined');
 assert.equal(declined.capturedAmountMinor, null);

 const pending = await provider.collect({scope: SCOPE_A, key: nextKey('coll'), amountMinor: 1200, currency: 'INR', scenario: 'pending'});
 assert.equal(pending.status, 'pending');
 assert.equal((await provider.collectionStatus({scope: SCOPE_A, intentId: pending.providerRef})).status, 'pending');

 const partial = await provider.collect({scope: SCOPE_A, key: nextKey('coll'), amountMinor: 2000, currency: 'INR', scenario: 'partial'});
 assert.equal(partial.status, 'captured');
 assert.equal(partial.capturedAmountMinor, 1000);

 const timedOut = await provider.collect({scope: SCOPE_A, key: nextKey('coll'), amountMinor: 3000, currency: 'INR', scenario: 'timeout_after_accept'});
 assert.equal(timedOut.status, 'unknown');
 assert.match(timedOut.providerRef, /^coll_/);
 assert.equal(timedOut.currency, 'INR');
 const reconciled = await provider.collectionStatus({scope: SCOPE_A, intentId: timedOut.providerRef});
 assert.equal(reconciled.status, 'captured');
 assert.equal(reconciled.capturedAmountMinor, 3000);
});

test('tenant/merchant scope isolation: another scope cannot read or act on a payment, refund or collection intent', async t => {
 const {provider} = await startRealProvider(t);
 const captured = await provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 4000, currency: 'USD'});
 const refunded = await provider.refund({scope: SCOPE_A, key: nextKey('rf'), paymentId: captured.paymentRef, amountMinor: 1000, scenario: 'success'});
 const collected = await provider.collect({scope: SCOPE_A, key: nextKey('coll'), amountMinor: 1000, currency: 'USD', scenario: 'success'});

 await assert.rejects(
  provider.refund({scope: SCOPE_B, key: nextKey('rf'), paymentId: captured.paymentRef, amountMinor: 100, scenario: 'success'}),
  err => err instanceof RcmMoneyProviderError && err.code === 'provider_rejected' && err.httpStatus === 404,
 );
 await assert.rejects(
  provider.refundStatus({scope: SCOPE_B, refundId: refunded.providerRef}),
  err => err instanceof RcmMoneyProviderError && err.code === 'not_found',
 );
 await assert.rejects(
  provider.collectionStatus({scope: SCOPE_B, intentId: collected.providerRef}),
  err => err instanceof RcmMoneyProviderError && err.code === 'not_found',
 );
 // Same scope still resolves normally — isolation is scope-based, not a broken id.
 assert.equal((await provider.refundStatus({scope: SCOPE_A, refundId: refunded.providerRef})).status, 'succeeded');
});

test('client-side validation rejects unsafe/nonpositive amounts, bad currency and bad idempotency keys before any network call', async t => {
 const {provider} = await startRealProvider(t);
 const rejects = (p, code) => assert.rejects(p, err => err instanceof RcmMoneyProviderError && err.code === code);
 await rejects(provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 0, currency: 'USD'}), 'invalid_amount');
 await rejects(provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: -50, currency: 'USD'}), 'invalid_amount');
 await rejects(provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 1.5, currency: 'USD'}), 'invalid_amount');
 await rejects(provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: Number.MAX_SAFE_INTEGER + 2, currency: 'USD'}), 'invalid_amount');
 await rejects(provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 100, currency: 'us dollars'}), 'invalid_currency');
 await rejects(provider.capture({scope: SCOPE_A, key: '', amountMinor: 100, currency: 'USD'}), 'invalid_idempotency_key');
 await rejects(provider.capture({scope: {tenantId: '', merchantId: 'm'}, key: nextKey('cap'), amountMinor: 100, currency: 'USD'}), 'invalid_scope');
 await rejects(provider.collect({scope: SCOPE_A, key: nextKey('coll'), amountMinor: 100, currency: 'USD', scenario: 'not-a-scenario'}), 'invalid_scenario');
});

test('rejects an unconfigured non-loopback or path-bearing origin at construction time', () => {
 assert.throws(
  () => createRcmMoneyProvider({payments: {origin: 'http://example.com', apiKey: 'k'}, collections: {origin: 'http://127.0.0.1:1', apiKey: 'k'}}),
  err => err instanceof RcmMoneyProviderError && err.code === 'invalid_config',
 );
 assert.throws(
  () => createRcmMoneyProvider({payments: {origin: 'http://127.0.0.1:1/base', apiKey: 'k'}, collections: {origin: 'http://127.0.0.1:1', apiKey: 'k'}}),
  err => err instanceof RcmMoneyProviderError && err.code === 'invalid_config',
 );
 assert.throws(
  () => createRcmMoneyProvider({payments: {origin: 'https://127.0.0.1:1', apiKey: 'k'}, collections: {origin: 'http://127.0.0.1:1', apiKey: 'k'}}),
  err => err instanceof RcmMoneyProviderError && err.code === 'invalid_config',
 );
});

// -- bad-response and transport-safety tests against a fake HTTP server -----------------

function buildFakeProvider(t, handler, extraOptions = {}) {
 const server = createHttpServer(handler);
 return new Promise((resolve, reject) => {
  server.listen(0, '127.0.0.1', () => {
   const port = server.address().port;
   t.after(() => new Promise(r => server.close(r)));
   const origin = `http://127.0.0.1:${port}`;
   resolve(createRcmMoneyProvider({
    payments: {origin, apiKey: 'fake-key'},
    collections: {origin, apiKey: 'fake-key'},
    timeoutMs: 2000,
    ...extraOptions,
   }));
  });
  server.on('error', reject);
 });
}

test('rejects a wrong response content type', async t => {
 const provider = await buildFakeProvider(t, (req, res) => {
  res.writeHead(201, {'Content-Type': 'text/plain'});
  res.end('ok');
 });
 await assert.rejects(
  provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 100, currency: 'USD'}),
  err => err instanceof RcmMoneyProviderError && err.code === 'invalid_response',
 );
});

test('rejects an oversized response payload (>128KB)', async t => {
 const provider = await buildFakeProvider(t, (req, res) => {
  res.writeHead(201, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({id: 'pay_' + 'a'.repeat(140 * 1024), amount: 100, currency: 'USD', status: 'captured'}));
 });
 await assert.rejects(
  provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 100, currency: 'USD'}),
  err => err instanceof RcmMoneyProviderError && err.code === 'invalid_response',
 );
});

test('rejects mismatched amount, currency and malformed status in the response', async t => {
 const badAmount = await buildFakeProvider(t, (req, res) => {
  res.writeHead(201, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({id: 'pay_1', amount: 999, currency: 'USD', status: 'captured'}));
 });
 await assert.rejects(
  badAmount.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 100, currency: 'USD'}),
  err => err instanceof RcmMoneyProviderError && err.code === 'response_mismatch',
 );

 const badCurrency = await buildFakeProvider(t, (req, res) => {
  res.writeHead(201, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({id: 'pay_1', amount: 100, currency: 'EUR', status: 'captured'}));
 });
 await assert.rejects(
  badCurrency.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 100, currency: 'USD'}),
  err => err instanceof RcmMoneyProviderError && err.code === 'response_mismatch',
 );

 const badStatus = await buildFakeProvider(t, (req, res) => {
  res.writeHead(201, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({id: 'pay_1', amount: 100, currency: 'USD', status: 'totally-done'}));
 });
 await assert.rejects(
  badStatus.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 100, currency: 'USD'}),
  err => err instanceof RcmMoneyProviderError && err.code === 'malformed_response',
 );

 const badRef = await buildFakeProvider(t, (req, res) => {
  res.writeHead(201, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({id: 'coll_1', amount: 100, currency: 'USD', status: 'captured', captured_amount: 100, correlation_reference: 'OTHER'}));
 });
 await assert.rejects(
  badRef.collect({scope: SCOPE_A, key: nextKey('coll'), amountMinor: 100, currency: 'USD', reference: 'EXPECTED', scenario: 'success'}),
  err => err instanceof RcmMoneyProviderError && err.code === 'response_mismatch',
 );
});

test('does not automatically replay on a transport error', async t => {
 let calls = 0;
 const provider = await buildFakeProvider(t, (req, res) => {
  calls += 1;
  req.socket.destroy();
 });
 await assert.rejects(
  provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 100, currency: 'USD'}),
  err => err instanceof RcmMoneyProviderError && err.code === 'transport_error',
 );
 assert.equal(calls, 1);
});

test('captured collection requires explicit provider captured-amount proof for POST and GET',async t=>{
 const provider=await buildFakeProvider(t,(req,res)=>{res.writeHead(req.method==='POST'?201:200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'coll_missing',amount:100,currency:'USD',status:'captured'}));});
 await assert.rejects(()=>provider.collect({scope:SCOPE_A,key:nextKey('missing-proof'),amountMinor:100,currency:'USD'}),error=>error instanceof RcmMoneyProviderError&&error.code==='malformed_response');
 await assert.rejects(()=>provider.collectionStatus({scope:SCOPE_A,intentId:'coll_missing'}),error=>error instanceof RcmMoneyProviderError&&error.code==='malformed_response');
});

test('does not leak credentials to a redirect target and refuses to follow the redirect', async t => {
 let redirectTargetSawAuth = null;
 const target = createHttpServer((req, res) => {
  redirectTargetSawAuth = req.headers.authorization ?? null;
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({id: 'pay_1', amount: 100, currency: 'USD', status: 'captured'}));
 });
 await new Promise(r => target.listen(0, '127.0.0.1', r));
 const targetPort = target.address().port;
 t.after(() => new Promise(r => target.close(r)));

 const front = createHttpServer((req, res) => {
  res.writeHead(302, {Location: `http://127.0.0.1:${targetPort}/v1/payments`});
  res.end();
 });
 await new Promise(r => front.listen(0, '127.0.0.1', r));
 const frontPort = front.address().port;
 t.after(() => new Promise(r => front.close(r)));

 const provider = createRcmMoneyProvider({
  payments: {origin: `http://127.0.0.1:${frontPort}`, apiKey: 'secret-should-not-leak'},
  collections: {origin: `http://127.0.0.1:${frontPort}`, apiKey: 'secret-should-not-leak'},
  timeoutMs: 2000,
 });

 await assert.rejects(
  provider.capture({scope: SCOPE_A, key: nextKey('cap'), amountMinor: 100, currency: 'USD'}),
  err => {
   assert.ok(err instanceof RcmMoneyProviderError);
   assert.equal(err.code, 'transport_error');
   assert.ok(!String(err.message).includes('secret-should-not-leak'));
   assert.ok(!String(err.stack ?? '').includes('secret-should-not-leak'));
   assert.ok(!String(err.cause?.message ?? '').includes('secret-should-not-leak'));
   return true;
  },
 );
 assert.equal(redirectTargetSawAuth, null);
});
