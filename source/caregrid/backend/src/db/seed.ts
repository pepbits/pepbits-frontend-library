/* Seeds the SQL database: schema, reference data (reference.sql) and five weeks of mock activity.
 * Activity is booked through the real scheduling engine, so every mock appointment respects working hours,
 * capacity, turnover and multi-resource rules. */
import fs from 'fs';
import path from 'path';
import { db, sqlDir } from './index';
import { Calendar, search } from '../engine/availability';
import { book, bookSeries } from '../engine/booking';
import { createException } from '../engine/exceptions';
import { DAY, addDays, dayStart, fromMin, nowMin, toMin, todayStr, weekday } from '../lib/time';

let seedVal = 20260422;
const rand = () => { seedVal = (seedVal * 1664525 + 1013904223) % 4294967296; return seedVal / 4294967296; };
const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const DAILY: [string, number][] = [
  ['New patient consultation', 10], ['Follow-up visit', 18], ['Chronic disease review (diabetes, BP, asthma)', 6], ['Walk-in visit', 4], ['Video consultation', 6],
  ['Cardiology consultation', 5], ['Ophthalmology consultation', 4], ['ENT consultation', 3], ['Dermatology consultation', 4], ['Orthopedic consultation', 5],
  ['Obstetrics / gynecology consultation', 5], ['Pediatric consultation', 6], ['Oncology consultation', 3], ['Psychiatry consultation', 3],
  ['Blood collection (phlebotomy)', 28], ['Fasting blood test', 12], ['Glucose tolerance test', 2], ['Urine / stool sample collection', 8],
  ['X-ray', 14], ['Ultrasound', 10], ['CT scan (plain)', 6], ['CT scan with contrast', 4], ['MRI', 10], ['Mammography', 3], ['DEXA (bone density)', 2], ['PET-CT', 1],
  ['ECG', 10], ['Echocardiogram', 6], ['Treadmill stress test (TMT)', 3], ['EEG', 2], ['Pulmonary function test', 3], ['Upper GI endoscopy', 3], ['Colonoscopy', 2],
  ['Cardiac catheterization / angiography', 1], ['Holter / ambulatory BP fitting', 2], ['Sleep study (polysomnography)', 1],
  ['Major elective surgery', 2], ['Day-care surgery (e.g., cataract, hernia)', 4], ['Laparoscopic surgery', 2], ['Minor surgery (local anesthesia)', 2],
  ['Pre-anesthesia check (PAC)', 4], ['Post-op review', 4], ['Wound dressing', 6],
  ['Dental check-up', 6], ['Scaling and polishing', 3], ['Filling', 4], ['Root canal treatment', 2], ['Tooth extraction', 2], ['Orthodontic adjustment', 3],
  ['Physiotherapy session', 20], ['Occupational therapy', 2], ['Speech and language therapy', 2], ['Cardiac rehabilitation', 4], ['Psychotherapy / counseling', 4],
  ['Antenatal visit', 6], ['Pregnancy scan (NT / anomaly / growth)', 3], ['Well-baby visit', 4], ['Childhood immunization', 6],
  ['Chemotherapy infusion', 5], ['Radiotherapy session', 14], ['Infusion therapy (biologics, IV iron)', 4], ['Injection visit (B12, depot, hormone)', 5],
  ['Hyperbaric oxygen therapy', 3], ['Health check-up package', 3], ['Adult / travel vaccination', 3], ['Pre-employment medical', 2],
  ['Prescription pickup', 15], ['Refill pickup', 10], ['Medication therapy review', 2], ['Anticoagulation (INR) clinic', 4], ['Device training (inhaler, insulin pen, glucometer)', 2],
  ['Home delivery slot', 4], ['Home nursing visit', 6], ['Home physiotherapy', 3], ['Home sample collection', 4], ['Doctor home visit', 2],
  ['Dietitian consultation', 3], ['Optometry / eye test', 4], ['Diabetes education', 2], ['Patient registration', 6], ['Urgent care slot', 8],
  ['Whole blood donation', 4], ['Interpreter booking', 1],
];
const BIAS: Record<string, number> = {
  'New patient consultation': 1.35, 'Follow-up visit': 0.85, 'MRI': 1.15, 'Blood collection (phlebotomy)': 1.3, 'Cardiology consultation': 1.25,
  'Ultrasound': 1.2, 'Dental check-up': 0.8, 'Chemotherapy infusion': 1.1, 'Colonoscopy': 1.25, 'Pediatric consultation': 1.4, 'Psychiatry consultation': 1.2,
  'Physiotherapy session': 0.9, 'X-ray': 1.2, 'Orthopedic consultation': 0.75, 'Prescription pickup': 1.6, 'Video consultation': 0.8,
};

