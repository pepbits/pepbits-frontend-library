// Reusable server-side RCM money adapter over the dedicated synthetic payment/refund
// simulator (mockpay `/v1/payments`, `/v1/refunds`) and the standalone inbound
// collection-intent simulator (mockpay.collection_mock `/v1/collection-intents`).
// Real HTTP only: every method performs an actual loopback request and normalizes the
// simulator's own response; there is no client-marked success and no local simulation.
// Durable idempotency/pending-state ownership belongs to the calling RCM engine — this
// adapter only forwards the caller's Idempotency-Key and reports what the provider said.
import {createHash} from 'node:crypto';

const MAX_RESPONSE_BYTES = 128 * 1024;
const ALLOWED_ORIGIN_HOSTS = new Set(['127.0.0.1', '[::1]']);
const ID_RE = /^[A-Za-z0-9_]{1,64}$/;
const SCOPE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const REFERENCE_MAX = 200;
const IDEMPOTENCY_KEY_MAX = 255;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;

// collect() has no `method` argument in its contract (the engine does not track tender
// type); every collection intent this adapter opens is tagged with this fixed,
// upper-snake-case code so the simulator's required `method` field is always satisfied.
const COLLECTION_METHOD = 'RCM_PROVIDER_COLLECTION';

const REFUND_SCENARIOS = new Set(['success', 'pending', 'decline', 'timeout_after_accept']);
const REFUND_STATUSES = new Set(['pending', 'succeeded', 'failed']);
const COLLECTION_SCENARIOS = new Set(['success', 'decline', 'pending', 'timeout_after_accept', 'partial', 'expired']);
const COLLECTION_STATUSES = new Set(['pending', 'captured', 'declined', 'expired']);

export class RcmMoneyProviderError extends Error {
 constructor(message, {code, httpStatus, providerMessage, cause} = {}) {
  super(message, cause !== undefined ? {cause} : undefined);
  this.name = 'RcmMoneyProviderError';
  this.code = code;
  if (httpStatus !== undefined) this.httpStatus = httpStatus;
  if (providerMessage !== undefined) this.providerMessage = providerMessage;
 }
}

function fail(code, message, extra) {
 throw new RcmMoneyProviderError(message, {code, ...extra});
}

function isSafeInt(value) {
 return typeof value === 'number' && Number.isSafeInteger(value);
}

function requirePositiveMinor(value, label) {
 if (!isSafeInt(value) || value <= 0) fail('invalid_amount', `${label} must be a positive safe integer minor-unit amount`);
 return value;
}

function requireCurrency(value, label = 'currency') {
 if (typeof value !== 'string' || !CURRENCY_RE.test(value)) fail('invalid_currency', `${label} must be 3 uppercase letters`);
 return value;
}

function requireId(value, label) {
 if (typeof value !== 'string' || !ID_RE.test(value)) fail('invalid_id', `${label} must be a valid provider identifier`);
 return value;
}

function requireScope(scope) {
 if (!scope || typeof scope !== 'object') fail('invalid_scope', 'scope is required');
 const {tenantId, merchantId} = scope;
 if (typeof tenantId !== 'string' || !SCOPE_RE.test(tenantId)) fail('invalid_scope', 'scope.tenantId is invalid');
 if (typeof merchantId !== 'string' || !SCOPE_RE.test(merchantId)) fail('invalid_scope', 'scope.merchantId is invalid');
 return {tenantId, merchantId};
}

function requireIdempotencyKey(key) {
 if (typeof key !== 'string' || !key) fail('invalid_idempotency_key', 'key is required');
 if (key.length > IDEMPOTENCY_KEY_MAX) fail('invalid_idempotency_key', 'key must be at most 255 characters');
 for (let i = 0; i < key.length; i++) {
  const c = key.charCodeAt(i);
  if (c < 0x20 || c > 0x7e) fail('invalid_idempotency_key', 'key must be printable ASCII');
 }
 return key;
}

function requireReference(value) {
 if (value === undefined || value === null) return undefined;
 if (typeof value !== 'string' || !value || value.length > REFERENCE_MAX) fail('invalid_reference', 'reference must be a non-empty string of at most 200 characters');
 return value;
}

function requireScenario(value, allowed, label) {
 if (value === undefined) return 'success';
 if (typeof value !== 'string' || !allowed.has(value)) fail('invalid_scenario', `${label} scenario is not a known synthetic scenario`);
 return value;
}

function mismatch(what) {
 fail('response_mismatch', `RCM provider response ${what} did not match the request`);
}

function malformedStatus(op) {
 fail('malformed_response', `RCM provider returned a malformed status for ${op}`);
}

function providerRejected(op, httpStatus, body) {
 const providerCode = body?.error?.code ?? 'unknown';
 const providerMessage = body?.error?.message;
 fail('provider_rejected', `RCM ${op} was refused by the provider (${providerCode})`, {httpStatus, providerMessage});
}

