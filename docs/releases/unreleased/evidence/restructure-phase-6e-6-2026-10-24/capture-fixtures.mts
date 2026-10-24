// One-off fixture capture: runs the unchanged backend's own seed and repositories against a scratch SQLite file (no HTTP server).
import {writeFileSync} from 'node:fs';
const out = process.argv[2]!;
const {migrate} = await import(process.env.BACKEND + '/src/db.ts');
const {seedReferenceData, seedDemoPatients} = await import(process.env.BACKEND + '/src/seed.ts');
migrate(); seedReferenceData(); seedDemoPatients();
const ref = await import(process.env.BACKEND + '/src/repositories/reference.ts');
const patients = await import(process.env.BACKEND + '/src/repositories/patients.ts');
const settings = await import(process.env.BACKEND + '/src/repositories/settings.ts');
const records: Record<string, unknown> = {}, audit: Record<string, unknown> = {};
for (const id of [1, 2, 3, 28]) {records[id] = patients.getPatient(id); audit[id] = patients.patientAudit(id);}
const data = {session: ref.getSession(), lookups: ref.getLookups(), settings: settings.getLayoutSettings(), stats: patients.patientStats(), list: patients.listPatients({pageSize: 100}), records, audit,
  mrnPreview: {1: ref.previewMrn(1), 2: ref.previewMrn(2), 3: ref.previewMrn(3)}, pincodes: Object.fromEntries(['682020', '695001'].map(pin => [pin, ref.findPincode(pin)])), history: settings.layoutHistory()};
writeFileSync(out, JSON.stringify(data));
console.log(Object.keys(data.lookups).length, data.list.items.length, data.list.total);
