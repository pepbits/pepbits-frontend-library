import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

/** Runs solely from the packaged runtime with fresh data and no workspace module resolution. */
export async function withAllyVoraBackend(directory, verify) {
  const probe = createServer();
  await new Promise((resolve, reject) => {probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve);});
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const data = await mkdtemp(join(tmpdir(), 'pepbits-packaged-allyvora-'));
  const child = spawn(process.execPath, ['dist/server.js'], {cwd: directory, detached: true,
    env: {PATH: process.env.PATH, NODE_ENV: 'production', NODE_PATH: '', NODE_OPTIONS: '', PORT: String(port), DB_PATH: join(data, 'patients.db'), SEED_DEMO: 'true'}, stdio: ['ignore', 'ignore', 'pipe']});
  child.stderr.resume();
  const closed = new Promise(resolve => {child.once('error', resolve); child.once('exit', resolve);});
  const kill = signal => {try {process.kill(-child.pid, signal);} catch {}};
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 120; i++) {
      if (child.exitCode !== null) throw Error('Packaged AllyVora backend exited before readiness');
      let ready = false;
      try {const response = await fetch(base + '/api/health', {signal: AbortSignal.timeout(1000)}); ready = response.ok && (await response.json()).status === 'ok';} catch {}
      if (ready) {await verify(base); return;}
      await delay(250);
    }
    throw Error('Packaged AllyVora backend readiness timeout');
  } finally {
    kill('SIGTERM'); const timer = setTimeout(() => kill('SIGKILL'), 3000);
    await closed; clearTimeout(timer); kill('SIGKILL'); await rm(data, {recursive: true, force: true});
  }
}

/** Real HTTP writes through the packaged Next proxy, with fictional data and source validation. */
export async function smokeAllyVoraProxy(base) {
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(base + '/allyvora-api' + path, {method, headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000)});
    const payload = await response.json();
    assert.ok(response.ok, `Packaged AllyVora ${method} ${path}: ${response.status}; fields: ${Object.keys(payload.errors ?? {}).join(', ')}`);
    return payload;
  };
  assert.equal((await request('/health')).status, 'ok');
  const list = await request('/patients?pageSize=1');
  assert.ok(list.items.length);
  const sample = await request('/patients/' + list.items[0].id);
  assert.ok(sample.data && sample.version);
  const session = await request('/session'), lookups = await request('/lookups');
  // An explicit valid fictional registration, independent of incomplete seeded records.
  const created = await request('/patients', 'POST', {values: {
    branchId: session.defaultBranchId, patientCategory: 'general', identityAvailability: 'known',
    givenName: 'Packaged', familyName: 'Fictional', displayName: 'Packaged Fictional',
    dobPrecision: 'exact', dateOfBirth: '1988-07-14', administrativeSex: 'male', mobile: '9000098765',
    addressType: 'home', pincode: '682020', addressLine1: '7 Fictional Road', city: 'Kadavanthra',
    state: 'KL', country: 'IN', permanentSameAsCurrent: true, payerType: 'self', allergyStatus: 'nka',
    registrationType: 'op', priority: 'routine', department: lookups.department[0].code,
    referralSource: 'walkin', paymentMode: 'cash', consentTreatment: true, consentGivenBy: 'patient',
    consentDate: new Date().toISOString().slice(0, 10), consentCapture: 'paper', paperFormRef: 'PKG-001',
  }});
  assert.ok(created.id && created.mrn);
  const viewed = await request('/patients/' + created.id);
  const edited = await request('/patients/' + created.id, 'PUT', {version: viewed.version, values: {...viewed.data, email: 'packaged@example.test'}});
  assert.equal(edited.data.email, 'packaged@example.test');
  assert.equal((await request(`/patients/${created.id}/status`, 'PATCH', {status: 'inactive'})).status, 'inactive');
  assert.ok((await request(`/patients/${created.id}/audit`)).length >= 3);
  const settings = await request('/settings/layout');
  assert.equal((await request('/settings/layout', 'PUT', {...settings, layout: 'tabs'})).layout, 'tabs');
  assert.ok((await request('/settings/layout/history')).length);
  await request('/settings/layout', 'PUT', settings);
  console.log('  packaged AllyVora proxy: register, create, view, edit, status, audit and layout passed');
}