function validateServiceConfig(config, label) {
 if (!config || typeof config !== 'object') fail('invalid_config', `${label} provider configuration is required`);
 if (typeof config.apiKey !== 'string' || !config.apiKey.trim()) fail('invalid_config', `${label}.apiKey must be a non-empty string`);
 let url;
 try {
  url = new URL(config.origin);
 } catch {
  fail('invalid_config', `${label}.origin must be a valid URL`);
 }
 if (
  url.protocol !== 'http:' ||
  !ALLOWED_ORIGIN_HOSTS.has(url.hostname) ||
  url.username ||
  url.password ||
  url.pathname !== '/' ||
  url.search ||
  url.hash
 ) fail('invalid_config', `${label}.origin must be an exact loopback HTTP origin with no path, query or credentials`);
 return {origin: url.origin, apiKey: config.apiKey};
}

async function readBounded(body) {
 if (!body) return Buffer.alloc(0);
 const reader = body.getReader();
 let total = 0;
 const chunks = [];
 while (true) {
  const {value, done} = await reader.read();
  if (done) break;
  total += value.length;
  if (total > MAX_RESPONSE_BYTES) {
   await reader.cancel();
   fail('invalid_response', 'RCM provider response exceeded the 128KB limit');
  }
  chunks.push(value);
 }
 return Buffer.concat(chunks);
}

