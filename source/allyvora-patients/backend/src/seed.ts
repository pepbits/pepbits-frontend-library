import { DEFAULT_LAYOUT_SETTINGS, defaultValues, deriveDisplayName, todayISO, validateForm, type FormValues } from '@allyvora/shared';
import { db, nowISO } from './db';
import { createPatient } from './repositories/patients';
import { getLookups, invalidateLookups } from './repositories/reference';
import { BRANCHES, LOOKUPS, ORGANIZATION, PINCODES, USER } from './seed-data';

export function seedReferenceData(): void {
  const has = (db.prepare('SELECT COUNT(*) AS n FROM organizations').get() as { n: number }).n > 0;
  if (has) return;

  db.transaction(() => {
    db.prepare('INSERT INTO organizations (id, code, name, patient_prefix) VALUES (?, ?, ?, ?)').run(
      ORGANIZATION.id,
      ORGANIZATION.code,
      ORGANIZATION.name,
      ORGANIZATION.patientPrefix,
    );
    const branch = db.prepare(
      'INSERT INTO branches (id, organization_id, code, name, city, mrn_prefix, mrn_pad, mrn_reset_yearly) VALUES (?, ?, ?, ?, ?, ?, 6, 1)',
    );
    for (const b of BRANCHES) branch.run(b.id, ORGANIZATION.id, b.code, b.name, b.city, b.mrnPrefix);

    db.prepare('INSERT INTO users (id, email, name, role, organization_id, default_branch_id) VALUES (?, ?, ?, ?, ?, ?)').run(
      USER.id,
      USER.email,
      USER.name,
      USER.role,
      ORGANIZATION.id,
      BRANCHES[0].id,
    );

    const lookup = db.prepare('INSERT INTO lookups (category, code, label, parent, sort) VALUES (?, ?, ?, ?, ?)');
    for (const [category, rows] of Object.entries(LOOKUPS)) {
      rows.forEach(([code, label, parent], i) => lookup.run(category, code, label, parent ?? null, i));
    }

    const pin = db.prepare('INSERT INTO pincodes (pincode, city, district, state) VALUES (?, ?, ?, ?)');
    for (const p of PINCODES) pin.run(...p);

    db.prepare('INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)').run(
      'patientForm.layout',
      JSON.stringify(DEFAULT_LAYOUT_SETTINGS),
      nowISO(),
      'System default',
    );
  })();
  invalidateLookups();
}