export function seed(opts: { verbose?: boolean } = {}) {
  const log = (...a: unknown[]) => opts.verbose && console.log(...a);
  const t0 = Date.now();
  db.exec(`PRAGMA foreign_keys = OFF;`);
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[];
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  db.exec(fs.readFileSync(path.join(sqlDir(), 'schema.sql'), 'utf8'));
  db.exec('BEGIN');
  db.exec(fs.readFileSync(path.join(sqlDir(), 'reference.sql'), 'utf8'));
  db.exec('COMMIT');
  db.exec(`PRAGMA foreign_keys = ON;`);
  log('reference data loaded');

  const today = todayStr();
  const now = nowMin();
  const typeId = new Map((db.prepare('SELECT id, name, duration_min FROM appointment_types').all() as any[]).map(t => [t.name, t]));
  const patients = (db.prepare('SELECT id FROM patients').all() as any[]).map(p => p.id);
  const res = (role: string) => (db.prepare('SELECT id FROM resources WHERE role_code = ? ORDER BY id').all(role) as any[]).map(r => r.id);

  // Facility calendar and planned blocks (entered before bookings, so the engine simply routes around them)
  db.prepare('INSERT INTO holidays (date, name) VALUES (?,?)').run(addDays(today, 10), "Founders' Day (elective services closed)");
  const ins = db.prepare(`INSERT INTO resource_exceptions (resource_id, type, planned, start_at, end_at, recur_weeks, recur_until, reason, source, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  let sun = today; while (weekday(dayStart(sun)) !== 0) sun = addDays(sun, 1);
  ins.run(res('mri_scanner')[0], 'maintenance', 1, `${addDays(sun, -14)}T06:00`, `${addDays(sun, -14)}T10:00`, 2, null, 'Preventive maintenance and coil calibration', 'maintenance_system', `${addDays(today, -20)}T09:00`);
  ins.run(res('gp')[0], 'leave', 1, `${addDays(today, 3)}T00:00`, `${addDays(today, 6)}T00:00`, null, null, 'Annual leave', 'hr_roster', `${addDays(today, -10)}T11:00`);
  ins.run(res('physio')[1], 'training', 1, `${addDays(today, 2)}T13:00`, `${addDays(today, 2)}T20:00`, null, null, 'Manual therapy course', 'hr_roster', `${addDays(today, -6)}T16:00`);
  ins.run(res('linac')[1], 'calibration', 1, `${addDays(today, -21)}T07:00`, `${addDays(today, -21)}T08:00`, 1, addDays(today, 60), 'Daily-output QA (weekly full check)', 'maintenance_system', `${addDays(today, -21)}T07:00`);
  ins.run(res('dental_chair')[4], 'maintenance', 1, `${addDays(today, 1)}T09:00`, `${addDays(today, 1)}T12:00`, null, null, 'Handpiece and suction service', 'maintenance_system', `${addDays(today, -2)}T10:00`);

  const from = dayStart(addDays(today, -22)), to = dayStart(addDays(today, 16));
  const cal = new Calendar(from - DAY, to + 2 * DAY);
  const created: { id: number; start: string; type: string; dur: number }[] = [];
  let attempts = 0;

  db.exec('BEGIN');
  for (let off = -21; off <= 14; off++) {
    const date = addDays(today, off);
    const wd = weekday(dayStart(date));
    const density = (off < 0 ? 0.55 : off === 0 ? 0.6 : Math.max(0.12, 0.55 - off * 0.03)) * (wd === 0 ? 0.15 : wd === 6 ? 0.6 : 1);
    for (const [name, perDay] of DAILY) {
      const t = typeId.get(name); if (!t) throw new Error(`Unknown type ${name}`);
      const want = Math.round(perDay * density * (0.8 + rand() * 0.4));
      if (!want) continue;
      const r = search({ typeId: t.id, fromDate: date, days: 1, allowPast: true, limitPerDay: 1000, maxSlots: 1000 }, cal);
      let slots = r.days[0]?.slots ?? [];
      for (let k = 0; k < want && slots.length; k++) {
        const s = slots.splice(Math.floor(rand() * slots.length), 1)[0];
        for (let tries = 0; tries < 3; tries++) {
          attempts++;
          try {
            const a = book({ patientId: pick(patients), typeId: t.id, start: s.start, assignments: s.assignments, allowPast: true, quiet: true,
              source: name === 'Walk-in visit' ? 'walkin' : pick(['desk', 'desk', 'phone', 'portal', 'referral']),
              createdAt: fromMin(Math.min(toMin(s.start) - 60 * (2 + Math.floor(rand() * 200)), now)) }, cal);
            created.push({ id: a.id, start: a.start_at, type: name, dur: t.duration_min });
            // drop nearby candidates that now overlap (cheap way to keep the next picks valid)
            slots = slots.filter(x => Math.abs(toMin(x.start) - toMin(s.start)) >= t.duration_min || x.assignments[0].resource_id !== s.assignments[0].resource_id);
            break;
          } catch { /* patient double-booked or slot taken: try again */ }
        }
      }
    }
    log(date, created.length);
  }
  db.exec('COMMIT');

  // Lifecycle for past and current appointments, with realistic duration drift so the duration analysis has signal
  db.exec('BEGIN');
  const upd = db.prepare(`UPDATE appointments SET status = ?, checked_in_at = ?, actual_start = ?, actual_end = ?, cancel_reason = ? WHERE id = ?`);
  const rel = db.prepare('UPDATE appointment_resources SET released = 1 WHERE appointment_id = ?');
  for (const a of created) {
    const s = toMin(a.start);
    const r = rand();
    const bias = BIAS[a.type] ?? 1;
    const delay = Math.max(-5, Math.round(Math.abs(gauss()) * 9 - 2));
    const actualDur = Math.max(3, Math.round(a.dur * bias * (1 + gauss() * 0.15)));
    const checkIn = s - Math.round(5 + rand() * 20);
    if (s + a.dur <= now) {
      if (r < 0.06) { upd.run('no_show', null, null, null, null, a.id); rel.run(a.id); }
      else if (r < 0.1) { upd.run('cancelled', null, null, null, pick(['Patient request', 'Feeling better', 'Clash with work', 'Travel']), a.id); rel.run(a.id); }
      else upd.run('completed', fromMin(checkIn), fromMin(s + delay), fromMin(s + delay + actualDur), null, a.id);
    } else if (s <= now) {
      upd.run('in_progress', fromMin(checkIn), fromMin(s + delay), null, null, a.id);
    } else if (s - now < 45 && r < 0.6) {
      upd.run('checked_in', fromMin(Math.min(now, checkIn)), null, null, null, a.id);
    } else if (r < 0.45) {
      db.prepare(`UPDATE appointments SET status = 'confirmed' WHERE id = ?`).run(a.id);
    }
  }
  db.exec('COMMIT');
  log('lifecycle applied');

  // Recurring courses (dialysis, radiotherapy, physio)
  const dial = typeId.get('Hemodialysis')!.id;
  for (const [i, time] of ['06:00', '10:30', '15:00', '06:00', '10:30', '15:00'].entries()) {
    try { bookSeries({ patientId: patients[i + 1], typeId: dial, startDate: today, weekdays: i % 2 ? [2, 4, 6] : [1, 3, 5], time, occurrences: 8 }); } catch (e) { log(e); }
  }
  try { bookSeries({ patientId: patients[9], typeId: typeId.get('Physiotherapy session')!.id, startDate: addDays(today, 1), weekdays: [1, 3, 5], time: '09:00', occurrences: 10 }); } catch (e) { log(e); }

  // Unplanned events after bookings: these create the reschedule queue the team works through.
  // Windows are placed relative to "now" on the busiest resources so the demo always has real work to show.
  const busiest = (role: string, a: number, b: number) => {
    const rows = db.prepare(`SELECT ar.resource_id id, COUNT(*) c FROM appointment_resources ar JOIN appointments ap ON ap.id = ar.appointment_id
      JOIN resources r ON r.id = ar.resource_id WHERE r.role_code = ? AND ap.status IN ('booked','confirmed') AND ar.start_at >= ? AND ar.start_at < ?
      GROUP BY ar.resource_id ORDER BY c DESC LIMIT 1`).get(role, fromMin(a), fromMin(b)) as any;
    return rows?.id ?? res(role)[0];
  };
  let bs = Math.max(Math.ceil((now + 30) / 15) * 15, dayStart(today) + 8 * 60);
  if (bs > dayStart(today) + 17 * 60) bs = dayStart(addDays(today, 1)) + 8 * 60;
  const be = bs + 270;
  createException({ resource_id: busiest('mri_scanner', bs, be), type: 'breakdown', planned: false, start_at: fromMin(bs), end_at: fromMin(be), reason: 'Gradient coil fault; engineer en route', source: 'technician' });
  const t1 = dayStart(addDays(today, 1));
  createException({ resource_id: busiest('cardiologist', t1, t1 + DAY), type: 'conference', start_at: fromMin(t1 + 9 * 60), end_at: fromMin(t1 + 14 * 60), reason: 'Cardiology society meeting', source: 'hr_roster' });
  createException({ resource_id: busiest('physio', t1, t1 + DAY), type: 'sick', planned: false, start_at: fromMin(t1), end_at: fromMin(t1 + DAY), reason: 'Called in sick', source: 'hr_roster' });

  // Waitlist
  const wl = db.prepare('INSERT INTO waitlist (patient_id, type_id, earliest, latest, priority, notes, created_at) VALUES (?,?,?,?,?,?,?)');
  wl.run(patients[20], typeId.get('MRI')!.id, today, addDays(today, 3), 'urgent', 'Wants the earliest MRI; can come at short notice', `${addDays(today, -1)}T10:00`);
  wl.run(patients[21], typeId.get('Cardiology consultation')!.id, today, addDays(today, 7), 'routine', 'Prefers mornings', `${addDays(today, -2)}T12:00`);
  wl.run(patients[22], typeId.get('Colonoscopy')!.id, addDays(today, 1), addDays(today, 10), 'routine', null, `${addDays(today, -3)}T09:30`);
  wl.run(patients[23], typeId.get('Dental check-up')!.id, today, addDays(today, 5), 'routine', 'School hours only', `${addDays(today, -1)}T15:00`);

  // Reminder outbox for the coming two days
  const up = db.prepare(`SELECT a.id, a.ref, a.start_at, p.preferred_channel, t.name, t.prep_instructions FROM appointments a JOIN patients p ON p.id = a.patient_id
    JOIN appointment_types t ON t.id = a.type_id WHERE a.start_at > ? AND a.start_at < ? AND a.status IN ('booked','confirmed')`).all(fromMin(now), `${addDays(today, 3)}T00:00`) as any[];
  const rm = db.prepare('INSERT INTO reminders (appointment_id, channel, send_at, message, status) VALUES (?,?,?,?,?)');
  for (const a of up) {
    const send = toMin(a.start_at) - DAY;
    rm.run(a.id, a.preferred_channel ?? 'SMS', fromMin(send), `Reminder: ${a.name} on ${a.start_at.replace('T', ' at ')}. Ref ${a.ref}.${a.prep_instructions ? ' ' + a.prep_instructions : ''}`, send < now ? 'sent' : 'scheduled');
  }

  db.prepare(`INSERT INTO notifications (created_at, level, category, title, body, link, read) VALUES (?,?,?,?,?,?,1)`)
    .run(fromMin(now - 180), 'info', 'system', 'Welcome to CareGrid', 'Demo data is loaded: five weeks of activity across every department.', '/help');

  const n = (db.prepare('SELECT COUNT(*) c FROM appointments').get() as any).c;
  log(`seeded ${n} appointments (${attempts} attempts) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return n;
}

if (require.main === module) seed({ verbose: true });