// Creates the adapter. `options.payments` targets the mockpay refund/payment service
// (`/v1/payments`, `/v1/refunds`); `options.collections` targets the standalone
// collection-intent service (`/v1/collection-intents`). Each is
// `{origin, apiKey}` where `origin` is an exact loopback HTTP origin (e.g.
// `http://127.0.0.1:18765`) — matching the simulators' own loopback-only binding.
export function createRcmMoneyProvider(options = {}) {
 const paymentsConfig = validateServiceConfig(options.payments, 'payments');
 const collectionsConfig = validateServiceConfig(options.collections, 'collections');
 const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
 if (!isSafeInt(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) fail('invalid_config', `timeoutMs must be a positive integer of at most ${MAX_TIMEOUT_MS}`);
 const fetchImpl = options.fetch ?? fetch;

 async function call(config, path, {method, scope, idempotencyKey, body}) {
  const target = new URL(path, config.origin);
  const headers = {
   Authorization: `Bearer ${config.apiKey}`,
   'X-Tenant-ID': scope.tenantId,
   'X-Merchant-ID': scope.merchantId,
  };
  let payload;
  if (body !== undefined) {
   headers['Content-Type'] = 'application/json';
   payload = JSON.stringify(body);
  }
  if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;
  let response;
  try {
   response = await fetchImpl(target, {
    method,
    headers,
    body: payload,
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
   });
  } catch (cause) {
   // Transport failure (network error, timeout, rejected redirect): surfaced as-is.
   // No automatic replay here — retry/idempotency policy belongs to the RCM engine.
   throw new RcmMoneyProviderError('RCM money provider request failed in transport', {code: 'transport_error', cause});
  }
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) fail('invalid_response', 'RCM provider returned an unexpected content type', {httpStatus: response.status});
  const raw = await readBounded(response.body);
  const digest = createHash('sha256').update(raw).digest('hex');
  let parsed;
  try {
   parsed = raw.length ? JSON.parse(raw.toString('utf8')) : undefined;
  } catch {
   fail('invalid_response', 'RCM provider returned malformed JSON', {httpStatus: response.status});
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('invalid_response', 'RCM provider returned an unexpected payload shape', {httpStatus: response.status});
  return {httpStatus: response.status, body: parsed, digest};
 }

 async function capture({scope, key, amountMinor, currency}) {
  const s = requireScope(scope);
  const idempotencyKey = requireIdempotencyKey(key);
  const amount = requirePositiveMinor(amountMinor, 'amountMinor');
  const cur = requireCurrency(currency);
  const {httpStatus, body, digest} = await call(paymentsConfig, '/v1/payments', {
   method: 'POST', scope: s, idempotencyKey, body: {amount, currency: cur},
  });
  if (httpStatus !== 201) providerRejected('capture', httpStatus, body);
  requireId(body.id, 'payment id');
  if (body.status !== 'captured') malformedStatus('capture');
  if (!isSafeInt(body.amount) || body.amount !== amount) mismatch('amount');
  if (body.currency !== cur) mismatch('currency');
  return {paymentRef: body.id, status: 'captured', amountMinor: body.amount, currency: body.currency, digest};
 }

 async function refund({scope, key, paymentId, amountMinor, scenario}) {
  const s = requireScope(scope);
  const idempotencyKey = requireIdempotencyKey(key);
  const pid = requireId(paymentId, 'paymentId');
  const amount = requirePositiveMinor(amountMinor, 'amountMinor');
  const sc = requireScenario(scenario, REFUND_SCENARIOS, 'refund');
  const {httpStatus, body, digest} = await call(paymentsConfig, '/v1/refunds', {
   method: 'POST', scope: s, idempotencyKey, body: {payment_id: pid, amount, scenario: sc},
  });
  if (httpStatus === 504) {
   // timeout_after_accept: the refund was actually committed provider-side but the
   // response was lost; only the provider reference survives for reconciliation.
   const providerRef = requireId(body?.refund_id, 'refund id');
   return {providerRef, status: 'unknown', amountMinor: amount, currency: undefined, digest};
  }
  if (httpStatus !== 201) providerRejected('refund', httpStatus, body);
  requireId(body.id, 'refund id');
  if (body.payment_id !== pid) mismatch('payment reference');
  if (!isSafeInt(body.amount) || body.amount !== amount) mismatch('amount');
  if (!REFUND_STATUSES.has(body.status)) malformedStatus('refund');
  const cur = requireCurrency(body.currency);
  return {providerRef: body.id, status: body.status, amountMinor: body.amount, currency: cur, digest};
 }

 async function refundStatus({scope, refundId}) {
  const s = requireScope(scope);
  const rid = requireId(refundId, 'refundId');
  const {httpStatus, body, digest} = await call(paymentsConfig, `/v1/refunds/${encodeURIComponent(rid)}`, {method: 'GET', scope: s});
  if (httpStatus === 404) fail('not_found', 'RCM refund was not found in this scope', {httpStatus});
  if (httpStatus !== 200) providerRejected('refundStatus', httpStatus, body);
  if (body.id !== rid) mismatch('refund id');
  if (!REFUND_STATUSES.has(body.status)) malformedStatus('refundStatus');
  const amount = requirePositiveMinor(body.amount, 'refund amount');
  const cur = requireCurrency(body.currency);
  return {providerRef: body.id, status: body.status, amountMinor: amount, currency: cur, digest};
 }

 async function collect({scope, key, amountMinor, currency, reference, scenario}) {
  const s = requireScope(scope);
  const idempotencyKey = requireIdempotencyKey(key);
  const amount = requirePositiveMinor(amountMinor, 'amountMinor');
  const cur = requireCurrency(currency);
  const ref = requireReference(reference);
  const sc = requireScenario(scenario, COLLECTION_SCENARIOS, 'collect');
  const requestBody = {amount, currency: cur, method: COLLECTION_METHOD, scenario: sc};
  if (ref !== undefined) requestBody.correlation_reference = ref;
  const {httpStatus, body, digest} = await call(collectionsConfig, '/v1/collection-intents', {
   method: 'POST', scope: s, idempotencyKey, body: requestBody,
  });
  if (httpStatus === 504) {
   const providerRef = requireId(body?.intent_id, 'collection intent id');
   return {providerRef, status: 'unknown', amountMinor: amount, currency: cur, capturedAmountMinor: null, digest};
  }
  if (httpStatus !== 201) providerRejected('collect', httpStatus, body);
  requireId(body.id, 'collection intent id');
  if (!isSafeInt(body.amount) || body.amount !== amount) mismatch('amount');
  if (body.currency !== cur) mismatch('currency');
  if ((body.correlation_reference ?? undefined) !== ref) mismatch('reference');
  if (!COLLECTION_STATUSES.has(body.status)) malformedStatus('collect');
  const capturedAmountMinor = normalizeCapturedAmount(body.captured_amount, body.amount);
  if (body.status === 'captured' && capturedAmountMinor === null) fail('malformed_response', 'Captured collection requires an explicit captured amount');
  return {providerRef: body.id, status: body.status, amountMinor: body.amount, currency: body.currency, capturedAmountMinor, digest};
 }

 async function collectionStatus({scope, intentId}) {
  const s = requireScope(scope);
  const iid = requireId(intentId, 'intentId');
  const {httpStatus, body, digest} = await call(collectionsConfig, `/v1/collection-intents/${encodeURIComponent(iid)}`, {method: 'GET', scope: s});
  if (httpStatus === 404) fail('not_found', 'RCM collection intent was not found in this scope', {httpStatus});
  if (httpStatus !== 200) providerRejected('collectionStatus', httpStatus, body);
  if (body.id !== iid) mismatch('collection intent id');
  if (!COLLECTION_STATUSES.has(body.status)) malformedStatus('collectionStatus');
  const amount = requirePositiveMinor(body.amount, 'collection amount');
  const cur = requireCurrency(body.currency);
  const capturedAmountMinor = normalizeCapturedAmount(body.captured_amount, amount);
  if (body.status === 'captured' && capturedAmountMinor === null) fail('malformed_response', 'Captured collection requires an explicit captured amount');
  return {providerRef: body.id, status: body.status, amountMinor: amount, currency: cur, capturedAmountMinor, digest};
 }

 function normalizeCapturedAmount(value, amount) {
  if (value === null || value === undefined) return null;
  if (!isSafeInt(value) || value <= 0 || value > amount) mismatch('captured amount');
  return value;
 }

 return {capture, refund, refundStatus, collect, collectionStatus};
}