/* Deterministic pseudo-random generator so every fresh database looks the same. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE: [given: string, family: string, sex: 'male' | 'female', local: string][] = [
  ['Anjali', 'Nair', 'female', 'അഞ്ജലി നായർ'], ['Rahul', 'Menon', 'male', 'രാഹുൽ മേനോൻ'], ['Fathima', 'Rahman', 'female', 'ഫാത്തിമ റഹ്മാൻ'],
  ['Joseph', 'Kurian', 'male', 'ജോസഫ് കുര്യൻ'], ['Lakshmi', 'Pillai', 'female', 'ലക്ഷ്മി പിള്ള'], ['Arjun', 'Krishnan', 'male', 'അർജുൻ കൃഷ്ണൻ'],
  ['Meera', 'Varghese', 'female', 'മീര വർഗീസ്'], ['Mohammed', 'Haneef', 'male', 'മുഹമ്മദ് ഹനീഫ്'], ['Sneha', 'Thomas', 'female', 'സ്നേഹ തോമസ്'],
  ['George', 'Mathew', 'male', 'ജോർജ് മാത്യു'], ['Devika', 'Iyer', 'female', 'ദേവിക അയ്യർ'], ['Vishnu', 'Panicker', 'male', 'വിഷ്ണു പണിക്കർ'],
  ['Aisha', 'Beevi', 'female', 'ആയിഷ ബീവി'], ['Thomas', 'Joseph', 'male', 'തോമസ് ജോസഫ്'], ['Kavya', 'Das', 'female', 'കാവ്യ ദാസ്'],
  ['Suresh', 'Kumar', 'male', 'സുരേഷ് കുമാർ'], ['Nisha', 'Paul', 'female', 'നിഷ പോൾ'], ['Abdul', 'Kareem', 'male', 'അബ്ദുൾ കരീം'],
  ['Priya', 'Raj', 'female', 'പ്രിയ രാജ്'], ['Sanjay', 'Varma', 'male', 'സഞ്ജയ് വർമ്മ'], ['Mariam', 'George', 'female', 'മറിയം ജോർജ്'],
  ['Arun', 'Shankar', 'male', 'അരുൺ ശങ്കർ'], ['Divya', 'Mohan', 'female', 'ദിവ്യ മോഹൻ'], ['Rajesh', 'Nambiar', 'male', 'രാജേഷ് നമ്പ്യാർ'],
  ['Shalini', 'Kartha', 'female', 'ശാലിനി കർത്ത'], ['Biju', 'Antony', 'male', 'ബിജു ആന്റണി'], ['Neethu', 'Sebastian', 'female', 'നീതു സെബാസ്റ്റ്യൻ'],
  ['Hari', 'Prasad', 'male', 'ഹരി പ്രസാദ്'],
];

const STREETS = ['MG Road', 'Banerji Road', 'Chittoor Road', 'Kaloor-Kadavanthra Road', 'Palarivattom Bypass', 'Seaport-Airport Road', 'Infopark Expressway', 'Market Road'];
const LOCALITIES = ['Panampilly Nagar', 'Vyttila', 'Kakkanad', 'Edappally', 'Kadavanthra', 'Palarivattom', 'Thrikkakara', 'Elamakkara'];

export function seedDemoPatients(): number {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n;
  if (count > 0) return 0;
  const lookups = getLookups();
  const rand = rng(2026);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const pins = ['682016', '682020', '682024', '682030', '682017', '683101', '682011'];
  const pinCity: Record<string, string> = { '682016': 'Kochi', '682020': 'Kadavanthra', '682024': 'Edappally', '682030': 'Kakkanad', '682017': 'Kaloor', '683101': 'Aluva', '682011': 'Ernakulam' };
  const now = new Date();
  const queue: { v: FormValues; at: Date; actor: string }[] = [];

  PEOPLE.forEach(([given, family, sex, local], i) => {
    // First four were registered today, the rest across the last six weeks.
    const daysAgo = i < 4 ? 0 : Math.floor(rand() * 42) + 1;
    const at = new Date(now.getTime() - daysAgo * 86400000 - Math.floor(rand() * 6) * 3600000);
    if (at > now) at.setTime(now.getTime() - 60000);
    const today = todayISO(at);
    const age = 3 + Math.floor(rand() * 78);
    const dob = new Date(at.getFullYear() - age, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27));
    const pin = pick(pins);
    const payer = rand() < 0.55 ? 'self' : rand() < 0.75 ? 'insurance' : rand() < 0.5 ? 'corporate' : 'government';
    const hasAllergy = rand() < 0.25;
    const dept = pick(lookups.department!).code;
    const doctors = lookups.doctor!.filter((d) => d.parent === dept);
    const married = age > 26 && rand() < 0.75;

    const v: FormValues = {
      ...defaultValues(today, (i % 7 === 6 ? 2 : 1)),
      title: sex === 'male' ? (age < 12 ? 'master' : 'mr') : age < 12 ? 'baby' : married ? 'mrs' : 'ms',
      givenName: given,
      familyName: family,
      localName: local,
      dateOfBirth: todayISO(dob),
      administrativeSex: sex,
      genderIdentity: sex === 'male' ? 'man' : 'woman',
      pronoun: sex === 'male' ? 'heHim' : 'sheHer',
      maritalStatus: age < 20 ? 'single' : married ? 'married' : 'single',
      religion: pick(['hindu', 'hindu', 'christian', 'muslim']),
      ethnicity: 'malayali',
      occupation: age < 22 ? 'student' : age > 62 ? 'retired' : pick(['salaried', 'professional', 'business', 'govt', 'homemaker', 'abroad']),
      educationLevel: age < 18 ? 'secondary' : pick(['graduate', 'postgraduate', 'higherSecondary', 'diploma']),
      mobile: `9${String(400000000 + Math.floor(rand() * 599999999)).padStart(9, '0')}`,
      email: rand() < 0.7 ? `${given.toLowerCase()}.${family.toLowerCase()}@example.in` : null,
      emergencyName: rand() < 0.7 ? `${pick(['Ravi', 'Sindhu', 'Shaji', 'Leela', 'Ammu', 'Jose'])} ${family}` : null,
      pincode: pin,
      addressLine1: `${10 + Math.floor(rand() * 480)}/${1 + Math.floor(rand() * 40)}, ${pick(STREETS)}`,
      addressLine2: pick(LOCALITIES),
      city: pinCity[pin],
      district: 'Ernakulam',
      state: 'KL',
      payerType: payer,
      bloodGroup: pick(['O+', 'O+', 'B+', 'A+', 'AB+', 'O-', 'B-']),
      allergyStatus: hasAllergy ? 'known' : rand() < 0.85 ? 'nka' : 'unknown',
      allergens: hasAllergy ? [pick(['penicillin', 'sulfa', 'nsaids', 'peanut', 'shellfish', 'latex'])] : null,
      chronicConditions: age > 45 && rand() < 0.6 ? [pick(['diabetes2', 'hypertension', 'thyroid', 'asthma'])] : null,
      registrationType: pick(['op', 'op', 'op', 'ip', 'daycare']),
      department: dept,
      consultant: doctors.length ? pick(doctors).code : null,
      paymentMode: payer === 'insurance' ? 'insurance' : pick(['upi', 'cash', 'card']),
      consentTreatment: true,
      consentDataSharing: rand() < 0.6,
      consentCapture: 'paper',
      paperFormRef: `CF-${String(1200 + i)}`,
      idDocumentType: rand() < 0.6 ? 'aadhaar' : null,
      idNumber: null,
      abhaNumber: rand() < 0.4 ? `91-${String(1000 + Math.floor(rand() * 8999))}-${String(1000 + Math.floor(rand() * 8999))}-${String(1000 + Math.floor(rand() * 8999))}` : null,
    };
    if (v.emergencyName) {
      v.emergencyRelationship = married ? 'spouse' : 'father';
      v.emergencyPhone = `8${String(100000000 + Math.floor(rand() * 899999999))}`;
    }
    if (v.idDocumentType === 'aadhaar') v.idNumber = `${2 + Math.floor(rand() * 7)}${String(Math.floor(rand() * 1e11)).padStart(11, '0')}`;
    if (payer === 'insurance') {
      Object.assign(v, {
        insurer: pick(lookups.insurer!).code,
        tpa: pick(lookups.tpa!).code,
        policyNumber: `POL${Math.floor(rand() * 1e8)}`,
        memberId: `M${Math.floor(rand() * 1e6)}`,
        policyHolderRelation: 'self',
        validFrom: `${now.getFullYear()}-04-01`,
        validTo: `${now.getFullYear() + 1}-03-31`,
      });
    }
    if (payer === 'corporate') Object.assign(v, { corporateName: pick(lookups.corporate!).code, employeeId: `E${Math.floor(rand() * 90000) + 10000}` });
    if (payer === 'government') Object.assign(v, { governmentScheme: pick(['pmjay', 'karunya', 'medisep']), schemeCardNumber: `SC${Math.floor(rand() * 1e9)}` });
    if (i % 9 === 5) {
      // A few records with lighter detail so "needs details" has examples.
      Object.assign(v, { email: null, emergencyName: null, emergencyRelationship: null, emergencyPhone: null, religion: null, occupation: null, educationLevel: null, ethnicity: null, bloodGroup: null, maritalStatus: null, genderIdentity: null, pronoun: null, addressLine2: null, abhaNumber: null, idDocumentType: null, idNumber: null, chronicConditions: null, localName: null });
    }
    v.displayName = deriveDisplayName(v, lookups);

    const errors = validateForm(v, today);
    if (Object.keys(errors).length) {
      console.warn(`Skipping demo patient ${given} ${family}:`, errors);
      return;
    }
    queue.push({ v, at, actor: i % 3 === 0 ? 'Arya Suresh' : USER.name });
  });
  // Register in time order so MRNs increase with registration date.
  queue.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const q of queue) createPatient(q.v, q.actor, { at: q.at });
  return queue.length;
}
