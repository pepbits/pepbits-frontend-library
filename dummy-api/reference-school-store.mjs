/*
 * Reference School (Scholaris) demo API — fictional, in-memory, synthetic for the process lifetime only.
 *
 * Ports the Scholaris source (src/app/api/**, src/lib/mock/{db,seed,bank}.ts, src/lib/types.ts,
 * src/lib/quiz-attempts.ts) to plain JS, following the already-agreed consumer contract in
 * desktop-clients/packages/reference-school/API-CONTRACT.md and src/lib/contract.ts (the reference-school
 * package that calls this store). Adds /session, /quiz-attempts and /settings*, which the source did not have,
 * exactly as that contract specifies.
 *
 * Not claimed: no real email/payment/live-class capability, no persistence beyond the process, no production
 * authorization. Identity is bound server-side per role from a fixed fictional roster (SCHOOL_IDENTITIES) —
 * never from a client-supplied studentId/teacherId/childIds.
 */
import { readFileSync } from 'node:fs';

const POOLS = JSON.parse(readFileSync(new URL('./reference-school-fixtures.json', import.meta.url), 'utf8'));
const { SUBJECT_DEFS, FIRST_M, FIRST_F, LAST, HOUSES, BLOOD, STREETS, QUALS, ASSIGN_TITLES, BOOKS, COVERS, QUESTION_BANK, NOTICES: NOTICE_DEFS, EVENTS: EVENT_DEFS } = POOLS;

/* ───────────────────────── pure helpers (src/lib/utils.ts) ───────────────────────── */
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function toDate(value) { if (value instanceof Date) return value; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value); }
function gradeFor(pct) { if (pct >= 90) return { grade: 'A+', point: 4.0 }; if (pct >= 80) return { grade: 'A', point: 3.7 }; if (pct >= 70) return { grade: 'B+', point: 3.3 }; if (pct >= 60) return { grade: 'B', point: 3.0 }; if (pct >= 50) return { grade: 'C', point: 2.3 }; if (pct >= 40) return { grade: 'D', point: 1.7 }; return { grade: 'F', point: 0 }; }

/* ───────────────────────── reference data (src/fixtures/seed.ts) ───────────────────────── */
const PERIODS = [
  { no: 1, label: 'P1', start: '08:00', end: '08:45' }, { no: 2, label: 'P2', start: '08:50', end: '09:35' }, { no: 3, label: 'P3', start: '09:40', end: '10:25' },
  { no: -1, label: 'Break', start: '10:25', end: '10:45', isBreak: true },
  { no: 4, label: 'P4', start: '10:45', end: '11:30' }, { no: 5, label: 'P5', start: '11:35', end: '12:20' },
  { no: -2, label: 'Lunch', start: '12:20', end: '13:00', isBreak: true },
  { no: 6, label: 'P6', start: '13:00', end: '13:45' }, { no: 7, label: 'P7', start: '13:50', end: '14:35' }, { no: 8, label: 'P8', start: '14:40', end: '15:25' },
];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TERMS = [
  { id: 'UT1', name: 'Unit Test 1', max: 25, status: 'Completed' },
  { id: 'QTR', name: 'Quarterly', max: 100, status: 'Completed' },
  { id: 'UT2', name: 'Unit Test 2', max: 25, status: 'Scheduled' },
  { id: 'HY', name: 'Half-Yearly', max: 100, status: 'Scheduled' },
];
const STUDY_HALL = 'sub-lib';
const EXAM_SUBJECTS = (grade) => ['sub-math', 'sub-eng', 'sub-phy', 'sub-chem', 'sub-bio', 'sub-cs', 'sub-hist', 'sub-geo', ...(grade >= 11 ? ['sub-eco'] : [])];

function fixtureDay(todayInput) {
  const iso = typeof todayInput === 'string' ? todayInput : isoDay(todayInput);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Fixture day must be YYYY-MM-DD, received "${iso}"`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function createSeed(todayInput) {
  const rng = mulberry32(20260927);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const int = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const today = fixtureDay(todayInput);
  const day = (n) => isoDay(addDays(today, n));

  const subjects = SUBJECT_DEFS.map(([id, code, name, department, type, periodsPerWeek, color]) => ({ id, code, name, department, type, periodsPerWeek, color, credits: type === 'Core' ? 4 : type === 'Lab' ? 3 : 2, grades: id === 'sub-eco' ? [11, 12] : [6, 7, 8, 9, 10, 11, 12] }));
  subjects.push({ id: STUDY_HALL, code: 'LIB', name: 'Library & study', department: 'Library', type: 'Activity', credits: 0, periodsPerWeek: 0, color: '#7b8794', grades: [6, 7, 8, 9, 10, 11, 12] });

  const teachers = [];
  let tn = 1;
  for (const [sid, , sname, dept, , , , count] of SUBJECT_DEFS) {
    for (let i = 0; i < count; i++) {
      const female = rng() > 0.45;
      const name = tn === 1 ? 'Priya Raman' : `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
      const id = `t-${String(tn).padStart(3, '0')}`;
      teachers.push({ id, empId: `NB-EMP-${2000 + tn}`, name, gender: tn === 1 || female ? 'Female' : 'Male', email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@northbridge.edu`, phone: `+1 555 01${String(tn).padStart(2, '0')} ${int(1000, 9999)}`, department: dept, subjectIds: [sid], qualification: pick(QUALS), experience: tn === 1 ? 12 : int(2, 24), designation: i === 0 ? `Head of ${sname}` : pick(['Senior Teacher', 'Teacher', 'Teacher', 'Lecturer']), employmentType: rng() > 0.9 ? 'Part-time' : 'Full-time', status: rng() > 0.95 ? 'On leave' : 'Active', joinedOn: day(-int(200, 5000)), rating: Math.round((3.6 + rng() * 1.4) * 10) / 10, weeklyPeriods: 0 });
      tn++;
    }
  }
  const teachersBySubject = (sid) => teachers.filter((t) => t.subjectIds.includes(sid));

  const classes = [];
  let ci = 0;
  const classTeacherPool = teachers.filter((t) => t.id !== 't-001').map((t) => t.id);
  for (let g = 6; g <= 12; g++) for (const sec of ['A', 'B']) {
    const id = `c-${g}${sec}`;
    classes.push({ id, grade: g, section: sec, name: `Grade ${g}-${sec}`, classTeacherId: id === 'c-10A' ? 't-001' : classTeacherPool[ci % classTeacherPool.length], room: `${g >= 11 ? 'C' : g >= 9 ? 'B' : 'A'}-${g}0${sec === 'A' ? 1 : 2}`, capacity: 30, strength: 24, stream: g >= 11 ? (sec === 'A' ? 'Science' : 'Commerce & Humanities') : 'General', avgScore: 0 });
    ci++;
  }

  const students = [];
  let sn = 0;
  for (const c of classes) for (let r = 1; r <= 24; r++) {
    const female = rng() > 0.5;
    let first = pick(female ? FIRST_F : FIRST_M);
    let last = pick(LAST);
    const id = `s-${1000 + sn}`;
    let gender = female ? 'Female' : 'Male';
    if (id === 's-1192') { first = 'Elena'; last = 'Vasquez'; gender = 'Female'; }
    if (id === 's-1072') { first = 'Mateo'; last = 'Vasquez'; gender = 'Male'; }
    const ability = id === 's-1192' ? 0.86 : id === 's-1072' ? 0.72 : 0.42 + rng() * 0.55;
    const dob = new Date(today.getFullYear() - c.grade - 5, int(0, 11), int(1, 28));
    const guardian = id.startsWith('s-1192') || id === 's-1072' ? 'Isabel Vasquez' : `${pick(rng() > 0.5 ? FIRST_F : FIRST_M)} ${last}`;
    students.push({ id, admissionNo: `NB/${2014 + (12 - c.grade) + int(0, 1)}/${String(4000 + sn).padStart(5, '0')}`, name: `${first} ${last}`, gender, dob: isoDay(dob), classId: c.id, rollNo: r, email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}${sn}@students.northbridge.edu`, phone: `+1 555 02${String(sn % 100).padStart(2, '0')} ${int(1000, 9999)}`, guardianName: guardian, guardianRelation: rng() > 0.5 ? 'Mother' : 'Father', guardianPhone: `+1 555 03${String(sn % 100).padStart(2, '0')} ${int(1000, 9999)}`, address: `${int(2, 220)} ${pick(STREETS)}, Northbridge`, bloodGroup: pick(BLOOD), house: pick(HOUSES), transport: rng() > 0.45 ? `Route ${int(1, 9)}` : 'Own transport', status: rng() > 0.985 ? 'Inactive' : 'Active', attendancePct: 0, gpa: 0, feeStatus: 'Paid', joinedOn: day(-int(30, 2600)), ability });
    sn++;
  }

  const classSubjectTeacher = new Map();
  classes.forEach((c, idx) => { for (const s of subjects) { if (!s.grades.includes(c.grade) || s.id === STUDY_HALL) continue; const pool = teachersBySubject(s.id); classSubjectTeacher.set(`${c.id}|${s.id}`, pool[idx % pool.length].id); } });
  const timetable = [];
  const quota = new Map();
  for (const c of classes) for (const s of subjects) if (s.grades.includes(c.grade) && s.periodsPerWeek) quota.set(`${c.id}|${s.id}`, s.periodsPerWeek);
  const teachingPeriods = PERIODS.filter((p) => !p.isBreak);
  for (let d = 0; d < 5; d++) for (const p of teachingPeriods) {
    const busy = new Set();
    for (const c of classes) {
      const usedToday = new Set(timetable.filter((t) => t.classId === c.id && t.day === d).map((t) => t.subjectId));
      const cands = subjects.filter((s) => (quota.get(`${c.id}|${s.id}`) ?? 0) > 0).map((s) => ({ s, w: (quota.get(`${c.id}|${s.id}`) ?? 0) + rng() * 2 - (usedToday.has(s.id) ? 3 : 0) })).sort((a, b) => b.w - a.w);
      const choice = cands.find(({ s }) => !busy.has(classSubjectTeacher.get(`${c.id}|${s.id}`)));
      if (choice) {
        const tid = classSubjectTeacher.get(`${c.id}|${choice.s.id}`);
        busy.add(tid);
        quota.set(`${c.id}|${choice.s.id}`, quota.get(`${c.id}|${choice.s.id}`) - 1);
        const lab = choice.s.type === 'Lab' ? `Lab ${choice.s.code}` : choice.s.id === 'sub-pe' ? 'Sports field' : choice.s.id === 'sub-cs' ? 'Computer lab' : c.room;
        timetable.push({ id: `tt-${c.id}-${d}-${p.no}`, classId: c.id, day: d, period: p.no, subjectId: choice.s.id, teacherId: tid, room: lab });
      } else timetable.push({ id: `tt-${c.id}-${d}-${p.no}`, classId: c.id, day: d, period: p.no, subjectId: STUDY_HALL, teacherId: null, room: 'Library' });
    }
  }
  for (const t of teachers) t.weeklyPeriods = timetable.filter((s) => s.teacherId === t.id).length;

  const assignments = [];
  let an = 1;
  for (const c of classes) {
    const subs = Object.keys(ASSIGN_TITLES);
    const count = c.id === 'c-10A' ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const sid = c.id === 'c-10A' && i < 4 ? 'sub-math' : subs[(i + c.grade) % subs.length];
      const offset = i < 3 ? int(1, 9) : -int(1, 20);
      const total = c.strength;
      const submitted = offset > 0 ? int(4, 18) : int(18, 24);
      assignments.push({ id: `as-${an++}`, title: pick(ASSIGN_TITLES[sid]), subjectId: sid, classId: c.id, teacherId: classSubjectTeacher.get(`${c.id}|${sid}`), description: 'Complete all questions showing full working. Upload a single PDF or type your answer below. Late submissions lose 10% per day.', type: pick(['Homework', 'Project', 'Worksheet', 'Essay', 'Lab report']), assignedOn: day(offset - int(5, 10)), dueDate: day(offset), maxMarks: pick([10, 20, 25, 50]), submitted, graded: offset > 0 ? int(0, 3) : Math.min(submitted, int(10, 24)), total, status: offset > 0 ? 'Open' : 'Closed' });
    }
  }

  const exams = [];
  let en = 1;
  for (const c of classes) { const subs = EXAM_SUBJECTS(c.grade).slice(0, 6); subs.forEach((sid, i) => { exams.push({ id: `ex-${en++}`, term: 'QTR', name: 'Quarterly', classId: c.id, subjectId: sid, date: day(-20 + i), start: '09:00', durationMin: 120, maxMarks: 100, room: c.room, invigilatorId: pick(teachers).id, status: 'Completed' }); exams.push({ id: `ex-${en++}`, term: 'UT2', name: 'Unit Test 2', classId: c.id, subjectId: sid, date: day(9 + i + (i >= 4 ? 2 : 0)), start: '09:00', durationMin: 60, maxMarks: 25, room: c.room, invigilatorId: pick(teachers).id, status: 'Scheduled' }); }); }

  const quizzes = [];
  let qn = 1;
  const bankSubjects = Object.keys(QUESTION_BANK);
  for (const c of classes) for (let i = 0; i < 4; i++) {
    const sid = c.id === 'c-10A' && i === 0 ? 'sub-math' : bankSubjects[(i + c.grade) % bankSubjects.length];
    const bank = QUESTION_BANK[sid];
    const sname = subjects.find((s) => s.id === sid).name;
    const qstatus = i === 3 ? 'Closed' : i === 2 && c.id !== 'c-10A' ? 'Draft' : 'Published';
    quizzes.push({ id: `qz-${qn}`, title: `${sname} ${['checkpoint', 'weekly quiz', 'revision quiz', 'chapter test'][i]}`, subjectId: sid, classId: c.id, teacherId: classSubjectTeacher.get(`${c.id}|${sid}`), durationMin: pick([10, 15, 20]), dueDate: day(qstatus === 'Closed' ? -int(2, 10) : int(1, 6)), status: qstatus, attempts: qstatus === 'Draft' ? 0 : int(8, 24), avgScore: qstatus === 'Draft' ? 0 : int(58, 88), questions: bank.map((q, k) => ({ ...q, id: `qz-${qn}-q${k + 1}`, points: 1 })) });
    qn++;
  }

  const live = [];
  let ln = 1;
  const addLive = (s) => live.push({ ...s, id: `lv-${ln++}` });
  addLive({ title: 'Quadratic equations – factorisation methods', subjectId: 'sub-math', classId: 'c-10A', teacherId: 't-001', offsetMin: -12, durationMin: 45, attendees: 21, capacity: 30, kind: 'Class' });
  addLive({ title: 'Trigonometric ratios – guided practice', subjectId: 'sub-math', classId: 'c-12A', teacherId: 't-001', offsetMin: 95, durationMin: 45, attendees: 0, capacity: 30, kind: 'Class' });
  addLive({ title: 'Parent–teacher conference: Term 1 progress', subjectId: 'sub-math', classId: 'c-10A', teacherId: 't-001', offsetMin: 60 * 26, durationMin: 30, attendees: 0, capacity: 40, kind: 'Parent meeting' });
  addLive({ title: 'Grade 7 parents: settling-in review', subjectId: 'sub-eng', classId: 'c-7B', teacherId: classes.find((c) => c.id === 'c-7B').classTeacherId, offsetMin: 60 * 50, durationMin: 40, attendees: 0, capacity: 40, kind: 'Parent meeting' });
  addLive({ title: 'Staff briefing: Unit Test 2 moderation', subjectId: 'sub-math', classId: 'c-10A', teacherId: 't-001', offsetMin: 60 * 5, durationMin: 30, attendees: 0, capacity: 60, kind: 'Staff meeting' });
  for (const c of classes) {
    const slots = timetable.filter((t) => t.classId === c.id && t.teacherId).slice(0, 3);
    slots.forEach((s, i) => {
      const sname = subjects.find((x) => x.id === s.subjectId).name;
      const offset = i === 0 ? (c.grade % 3 === 0 ? -8 : 40 + c.grade * 7) : i === 1 ? 60 * 24 + c.grade * 10 : -60 * 24 * (1 + c.grade % 4);
      addLive({ title: `${sname}: ${['concept session', 'doubt clearing', 'revision'][i]}`, subjectId: s.subjectId, classId: c.id, teacherId: s.teacherId, offsetMin: offset, durationMin: 45, attendees: offset < 0 ? int(15, 24) : 0, capacity: 30, kind: 'Class', recording: offset < -60 ? `rec-${ln}` : undefined });
    });
  }
  addLive({ title: 'Science fair orientation (all grades)', subjectId: 'sub-phy', classId: 'c-10A', teacherId: 't-006', offsetMin: 60 * 72, durationMin: 60, attendees: 0, capacity: 400, kind: 'Webinar' });

  const books = BOOKS.map(([title, author, category, publisher, year], i) => { const copies = int(2, 8); return { id: `bk-${i + 1}`, isbn: `978-${int(0, 9)}-${int(100, 999)}-${int(10000, 99999)}-${int(0, 9)}`, title, author, category, publisher, year, copies, available: 0, shelf: `${String.fromCharCode(65 + (i % 8))}-${int(1, 12)}`, rating: Math.round((3.8 + rng() * 1.2) * 10) / 10, cover: COVERS[i % COVERS.length] }; });
  const issues = [];
  let iss = 1;
  const addIssue = (b, memberId, memberName, memberType, issuedAgo, returned) => { const issuedOn = day(-issuedAgo); const dueOn = day(-issuedAgo + 14); const overdue = !returned && -issuedAgo + 14 < 0; issues.push({ id: `is-${iss++}`, bookId: b.id, bookTitle: b.title, memberId, memberName, memberType, issuedOn, dueOn, returnedOn: returned ? day(-issuedAgo + int(3, 13)) : null, status: returned ? 'Returned' : overdue ? 'Overdue' : 'Issued', fine: overdue ? (issuedAgo - 14) * 0.5 : 0 }); };
  addIssue(books[4], 's-1192', 'Elena Vasquez', 'Student', 6, false);
  addIssue(books[6], 's-1192', 'Elena Vasquez', 'Student', 17, false);
  addIssue(books[24], 's-1072', 'Mateo Vasquez', 'Student', 4, false);
  addIssue(books[17], 't-001', 'Priya Raman', 'Teacher', 9, false);
  for (let i = 0; i < 70; i++) { const b = pick(books); const member = rng() > 0.2 ? pick(students) : pick(teachers); addIssue(b, member.id, member.name, 'admissionNo' in member ? 'Student' : 'Teacher', int(1, 40), rng() > 0.55); }
  for (const b of books) { const out = issues.filter((x) => x.bookId === b.id && x.status !== 'Returned').length; b.copies = Math.max(b.copies, out); b.available = b.copies - out; }

  const invoices = [];
  let inv = 1;
  for (const s of students) {
    const c = classes.find((x) => x.id === s.classId);
    const tuition = 2100 + c.grade * 60;
    for (const [term, dueOffset] of [['Term 1', -45], ['Term 2', 18]]) {
      const items = [{ label: 'Tuition', amount: tuition }, { label: 'Laboratory', amount: c.grade >= 9 ? 180 : 90 }, { label: 'Library & digital resources', amount: 60 }, { label: 'Activities & sports', amount: 150 }, ...(s.transport !== 'Own transport' ? [{ label: `Transport (${s.transport})`, amount: 320 }] : [])];
      const amount = items.reduce((a, b) => a + b.amount, 0);
      const r = rng();
      let paid = 0;
      if (term === 'Term 1') paid = r > 0.08 ? amount : r > 0.03 ? Math.round(amount * 0.5) : 0;
      else paid = r > 0.55 ? amount : r > 0.35 ? Math.round(amount * 0.4) : 0;
      if (s.id === 's-1192' && term === 'Term 2') paid = 0;
      const invStatus = paid >= amount ? 'Paid' : paid > 0 ? 'Partial' : dueOffset < 0 ? 'Overdue' : 'Due';
      invoices.push({ id: `inv-${inv}`, invoiceNo: `INV-26-${String(inv).padStart(5, '0')}`, studentId: s.id, studentName: s.name, classId: s.classId, term, items, amount, paid, dueDate: day(dueOffset), status: invStatus, lastPaymentOn: paid ? day(dueOffset - int(1, 20)) : null, method: paid ? pick(['Card', 'Bank transfer', 'UPI', 'Cash', 'Cheque']) : null });
      inv++;
    }
    const mine = invoices.filter((i) => i.studentId === s.id);
    s.feeStatus = mine.some((i) => i.status === 'Overdue') ? 'Overdue' : mine.some((i) => i.status === 'Partial') ? 'Partial' : mine.some((i) => i.status === 'Due') ? 'Due' : 'Paid';
  }

  const notices = NOTICE_DEFS.map((n) => ({ id: n.id, title: n.title, body: n.body, audience: n.audience, priority: n.priority, postedBy: n.postedBy, date: day(n.dayOffset), pinned: n.pinned }));
  const events = EVENT_DEFS.map((e) => ({ id: e.id, title: e.title, date: day(e.dayOffset), ...(e.endDayOffset !== undefined ? { endDate: day(e.endDayOffset) } : {}), type: e.type, location: e.location }));
  const stages = ['Applied', 'Screening', 'Interview', 'Offered', 'Enrolled', 'Declined'];
  const admissions = Array.from({ length: 30 }, (_, i) => { const female = rng() > 0.5; const last = pick(LAST); const stage = stages[Math.min(5, Math.floor(rng() * rng() * 7))]; return { id: `ad-${i + 1}`, applicationNo: `APP-27-${String(310 + i).padStart(4, '0')}`, name: `${pick(female ? FIRST_F : FIRST_M)} ${last}`, grade: int(6, 11), parentName: `${pick(rng() > 0.5 ? FIRST_F : FIRST_M)} ${last}`, phone: `+1 555 04${String(i).padStart(2, '0')} ${int(1000, 9999)}`, email: `${last.toLowerCase().replace(/[^a-z]/g, '')}.family${i}@mail.com`, previousSchool: pick(['Riverside Academy', "St. Mary's School", 'Greenwood High', 'Lakeside International', 'Home-schooled']), stage, appliedOn: day(-int(1, 60)), score: stage === 'Applied' ? null : int(52, 96) }; });

  const t = (d, h, min) => { const x = addDays(today, d); x.setHours(h, min, 0, 0); return x.toISOString(); };
  const threads = [
    { id: 'th-1', owner: 'teacher', with: 'Isabel Vasquez', withRole: 'Parent of Elena (10-A)', subject: "Elena's statistics project", unread: 1, messages: [{ id: 'm1', from: 'them', text: 'Hi Ms. Raman, Elena mentioned the statistics project. Can she survey students from other grades too?', at: t(-1, 18, 12) }, { id: 'm2', from: 'me', text: 'Absolutely — a wider sample will strengthen her analysis. Please ask her to note the grade for each response.', at: t(-1, 19, 3) }, { id: 'm3', from: 'them', text: 'Wonderful, thank you! Will she need consent forms?', at: t(0, 7, 41) }] },
    { id: 'th-2', owner: 'teacher', with: 'Dr. Helen Okafor', withRole: 'Principal', subject: 'Moderation schedule', unread: 0, messages: [{ id: 'm1', from: 'them', text: 'Priya, could the maths department share the moderated Quarterly papers by Wednesday?', at: t(-2, 10, 5) }, { id: 'm2', from: 'me', text: "Yes, we'll have them uploaded by Tuesday evening.", at: t(-2, 10, 32) }] },
    { id: 'th-3', owner: 'teacher', with: 'Kwame Mensah', withRole: 'Student, 10-A', subject: 'Question about homework', unread: 2, messages: [{ id: 'm1', from: 'them', text: "Ma'am, in question 7 should we use the quadratic formula or factorise?", at: t(0, 8, 2) }, { id: 'm2', from: 'them', text: 'Sorry, I meant question 7(b).', at: t(0, 8, 4) }] },
    { id: 'th-4', owner: 'student', with: 'Priya Raman', withRole: 'Mathematics teacher', subject: 'Statistics project', unread: 1, messages: [{ id: 'm1', from: 'me', text: 'Ms. Raman, is it okay if my survey includes students from Grade 9 too?', at: t(-1, 17, 30) }, { id: 'm2', from: 'them', text: "Yes, that's a great idea. Label the grade for each response so you can compare groups.", at: t(-1, 19, 5) }] },
    { id: 'th-5', owner: 'student', with: 'Science Club', withRole: 'Group · 18 members', subject: 'Science fair team', unread: 4, messages: [{ id: 'm1', from: 'them', text: 'Team meeting at lunch tomorrow in Lab PHY. Bring your project ideas!', at: t(0, 9, 15) }] },
    { id: 'th-6', owner: 'parent', with: 'Priya Raman', withRole: 'Class teacher, 10-A', subject: "Elena's statistics project", unread: 1, messages: [{ id: 'm1', from: 'me', text: 'Hi Ms. Raman, Elena mentioned the statistics project. Can she survey students from other grades too?', at: t(-1, 18, 12) }, { id: 'm2', from: 'them', text: 'Absolutely — a wider sample will strengthen her analysis.', at: t(-1, 19, 3) }] },
    { id: 'th-7', owner: 'parent', with: 'Finance Office', withRole: 'Accounts', subject: 'Term 2 invoice', unread: 0, messages: [{ id: 'm1', from: 'them', text: 'Dear parent, the Term 2 invoice for Elena is now available. You can pay online from the fees page.', at: t(-3, 11, 0) }] },
    { id: 'th-8', owner: 'admin', with: 'Priya Raman', withRole: 'Head of Mathematics', subject: 'Moderation schedule', unread: 1, messages: [{ id: 'm1', from: 'me', text: 'Priya, could the maths department share the moderated Quarterly papers by Wednesday?', at: t(-2, 10, 5) }, { id: 'm2', from: 'them', text: "Yes, we'll have them uploaded by Tuesday evening.", at: t(-2, 10, 32) }] },
    { id: 'th-9', owner: 'admin', with: 'Grace Liu', withRole: 'Finance Officer', subject: 'Overdue Term 1 accounts', unread: 2, messages: [{ id: 'm1', from: 'them', text: 'We have 14 overdue Term 1 accounts. Shall I send the second reminder today?', at: t(0, 9, 12) }] },
    { id: 'th-10', owner: 'librarian', with: 'Priya Raman', withRole: 'Teacher', subject: 'Olympiad books', unread: 1, messages: [{ id: 'm1', from: 'them', text: 'Could we order three more copies of the Olympiad challenge book?', at: t(0, 8, 50) }] },
    { id: 'th-11', owner: 'accountant', with: 'Dr. Helen Okafor', withRole: 'Principal', subject: 'Overdue Term 1 accounts', unread: 0, messages: [{ id: 'm1', from: 'me', text: 'We have 14 overdue Term 1 accounts. Shall I send the second reminder today?', at: t(0, 9, 12) }, { id: 'm2', from: 'them', text: 'Yes please, and flag any family needing a payment plan.', at: t(0, 9, 40) }] },
  ];

  return { subjects, teachers, classes, students, timetable, assignments, exams, quizzes, live, books, issues, invoices, notices, events, admissions, threads };
}

function generatedMark(student, subjectId, termId, max) {
  const r = mulberry32(hashStr(`${student.id}|${subjectId}|${termId}`))();
  const subjBias = (mulberry32(hashStr(`${student.id}|${subjectId}`))() - 0.5) * 0.22;
  const pct = Math.max(0.18, Math.min(1, student.ability + subjBias + (r - 0.5) * 0.18));
  return Math.round(pct * max);
}
function generatedAttendance(student, date) {
  const r = mulberry32(hashStr(`${student.id}|${date}`))();
  const pAbsent = 0.02 + (1 - student.ability) * 0.12;
  if (r < pAbsent) return 'A';
  if (r < pAbsent + 0.03) return 'L';
  if (r < pAbsent + 0.04) return 'E';
  return 'P';
}
function schoolDays(n, from) {
  const out = [];
  let d = new Date(toDate(from));
  d.setHours(0, 0, 0, 0);
  while (out.length < n) { const wd = d.getDay(); if (wd !== 0 && wd !== 6) out.unshift(isoDay(d)); d = addDays(d, -1); }
  return out;
}
/** Ports src/lib/mock/db.ts materializeLive (lines 72-82): offsetMin is measured from the actual current instant,
    not from midnight of the fixture's seed day — a demo session authored as `offsetMin: -12` is meant to be "12
    minutes ago" right now, whenever "now" happens to be, so the source's intended near-now Live/Scheduled/Ended
    spread only appears if `anchor` here is the same real-time instant as `now` (the source uses one `Date.now()`
    for both). An explicit `s.start` timestamp always wins over offsetMin regardless of anchor. */
function materializeLiveSessions(live, anchor, now = anchor) {
  const base = anchor.getTime();
  const at = now.getTime();
  return live.map((s) => {
    const start = s.start ? new Date(s.start).getTime() : base + (s.offsetMin ?? 0) * 60000;
    const end = start + s.durationMin * 60000;
    // `endedAt` (set by an accepted host/admin "end" action — see applyLiveAction) persists the session as Ended
    // from that point on, regardless of what its authored offset/duration would otherwise compute.
    const liveStatus = s.endedAt ? 'Ended' : at < start ? 'Scheduled' : at < end ? 'Live' : 'Ended';
    const { offsetMin: _offset, endedAt: _endedAt, ...rest } = s;
    return { ...rest, start: new Date(start).toISOString(), status: liveStatus, attendees: liveStatus === 'Scheduled' ? 0 : rest.attendees };
  }).sort((a, b) => a.start.localeCompare(b.start));
}
function generateSubmissions(fixture, assignmentId) {
  const a = fixture.assignments.find((x) => x.id === assignmentId);
  if (!a) return [];
  const roster = fixture.students.filter((s) => s.classId === a.classId);
  const rng = mulberry32(hashStr(assignmentId));
  let submittedLeft = a.submitted;
  let gradedLeft = a.graded;
  return roster.map((s) => {
    const submitted = s.id === 's-1192' ? a.status === 'Closed' : submittedLeft-- > 0;
    const graded = submitted && gradedLeft-- > 0;
    const late = submitted && rng() > 0.85;
    return { id: `${assignmentId}-${s.id}`, assignmentId, studentId: s.id, studentName: s.name, submittedOn: submitted ? isoDay(addDays(toDate(a.dueDate), -Math.floor(rng() * 3) + (late ? 1 : 0))) : null, status: graded ? 'Graded' : submitted ? (late ? 'Late' : 'Submitted') : 'Missing', marks: graded ? Math.round(a.maxMarks * Math.min(1, s.ability + (rng() - 0.4) * 0.2)) : null, feedback: graded ? ['Clear working, well done.', 'Check your units in Q3.', 'Good effort — revise the method in part (b).', 'Excellent presentation.'][Math.floor(rng() * 4)] : '', text: submitted ? 'Answers attached as PDF. Question 4 includes an extra worked example.' : '' };
  });
}

const SCHOOL_PROFILE = { name: 'Northbridge International School', short: 'Northbridge', product: 'Scholaris', year: '2026–27', campus: 'Main campus', bankTransfer: { account: '0041 2297 5530', routing: '021000021' } };
const FEE_STRUCTURE = {
  data: [6, 7, 8, 9, 10, 11, 12].map((g) => ({ g, tuition: 2100 + g * 60, lab: g >= 9 ? 180 : 90, library: 60, activities: 150, transport: 320 })),
  policy: { siblingDiscountPct: 10, lateFee: 25, lateAfterDays: 15 },
};
/** Fixed demo presentation values for `/stats` `trends` (API-CONTRACT.md "Dashboard statistics"). These are
    backend constants, not a measured percentage change against a real previous period. */
const STATS_TREND_FIXTURES = { admin: { students: 3.2, attendanceToday: 0.8 }, accountant: { collected: 4.1 } };
const CONTACTS_FIXTURE = [
  { name: 'Dr. Helen Okafor', role: 'Principal' }, { name: 'School Office', role: 'Administration' },
  { name: 'Grace Liu', role: 'Finance Officer' }, { name: 'Samuel Adeyemi', role: 'Head Librarian' },
];
const SCHOOL_IDENTITIES = {
  admin: { id: 'u-admin', name: 'Dr. Helen Okafor', title: 'Principal', email: 'h.okafor@northbridge.edu' },
  teacher: { id: 't-001', name: 'Priya Raman', title: 'Mathematics · Class teacher 10-A', email: 'p.raman@northbridge.edu' },
  student: { id: 's-1192', name: 'Elena Vasquez', title: 'Grade 10-A · Roll 1', email: 'elena.v@students.northbridge.edu' },
  parent: { id: 'p-vasquez', name: 'Isabel Vasquez', title: 'Parent of Elena & Mateo', email: 'isabel.vasquez@mail.com' },
  librarian: { id: 'u-lib', name: 'Samuel Adeyemi', title: 'Head Librarian', email: 's.adeyemi@northbridge.edu' },
  accountant: { id: 'u-acc', name: 'Grace Liu', title: 'Finance Officer', email: 'g.liu@northbridge.edu' },
};
const PARENT_CHILDREN = { 'p-vasquez': ['s-1192', 's-1072'] };

function seedSchoolFixture({ today }) {
  const day = fixtureDay(today);
  const seed = createSeed(day);
  const days = schoolDays(40, day);
  for (const s of seed.students) {
    const present = days.filter((d) => generatedAttendance(s, d) !== 'A').length;
    s.attendancePct = Math.round((present / days.length) * 1000) / 10;
    const c = seed.classes.find((x) => x.id === s.classId);
    const subs = EXAM_SUBJECTS(c.grade);
    const pct = subs.reduce((a, sid) => a + generatedMark(s, sid, 'QTR', 100), 0) / subs.length;
    s.gpa = Math.round(gradeFor(pct).point * 100) / 100;
  }
  for (const c of seed.classes) {
    const roster = seed.students.filter((s) => s.classId === c.id);
    const subs = EXAM_SUBJECTS(c.grade);
    c.avgScore = Math.round(roster.reduce((a, s) => a + subs.reduce((x, sid) => x + generatedMark(s, sid, 'QTR', 100), 0) / subs.length, 0) / roster.length);
  }
  return { ...seed, today: isoDay(day), identities: structuredClone(SCHOOL_IDENTITIES), parentChildren: structuredClone(PARENT_CHILDREN), school: SCHOOL_PROFILE };
}

/* ───────────────────────── role mapping (desktop-clients/packages/reference-school/src/lib/session.tsx) ───────────────────────── */
const ALIASES = { 'enterprise-admin': 'admin', 'finance-manager': 'accountant', 'operations-analyst': 'teacher' };
function schoolRoleFor(hostRole) {
  const value = String(hostRole ?? '').trim().toLowerCase();
  if (ALIASES[value]) return ALIASES[value];
  const m = /^(?:school[:\-._/])?(admin|teacher|student|parent|librarian|accountant)$/.exec(value);
  return m ? m[1] : null;
}

/* ───────────────────────── request/resource plumbing ───────────────────────── */
const RESOURCES = ['students', 'teachers', 'classes', 'subjects', 'timetable', 'assignments', 'exams', 'quizzes', 'live', 'books', 'issues', 'invoices', 'notices', 'events', 'admissions', 'threads'];
const fail = (status, error, extra) => ({ status, body: { error, ...(extra ?? {}) } });
function toParams(query) {
  if (query instanceof URLSearchParams) return query;
  if (query == null) return new URLSearchParams();
  if (typeof query === 'string') return new URLSearchParams(query);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) { if (Array.isArray(v)) for (const x of v) sp.append(k, String(x)); else if (v !== undefined && v !== null) sp.set(k, String(v)); }
  return sp;
}
function normalizePath(path) {
  let p = String(path ?? '');
  if (p === '/api' || p === '') p = '/';
  else if (p.startsWith('/api/')) p = p.slice(4);
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}
const RESERVED_QUERY = new Set(['q', 'page', 'pageSize', 'sort', 'order', 'limit']);
function genericQuery(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (RESERVED_QUERY.has(k) || v === '' || v === 'all') continue;
    const values = v.split(',');
    out = out.filter((row) => { const field = row[k]; if (Array.isArray(field)) return field.some((x) => values.includes(String(x))); return values.includes(String(field)); });
  }
  const q = params.get('q')?.toLowerCase().trim();
  if (q) out = out.filter((row) => Object.values(row).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)));
  const sort = params.get('sort');
  if (sort) { const dir = params.get('order') === 'desc' ? -1 : 1; out = [...out].sort((a, b) => (String(a[sort]) > String(b[sort]) ? dir : -dir)); }
  const total = out.length;
  const limit = Number(params.get('limit') || 0);
  if (limit) out = out.slice(0, limit);
  const page = Number(params.get('page') || 0);
  if (page) { const size = Number(params.get('pageSize') || 20); out = out.slice((page - 1) * size, page * size); }
  return { data: out, total };
}
function validateScopeIdentity(user, scope) {
  if (!user || typeof user.id !== 'string' || !user.id) return fail(400, 'school.invalidUser');
  if (typeof user.tenantId !== 'string' || !user.tenantId) return fail(400, 'school.invalidTenant');
  if (typeof user.branch !== 'string' || !user.branch) return fail(400, 'school.invalidUserBranch');
  if (!scope || typeof scope.applicationId !== 'string' || !scope.applicationId) return fail(400, 'school.invalidApplication');
  if (typeof scope.branchId !== 'string' || !scope.branchId) return fail(400, 'school.invalidBranch');
  if (scope.branchId !== user.branch) return fail(403, 'school.branchMismatch');
  return null;
}

/* ───────────────────────── per-scope mutable state ───────────────────────── */
function createScopeState() {
  const today = isoDay(new Date());
  const fixture = seedSchoolFixture({ today });
  return {
    fixture,
    marks: new Map(),
    attendance: new Map(),
    quizAttempts: new Map(),
    settings: new Map(),
    receipts: new Map(),
    receiptSeq: 0,
    notificationOutbox: [],
    attachments: new Map(),
    leaveRequests: [],
    reservations: [],
    liveRooms: new Map(),
  };
}
function isStaffRole(role) { return role === 'admin' || role === 'teacher'; }
function sanitizeQuizQuestions(questions) { return (questions ?? []).map((q) => ({ id: q.id, text: q.text, options: q.options, points: q.points })); }
function sanitizeQuiz(quiz, staff) { return staff || !quiz.questions ? quiz : { ...quiz, questions: sanitizeQuizQuestions(quiz.questions) }; }
function shuffleIndices(n, seed) {
  const rng = mulberry32(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  return idx;
}
/** Question and, within each question, option delivery order for one (quiz, viewer) pair — honouring `quiz.shuffle`
    (the source's client-side shuffle, now server-side). No attempt token or session is persisted: the order is a
    pure deterministic function of the quiz id and the caller's own fixed identity id, so it is stable across
    repeated GETs and is exactly what `/grade` and a saved attempt's review must score/report against. A
    non-shuffled quiz (or a viewer with no bearing questions) is returned in its authored order untouched. */
function deliverQuizQuestions(quiz, keyId) {
  const qs = quiz?.questions ?? [];
  if (!quiz?.shuffle) return qs.map((q) => ({ ...q }));
  const order = shuffleIndices(qs.length, hashStr(`qorder|${quiz.id}|${keyId}`));
  return order.map((origIndex) => {
    const q = qs[origIndex];
    const optOrder = shuffleIndices(q.options.length, hashStr(`oorder|${quiz.id}|${keyId}|${origIndex}`));
    const options = optOrder.map((oi) => q.options[oi]);
    const answer = typeof q.answer === 'number' ? optOrder.indexOf(q.answer) : q.answer;
    return { ...q, options, answer };
  });
}
/** A saved attempt's answer key: withheld (empty) whenever the quiz author set `revealAnswers: false`, regardless
    of who is looking — the one exception (a live author preview via POST /grade) never goes through here. */
function withReview(fixture, attempt) {
  if (!attempt) return null;
  const quiz = fixture.quizzes.find((q) => q.id === attempt.quizId);
  if (!quiz || quiz.revealAnswers === false) return { ...attempt, review: [] };
  const delivered = deliverQuizQuestions(quiz, attempt.studentId);
  return { ...attempt, review: delivered.map((q) => ({ answer: q.answer, explanation: q.explanation })) };
}
function collection(fixture, resource, now = new Date()) {
  if (!RESOURCES.includes(resource)) return null;
  if (resource === 'live') return materializeLiveSessions(fixture.live, now, now);
  return fixture[resource];
}

/* ───────────────────────── write authorization ───────────────────────── */
function teacherClassIds(fixture, teacherId) { return [...new Set(fixture.timetable.filter((t) => t.teacherId === teacherId).map((t) => t.classId))]; }
const TEACHER_TRANSACTIONAL = new Set(['assignments', 'exams', 'quizzes', 'live']);
/** "librarian books/issues ONLY" and "accountant fees ONLY": these roles cannot read resources outside their
    domain either, not just write — their own message threads are the one shared exception. */
const LIBRARIAN_READABLE = new Set(['books', 'issues', 'threads']);
const ACCOUNTANT_READABLE = new Set(['invoices', 'threads']);
function canReadResource(schoolRole, resource) {
  if (schoolRole === 'librarian') return LIBRARIAN_READABLE.has(resource);
  if (schoolRole === 'accountant') return ACCOUNTANT_READABLE.has(resource);
  return true;
}

function canWriteResource(role, resource, identity, fixture, existing, body) {
  if (role === 'admin') return true;
  /* A new thread is always created owned by the caller's own school role (server-assigned, see the POST
     handler), so any authenticated role may create one; only the existing owner may amend one. */
  if (resource === 'threads') return existing ? existing.owner === role : true;
  if (role === 'librarian') return resource === 'books' || resource === 'issues';
  if (role === 'accountant') return resource === 'invoices';
  if (role === 'teacher') {
    if (!TEACHER_TRANSACTIONAL.has(resource)) return false;
    const classIds = teacherClassIds(fixture, identity.id);
    if (existing) return existing.teacherId ? existing.teacherId === identity.id : classIds.includes(existing.classId);
    return body ? classIds.includes(body.classId) : false;
  }
  return false;
}

/* ───────────────────────── attachments (new; fictional in-memory blobs, scoped like everything else) ───────────────────────── */
const ATTACHMENT_MAX_BYTES = 1024 * 1024;
const ATTACHMENT_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function sanitizeAttachmentName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 150) return null;
  if (/[\\/]|\.\.|[\x00-\x1f]/.test(trimmed)) return null;
  return trimmed;
}
function canCreateAttachment(schoolRole, purpose) {
  if (purpose === 'message') return true;
  if (purpose === 'assignment') return schoolRole === 'admin' || schoolRole === 'teacher';
  if (purpose === 'submission') return schoolRole === 'admin' || schoolRole === 'student';
  return false;
}
/** The frontend (src/lib/attachments.tsx, pages/assignments.tsx, pages/messages.tsx) links attachments by sending
    back the canonical SchoolAttachment object POST /attachments returned, not a bare id; legacy callers may still
    send a plain id string. Either way only the `id` is ever trusted — any other field on a client-supplied object
    (name/size/path/etc.) is discarded here, never merged into server state. */
function extractAttachmentId(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.id === 'string') return value.id;
  return null;
}
/** The canonical, server-truth shape (API-CONTRACT.md `SchoolAttachment`) for a resolved attachment record —
    never the client-supplied metadata that named the id. */
function canonicalAttachment(record) { return { id: record.id, name: record.name, type: record.type, size: record.size, downloadPath: `/attachments/${record.id}` }; }
function canonicalAttachments(records) { return records.map(canonicalAttachment); }
/** Validates a body-supplied list of attachment references against this scope's store: every id must exist, match
    the context's purpose and be owned by the caller (or the caller is admin). Read-only — callers must not link the
    attachment (mutate its `context`) until every id in the batch has passed, so a bad id fails the whole write. */
function validateAttachmentIds(state, ids, purpose, identity, schoolRole) {
  if (!Array.isArray(ids) || ids.length > 20) return { ok: false };
  const records = [];
  for (const raw of ids) {
    const id = extractAttachmentId(raw);
    if (!id) return { ok: false };
    const rec = state.attachments.get(id);
    if (!rec || rec.purpose !== purpose) return { ok: false };
    if (rec.ownerId !== identity.id && schoolRole !== 'admin') return { ok: false };
    records.push(rec);
  }
  return { ok: true, records };
}
function canAccessAttachment(fixture, schoolRole, identity, children, record) {
  if (schoolRole === 'admin' || record.ownerId === identity.id) return true;
  if (!record.context) return false;
  if (record.purpose === 'assignment') {
    const a = fixture.assignments.find((x) => x.id === record.context.assignmentId);
    if (!a) return false;
    if (schoolRole === 'teacher') return a.teacherId === identity.id || teacherClassIds(fixture, identity.id).includes(a.classId);
    if (schoolRole === 'student') return fixture.students.find((s) => s.id === identity.id)?.classId === a.classId;
    if (schoolRole === 'parent') return children.some((cid) => fixture.students.find((s) => s.id === cid)?.classId === a.classId);
    return false;
  }
  if (record.purpose === 'submission') {
    const { assignmentId, studentId } = record.context;
    const a = fixture.assignments.find((x) => x.id === assignmentId);
    if (!a) return false;
    if (schoolRole === 'student') return identity.id === studentId;
    if (schoolRole === 'teacher') return a.teacherId === identity.id || teacherClassIds(fixture, identity.id).includes(a.classId);
    if (schoolRole === 'parent') return children.includes(studentId);
    return false;
  }
  if (record.purpose === 'message') {
    const t = fixture.threads.find((x) => x.id === record.context.threadId);
    return !!t && t.owner === schoolRole;
  }
  return false;
}

/* ───────────────────────── store factory ───────────────────────── */
export function createReferenceSchoolStore() {
  const scopes = new Map();
  function scopeState(user, scope) {
    const key = JSON.stringify([user.tenantId, scope.applicationId, scope.branchId]);
    let s = scopes.get(key);
    if (!s) { s = createScopeState(); scopes.set(key, s); }
    return { key, state: s };
  }

  return {
    handle(user, scope, request) {
      const scopeError = validateScopeIdentity(user, scope);
      if (scopeError) return scopeError;
      const schoolRole = schoolRoleFor(user.role);
      if (!schoolRole) return fail(403, 'school.roleDenied');
      const identity = SCHOOL_IDENTITIES[schoolRole];
      const children = schoolRole === 'parent' ? (PARENT_CHILDREN[identity.id] ?? []) : [];
      const method = String(request?.method ?? 'GET').toUpperCase();
      const path = normalizePath(request?.path);
      const params = toParams(request?.query);
      const body = request?.body;
      const { key: scopeKey, state } = scopeState(user, scope);
      const { fixture } = state;
      const now = new Date();

      /* ---- session ---- */
      if (path === '/session') {
        if (method !== 'GET') return fail(405, 'school.methodNotAllowed');
        const requested = params.get('role');
        if (requested && requested !== schoolRole) return fail(403, 'school.roleMismatch');
        return { status: 200, body: { data: { role: schoolRole, user: { id: identity.id, name: identity.name, title: identity.title, email: identity.email }, children } } };
      }

      /* ---- meta ---- */
      if (path === '/meta') {
        if (method !== 'GET') return fail(405, 'school.methodNotAllowed');
        const wd = (now.getDay() + 6) % 7;
        return { status: 200, body: { periods: PERIODS, days: DAYS, terms: TERMS, today: { weekday: wd, schoolDay: wd < 5 ? wd : 0, isWeekend: wd >= 5 } } };
      }

      /* ---- marks ---- */
      if (path === '/marks') {
        if (schoolRole === 'librarian' || schoolRole === 'accountant') return fail(403, 'school.notPermitted');
        if (method === 'GET') {
          const classId = params.get('classId') ?? 'c-10A';
          const termId = params.get('term') ?? 'QTR';
          const cls = fixture.classes.find((c) => c.id === classId);
          const term = TERMS.find((t) => t.id === termId);
          if (!cls || !term) return fail(404, 'school.unknownClassOrTerm');
          if (schoolRole === 'teacher' && !teacherClassIds(fixture, identity.id).includes(classId)) return fail(403, 'school.notAssigned');
          if (schoolRole === 'student' && classId !== fixture.students.find((s) => s.id === identity.id)?.classId) return fail(403, 'school.notOwn');
          if (schoolRole === 'parent' && !children.some((cid) => fixture.students.find((s) => s.id === cid)?.classId === classId)) return fail(403, 'school.notOwn');
          const subjects = EXAM_SUBJECTS(cls.grade).map((id) => fixture.subjects.find((s) => s.id === id));
          const students = fixture.students.filter((s) => s.classId === classId).sort((a, b) => a.rollNo - b.rollNo).map((s) => ({ id: s.id, name: s.name, rollNo: s.rollNo, admissionNo: s.admissionNo, marks: Object.fromEntries(subjects.map((sub) => [sub.id, markFor(fixture, state, s.id, sub.id, termId)])) }));
          return { status: 200, body: { data: { class: cls, term, subjects, students } } };
        }
        if (method === 'POST') {
          if (schoolRole !== 'admin' && schoolRole !== 'teacher') return fail(403, 'school.writeDenied');
          if (typeof body !== 'object' || body === null || !Array.isArray(body.entries)) return fail(400, 'school.expectedTermEntries');
          const term = TERMS.find((t) => t.id === body.term);
          if (!term) return fail(400, 'school.unknownTerm');
          if (schoolRole === 'teacher') {
            const myClasses = new Set(teacherClassIds(fixture, identity.id));
            const mySubjects = new Set(fixture.teachers.find((t) => t.id === identity.id)?.subjectIds ?? []);
            for (const e of body.entries) {
              const student = fixture.students.find((s) => s.id === e.studentId);
              if (!student || !myClasses.has(student.classId) || !mySubjects.has(e.subjectId)) return fail(403, 'school.notAssigned');
            }
          }
          for (const e of body.entries) { if (e.value !== null && (typeof e.value !== 'number' || e.value < 0 || e.value > term.max)) return fail(400, 'school.marksRange', { max: term.max }); }
          for (const e of body.entries) state.marks.set(`${body.term}|${e.studentId}|${e.subjectId}`, e.value);
          return { status: 200, body: { data: { saved: body.entries.length } } };
        }
        return fail(405, 'school.methodNotAllowed');
      }

      /* ---- attendance ---- */
      if (path === '/attendance') {
        if (schoolRole === 'librarian' || schoolRole === 'accountant') return fail(403, 'school.notPermitted');
        if (method === 'GET') {
          const classId = params.get('classId');
          const studentId = params.get('studentId');
          if (classId) {
            if (schoolRole === 'student') return fail(403, 'school.notOwn');
            if (schoolRole === 'parent') return fail(403, 'school.notOwn');
            if (schoolRole === 'teacher' && !teacherClassIds(fixture, identity.id).includes(classId)) return fail(403, 'school.notAssigned');
            const date = params.get('date') ?? isoDay(now);
            const roster = fixture.students.filter((s) => s.classId === classId).sort((a, b) => a.rollNo - b.rollNo);
            const taken = roster.some((s) => state.attendance.has(`${s.id}|${date}`)) || toDate(date) < toDate(isoDay(now));
            const rows = roster.map((s) => ({ studentId: s.id, name: s.name, rollNo: s.rollNo, status: attendanceFor(fixture, state, s.id, date, now) ?? 'P' }));
            const trend = schoolDays(20, fixture.today).map((d) => { const vals = roster.map((s) => attendanceFor(fixture, state, s.id, d, now)).filter(Boolean); return { date: d, pct: vals.length ? Math.round((vals.filter((v) => v !== 'A').length / vals.length) * 1000) / 10 : 0 }; });
            return { status: 200, body: { data: rows, taken, trend } };
          }
          if (studentId) {
            if (!ownsStudent(schoolRole, identity, children, studentId) && schoolRole !== 'admin' && schoolRole !== 'teacher') return fail(403, 'school.notOwn');
            const month = params.get('month') ?? isoDay(now).slice(0, 7);
            const [y, m] = month.split('-').map(Number);
            const daysInMonth = new Date(y, m, 0).getDate();
            const days = Array.from({ length: daysInMonth }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; return { date, status: attendanceFor(fixture, state, studentId, date, now) }; });
            const last = schoolDays(60, fixture.today).map((d) => attendanceFor(fixture, state, studentId, d, now)).filter(Boolean);
            const summary = { present: last.filter((s) => s === 'P').length, absent: last.filter((s) => s === 'A').length, late: last.filter((s) => s === 'L').length, excused: last.filter((s) => s === 'E').length, total: last.length };
            return { status: 200, body: { data: days, summary } };
          }
          return fail(400, 'school.provideClassOrStudent');
        }
        if (method === 'POST') {
          if (schoolRole !== 'admin' && schoolRole !== 'teacher') return fail(403, 'school.writeDenied');
          if (typeof body !== 'object' || body === null || typeof body.date !== 'string' || !Array.isArray(body.rows)) return fail(400, 'school.expectedDateRows');
          if (schoolRole === 'teacher') {
            const myClasses = new Set(teacherClassIds(fixture, identity.id));
            for (const r of body.rows) { const student = fixture.students.find((s) => s.id === r.studentId); if (!student || !myClasses.has(student.classId)) return fail(403, 'school.notAssigned'); }
          }
          for (const r of body.rows) { if (!['P', 'A', 'L', 'E'].includes(r.status)) return fail(400, 'school.invalidStatus'); }
          for (const r of body.rows) state.attendance.set(`${r.studentId}|${body.date}`, r.status);
          return { status: 200, body: { data: { saved: body.rows.length } } };
        }
        return fail(405, 'school.methodNotAllowed');
      }

      /* ---- submissions ---- */
      if (path === '/submissions') {
        if (schoolRole === 'librarian' || schoolRole === 'accountant') return fail(403, 'school.notPermitted');
        if (method === 'GET') {
          const assignmentId = params.get('assignmentId');
          const studentId = params.get('studentId');
          if (assignmentId) {
            const a = fixture.assignments.find((x) => x.id === assignmentId);
            if (!a) return fail(404, 'school.notFound');
            if (schoolRole === 'teacher' && a.teacherId !== identity.id) return fail(403, 'school.notAssigned');
            if (schoolRole === 'student' || schoolRole === 'parent') {
              const list = submissionsFor(fixture, state, assignmentId).filter((s) => ownsStudent(schoolRole, identity, children, s.studentId));
              return { status: 200, body: { data: list } };
            }
            return { status: 200, body: { data: submissionsFor(fixture, state, assignmentId) } };
          }
          if (studentId) {
            if (!ownsStudent(schoolRole, identity, children, studentId) && schoolRole !== 'admin' && schoolRole !== 'teacher') return fail(403, 'school.notOwn');
            const s = fixture.students.find((x) => x.id === studentId);
            if (!s) return fail(404, 'school.notFound');
            const list = fixture.assignments.filter((a) => a.classId === s.classId).map((a) => submissionsFor(fixture, state, a.id).find((x) => x.studentId === studentId)).filter(Boolean);
            return { status: 200, body: { data: list } };
          }
          return fail(400, 'school.provideAssignmentOrStudent');
        }
        if (method === 'PATCH') {
          if (typeof body !== 'object' || body === null || !body.assignmentId || !body.studentId) return fail(400, 'school.expectedAssignmentStudent');
          const a = fixture.assignments.find((x) => x.id === body.assignmentId);
          if (!a) return fail(404, 'school.notFound');
          const list = submissionsFor(fixture, state, body.assignmentId);
          const sub = list.find((s) => s.studentId === body.studentId);
          if (!sub) return fail(404, 'school.notFound');
          if (typeof body.text === 'string') {
            if (schoolRole !== 'student' || identity.id !== body.studentId) return fail(403, 'school.notOwn');
          }
          if (typeof body.marks === 'number') {
            if (schoolRole !== 'admin' && (schoolRole !== 'teacher' || a.teacherId !== identity.id)) return fail(403, 'school.notAssigned');
            if (body.marks < 0 || body.marks > a.maxMarks) return fail(400, 'school.marksRange', { max: a.maxMarks });
          }
          let attachmentCheck = null;
          if (body.attachments !== undefined) {
            if (schoolRole !== 'admin' && (schoolRole !== 'student' || identity.id !== body.studentId)) return fail(403, 'school.notOwn');
            attachmentCheck = validateAttachmentIds(state, body.attachments, 'submission', identity, schoolRole);
            if (!attachmentCheck.ok) return fail(400, 'school.invalidAttachments');
          }
          const overrideKey = `submissions|${body.assignmentId}|${body.studentId}`;
          const prior = state.marks.get(`submission-override|${overrideKey}`) ?? {};
          const nowIso = isoDay(now);
          const wasMissing = (prior.status ?? sub.status) === 'Missing';
          const next = { ...sub, ...prior };
          if (typeof body.text === 'string') { next.text = body.text; next.submittedOn = nowIso; next.status = now > toDate(a.dueDate) ? 'Late' : 'Submitted'; if (wasMissing) a.submitted += 1; }
          if (typeof body.marks === 'number') { if (next.status !== 'Graded') a.graded += 1; next.marks = body.marks; next.feedback = body.feedback ?? next.feedback; next.status = 'Graded'; }
          if (attachmentCheck) { attachmentCheck.records.forEach((r) => { r.context = { assignmentId: body.assignmentId, studentId: body.studentId }; }); next.attachments = canonicalAttachments(attachmentCheck.records); }
          state.marks.set(`submission-override|${overrideKey}`, next);
          return { status: 200, body: { data: next } };
        }
        return fail(405, 'school.methodNotAllowed');
      }

      /* ---- report card ---- */
      if (path === '/report-card') {
        if (schoolRole === 'librarian' || schoolRole === 'accountant') return fail(403, 'school.notPermitted');
        if (method !== 'GET') return fail(405, 'school.methodNotAllowed');
        const studentId = params.get('studentId');
        if (!studentId) return fail(400, 'school.provideStudent');
        if (!ownsStudent(schoolRole, identity, children, studentId) && schoolRole !== 'admin' && schoolRole !== 'teacher') return fail(403, 'school.notOwn');
        const s = fixture.students.find((x) => x.id === studentId);
        if (!s) return fail(404, 'school.notFound');
        const cls = fixture.classes.find((c) => c.id === s.classId);
        const subjectIds = EXAM_SUBJECTS(cls.grade);
        const subjects = subjectIds.map((id) => fixture.subjects.find((x) => x.id === id));
        const roster = fixture.students.filter((x) => x.classId === s.classId);
        const terms = TERMS.map((t) => {
          const marks = Object.fromEntries(subjectIds.map((sid) => [sid, markFor(fixture, state, s.id, sid, t.id)]));
          const vals = Object.values(marks).filter((v) => v !== null);
          const total = vals.reduce((a, b) => a + b, 0);
          const pct = vals.length ? Math.round((total / (vals.length * t.max)) * 1000) / 10 : null;
          let rank = null;
          if (pct !== null) { const totals = roster.map((r) => subjectIds.reduce((a, sid) => a + (markFor(fixture, state, r.id, sid, t.id) ?? 0), 0)).sort((a, b) => b - a); rank = totals.indexOf(total) + 1; }
          const classAvg = Object.fromEntries(subjectIds.map((sid) => { const v = roster.map((r) => markFor(fixture, state, r.id, sid, t.id)).filter((x) => x !== null); return [sid, v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null]; }));
          return { ...t, marks, classAvg, total, pct, grade: pct !== null ? gradeFor(pct).grade : null, rank, outOf: roster.length };
        });
        return { status: 200, body: { data: { student: s, class: cls, subjects, terms } } };
      }

      /* ---- stats ---- */
      if (path === '/stats') return handleStats(method, params, fixture, state, now, schoolRole, identity, children);

      /* ---- quiz attempts (new) ---- */
      if (path === '/quiz-attempts') {
        if (schoolRole !== 'student' && schoolRole !== 'teacher' && schoolRole !== 'parent' && schoolRole !== 'admin') return fail(403, 'school.notPermitted');
        if (method === 'GET') {
          const studentId = params.get('studentId') ?? (schoolRole === 'student' ? identity.id : null);
          if (!studentId) return fail(400, 'school.provideStudent');
          if (schoolRole === 'teacher') {
            const student = fixture.students.find((s) => s.id === studentId);
            if (!student || !teacherClassIds(fixture, identity.id).includes(student.classId)) return fail(403, 'school.notAssigned');
          } else if (schoolRole !== 'admin' && !ownsStudent(schoolRole, identity, children, studentId)) return fail(403, 'school.notOwn');
          const quizId = params.get('quizId');
          if (quizId) return { status: 200, body: { data: withReview(fixture, state.quizAttempts.get(`${studentId}|${quizId}`) ?? null) } };
          const mine = [...state.quizAttempts.values()].filter((a) => a.studentId === studentId).map((a) => withReview(fixture, a));
          return { status: 200, body: { data: mine } };
        }
        if (method === 'POST') {
          if (schoolRole !== 'student') return fail(403, 'school.studentsOnly');
          if (typeof body !== 'object' || body === null) return fail(400, 'school.malformedBody');
          const quizId = body.quizId;
          const quiz = fixture.quizzes.find((q) => q.id === quizId);
          if (!quiz) return fail(404, 'school.notFound');
          // Same audience/lifecycle authority as POST /quizzes/:id/grade below: a student may only ever attempt a
          // quiz set for their own class, and only while it is actually open.
          if (fixture.students.find((s) => s.id === identity.id)?.classId !== quiz.classId) return fail(403, 'school.notOwn');
          const attemptKey = `${identity.id}|${quizId}`;
          if (state.quizAttempts.has(attemptKey)) return fail(409, 'school.alreadyAttempted');
          if (quiz.status !== 'Published') return fail(409, 'school.quizNotAvailable');
          const delivered = deliverQuizQuestions(quiz, identity.id);
          if (!Array.isArray(body.answers) || body.answers.length !== delivered.length) return fail(400, 'school.invalidAnswers');
          for (const a of body.answers) if (a !== null && (!Number.isInteger(a) || a < 0)) return fail(400, 'school.invalidAnswers');
          const score = delivered.reduce((sum, q, i) => sum + (body.answers[i] === q.answer ? q.points : 0), 0);
          const total = delivered.reduce((s, q) => s + q.points, 0);
          const attempt = { studentId: identity.id, quizId, score, total, answers: body.answers, at: new Date().toISOString(), timeTaken: Number.isFinite(body.timeTaken) ? body.timeTaken : 0 };
          state.quizAttempts.set(attemptKey, attempt);
          return { status: 201, body: { data: withReview(fixture, attempt) } };
        }
        return fail(405, 'school.methodNotAllowed');
      }

      /* ---- quiz questions and server-side grading (new) ---- */
      let quizMatch = /^\/quizzes\/([^/]+)\/questions$/.exec(path);
      if (quizMatch) {
        if (method !== 'GET') return fail(405, 'school.methodNotAllowed');
        if (schoolRole !== 'admin' && schoolRole !== 'teacher' && schoolRole !== 'student') return fail(403, 'school.notPermitted');
        const quiz = fixture.quizzes.find((q) => q.id === decodeURIComponent(quizMatch[1]));
        if (!quiz) return fail(404, 'school.notFound');
        // The quiz audience: a student may only reach their own class's quiz; a teacher only sees the author's
        // answer key for a quiz they own or are assigned to teach (admin is always allowed either way).
        if (schoolRole === 'student' && fixture.students.find((s) => s.id === identity.id)?.classId !== quiz.classId) return fail(403, 'school.notOwn');
        if (schoolRole === 'teacher' && quiz.teacherId !== identity.id && !teacherClassIds(fixture, identity.id).includes(quiz.classId)) return fail(403, 'school.notAssigned');
        const staff = isStaffRole(schoolRole);
        /* Delivery order (question and, within each, option order) is keyed to the caller's own fixed identity id,
           so the same student/teacher/admin always sees the same order on a repeat GET, and it is exactly what
           `/grade` below re-derives to score against. */
        const delivered = deliverQuizQuestions(quiz, identity.id);
        return { status: 200, body: { data: staff ? delivered : sanitizeQuizQuestions(delivered) } };
      }
      quizMatch = /^\/quizzes\/([^/]+)\/grade$/.exec(path);
      if (quizMatch) {
        if (method !== 'POST') return fail(405, 'school.methodNotAllowed');
        if (schoolRole !== 'admin' && schoolRole !== 'teacher' && schoolRole !== 'student') return fail(403, 'school.notPermitted');
        const quizId = decodeURIComponent(quizMatch[1]);
        const quiz = fixture.quizzes.find((q) => q.id === quizId);
        if (!quiz) return fail(404, 'school.notFound');
        if (typeof body !== 'object' || body === null) return fail(400, 'school.malformedBody');
        const staff = isStaffRole(schoolRole);
        if (staff && body.preview !== true) return fail(403, 'school.previewOnly');
        if (staff && schoolRole === 'teacher' && quiz.teacherId !== identity.id && !teacherClassIds(fixture, identity.id).includes(quiz.classId)) return fail(403, 'school.notAssigned');
        // A real student submission (never the author-preview branch above) is only ever for their own class's quiz.
        if (!staff && fixture.students.find((s) => s.id === identity.id)?.classId !== quiz.classId) return fail(403, 'school.notOwn');
        /* Same identity-keyed delivery order as GET .../questions above, so the submitted answers (indexed against
           whatever order that endpoint served this caller) are scored — and translated back to option text in the
           review — against the exact order the caller actually saw, shuffled or not. */
        const delivered = deliverQuizQuestions(quiz, identity.id);
        if (!Array.isArray(body.answers) || body.answers.length !== delivered.length) return fail(400, 'school.invalidAnswers');
        for (const a of body.answers) if (a !== null && (!Number.isInteger(a) || a < 0)) return fail(400, 'school.invalidAnswers');
        const score = delivered.reduce((sum, q, i) => sum + (body.answers[i] === q.answer ? q.points : 0), 0);
        const total = delivered.reduce((s, q) => s + q.points, 0);
        const review = delivered.map((q) => ({ answer: q.answer, explanation: q.explanation }));
        if (staff) {
          // Author preview: always the full answer key, regardless of `revealAnswers` (that setting gates what
          // students/parents/other viewers see, never the quiz's own author).
          const attempt = { studentId: typeof body.studentId === 'string' ? body.studentId : '', quizId, score, total, answers: body.answers, at: new Date().toISOString(), timeTaken: Number.isFinite(body.timeTaken) ? body.timeTaken : 0, review, preview: true };
          return { status: 200, body: { data: attempt } };
        }
        const visibleReview = quiz.revealAnswers === false ? [] : review;
        const attemptKey = `${identity.id}|${quizId}`;
        const existing = state.quizAttempts.get(attemptKey);
        if (existing) {
          // Reading/retrying an already-committed attempt is always allowed, even after the quiz has since closed —
          // only a brand-new attempt (below) requires the quiz to still be open.
          const sameAnswers = Array.isArray(existing.answers) && existing.answers.length === body.answers.length && existing.answers.every((v, i) => v === body.answers[i]);
          if (sameAnswers) return { status: 200, body: { data: { ...existing, review: visibleReview } } };
          return fail(409, 'school.alreadyAttempted');
        }
        if (quiz.status !== 'Published') return fail(409, 'school.quizNotAvailable');
        const attempt = { studentId: identity.id, quizId, score, total, answers: body.answers, at: new Date().toISOString(), timeTaken: Number.isFinite(body.timeTaken) ? body.timeTaken : 0 };
        state.quizAttempts.set(attemptKey, attempt);
        return { status: 201, body: { data: { ...attempt, review: visibleReview } } };
      }

      /* ---- question bank (new; authors only) ---- */
      if (path === '/question-bank') {
        if (method !== 'GET') return fail(405, 'school.methodNotAllowed');
        if (!isStaffRole(schoolRole)) return fail(403, 'school.authorsOnly');
        const subjectId = params.get('subjectId') ?? '';
        const bank = QUESTION_BANK[subjectId] ?? [];
        return { status: 200, body: { data: bank.map((q, i) => ({ ...q, id: `bank-${subjectId}-${i}`, points: 1 })) } };
      }

      /* ---- live classroom room state (new) ---- */
      let liveMatch = /^\/live\/([^/]+)\/room$/.exec(path);
      if (liveMatch) {
        if (method !== 'GET') return fail(405, 'school.methodNotAllowed');
        const liveRow = fixture.live.find((l) => l.id === decodeURIComponent(liveMatch[1]));
        if (!liveRow) return fail(404, 'school.notFound');
        if (!canAccessLive(fixture, schoolRole, identity, children, liveRow)) return fail(403, 'school.notPermitted');
        const room = roomState(fixture, state, liveRow);
        return { status: 200, body: { data: shapeRoom(room, identity, schoolRole) } };
      }
      liveMatch = /^\/live\/([^/]+)\/actions$/.exec(path);
      if (liveMatch) {
        if (method !== 'POST') return fail(405, 'school.methodNotAllowed');
        const liveRow = fixture.live.find((l) => l.id === decodeURIComponent(liveMatch[1]));
        if (!liveRow) return fail(404, 'school.notFound');
        if (!canAccessLive(fixture, schoolRole, identity, children, liveRow)) return fail(403, 'school.notPermitted');
        if (typeof body !== 'object' || body === null || typeof body.action !== 'string') return fail(400, 'school.expectedAction');
        const room = roomState(fixture, state, liveRow);
        const err = applyLiveAction(fixture, room, identity, schoolRole, body);
        if (err) return err;
        return { status: 200, body: { data: shapeRoom(room, identity, schoolRole) } };
      }

      /* ---- school profile and fee tariff (new) ---- */
      if (path === '/school-profile') { if (method !== 'GET') return fail(405, 'school.methodNotAllowed'); return { status: 200, body: { data: SCHOOL_PROFILE } }; }
      if (path === '/fee-structure') { if (method !== 'GET') return fail(405, 'school.methodNotAllowed'); return { status: 200, body: FEE_STRUCTURE }; }

      /* ---- contacts (new) ---- */
      if (path === '/contacts') { if (method !== 'GET') return fail(405, 'school.methodNotAllowed'); return { status: 200, body: { data: CONTACTS_FIXTURE } }; }

      /* ---- leave requests (new) ---- */
      if (path === '/leave-requests') {
        if (method !== 'POST') return fail(405, 'school.methodNotAllowed');
        if (schoolRole !== 'student' && schoolRole !== 'parent' && schoolRole !== 'admin') return fail(403, 'school.writeDenied');
        if (typeof body !== 'object' || body === null || typeof body.studentId !== 'string' || typeof body.from !== 'string' || typeof body.to !== 'string' || typeof body.reason !== 'string' || !body.reason.trim()) return fail(400, 'school.expectedLeaveRequest');
        if (schoolRole !== 'admin' && !ownsStudent(schoolRole, identity, children, body.studentId)) return fail(403, 'school.notOwn');
        const student = fixture.students.find((s) => s.id === body.studentId);
        if (!student) return fail(404, 'school.notFound');
        const id = `lr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        state.leaveRequests.push({ id, studentId: body.studentId, from: body.from, to: body.to, reason: body.reason, status: 'Pending', requestedBy: schoolRole, at: new Date().toISOString() });
        return { status: 201, body: { data: { id } } };
      }

      /* ---- library reservations (new) ---- */
      if (path === '/reservations') {
        if (method !== 'POST') return fail(405, 'school.methodNotAllowed');
        if (schoolRole === 'accountant') return fail(403, 'school.notPermitted');
        if (typeof body !== 'object' || body === null || typeof body.bookId !== 'string' || typeof body.memberId !== 'string') return fail(400, 'school.expectedReservation');
        if (schoolRole !== 'admin' && schoolRole !== 'librarian') {
          const allowed = identity.id === body.memberId || (schoolRole === 'parent' && children.includes(body.memberId));
          if (!allowed) return fail(403, 'school.notOwn');
        }
        const book = fixture.books.find((b) => b.id === body.bookId);
        if (!book) return fail(404, 'school.bookNotFound');
        const id = `rs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        state.reservations.push({ id, bookId: body.bookId, memberId: body.memberId, status: book.available > 0 ? 'Reserved' : 'Waitlisted', at: new Date().toISOString() });
        return { status: 201, body: { data: { id } } };
      }

      /* ---- fee reminders (new) ---- */
      if (path === '/invoices/reminders') {
        if (method !== 'POST') return fail(405, 'school.methodNotAllowed');
        if (schoolRole !== 'admin' && schoolRole !== 'accountant') return fail(403, 'school.writeDenied');
        if (typeof body !== 'object' || body === null || !Array.isArray(body.invoiceIds)) return fail(400, 'school.expectedInvoiceIds');
        const validIds = new Set(fixture.invoices.map((i) => i.id));
        const sent = body.invoiceIds.filter((id) => validIds.has(id)).length;
        return { status: 200, body: { data: { sent } } };
      }

      /* ---- attachments (new) ---- */
      if (path === '/attachments') {
        if (method !== 'POST') return fail(405, 'school.methodNotAllowed');
        if (typeof body !== 'object' || body === null) return fail(400, 'school.malformedBody');
        if (!['assignment', 'submission', 'message'].includes(body.purpose)) return fail(400, 'school.invalidPurpose');
        if (!canCreateAttachment(schoolRole, body.purpose)) return fail(403, 'school.writeDenied');
        const attName = sanitizeAttachmentName(body.name);
        if (!attName) return fail(400, 'school.invalidAttachmentName');
        if (typeof body.type !== 'string' || !ATTACHMENT_TYPES.has(body.type)) return fail(400, 'school.invalidAttachmentType');
        if (typeof body.content !== 'string' || !BASE64_RE.test(body.content)) return fail(400, 'school.invalidAttachment');
        const attSize = Buffer.from(body.content, 'base64').length;
        if (!attSize) return fail(400, 'school.invalidAttachment');
        if (attSize > ATTACHMENT_MAX_BYTES) return fail(413, 'school.attachmentTooLarge');
        const attId = `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        state.attachments.set(attId, { id: attId, name: attName, type: body.type, size: attSize, content: body.content, purpose: body.purpose, ownerId: identity.id, ownerRole: schoolRole, createdAt: now.toISOString(), context: null });
        return { status: 201, body: { data: { id: attId, name: attName, type: body.type, size: attSize, downloadPath: `/attachments/${attId}` } } };
      }
      let attachmentMatch = /^\/attachments\/([^/]+)$/.exec(path);
      if (attachmentMatch) {
        if (method !== 'GET') return fail(405, 'school.methodNotAllowed');
        const record = state.attachments.get(decodeURIComponent(attachmentMatch[1]));
        if (!record) return fail(404, 'school.notFound');
        if (!canAccessAttachment(fixture, schoolRole, identity, children, record)) return fail(403, 'school.notPermitted');
        return { status: 200, body: { data: { id: record.id, name: record.name, type: record.type, size: record.size, content: record.content } } };
      }

      /* ---- settings (new) ---- */
      if (path === '/settings' || path === '/settings/password' || /^\/settings\/sessions\//.test(path)) return handleSettings(path, method, body, state, identity);

      /* ---- generic resource collection ---- */
      let m = /^\/([a-zA-Z-]+)$/.exec(path);
      if (m && RESOURCES.includes(m[1])) {
        const resource = m[1];
        if (!canReadResource(schoolRole, resource)) return fail(403, 'school.notPermitted');
        const rows = collection(fixture, resource, now);
        if (method === 'GET') {
          let scoped = rows;
          if (resource === 'students') { if (schoolRole === 'student') scoped = rows.filter((r) => r.id === identity.id); else if (schoolRole === 'parent') scoped = rows.filter((r) => children.includes(r.id)); }
          if (resource === 'invoices') { if (schoolRole === 'student') scoped = rows.filter((r) => r.studentId === identity.id); else if (schoolRole === 'parent') scoped = rows.filter((r) => children.includes(r.studentId)); }
          if (resource === 'issues') { if (schoolRole === 'student' || schoolRole === 'teacher') scoped = rows.filter((r) => r.memberId === identity.id); else if (schoolRole === 'parent') scoped = rows.filter((r) => children.includes(r.memberId)); }
          if (resource === 'threads') scoped = rows.filter((r) => r.owner === schoolRole);
          if (resource === 'admissions' && !['admin'].includes(schoolRole)) return fail(403, 'school.writeDenied');
          if (resource === 'quizzes') {
            // A quiz's audience is its own class: a student (or a parent, for their children) never lists a quiz
            // set for a class they don't belong to, regardless of the classId the request asks to filter by.
            if (schoolRole === 'student') { const myClass = fixture.students.find((s) => s.id === identity.id)?.classId; scoped = scoped.filter((q) => q.classId === myClass); }
            else if (schoolRole === 'parent') scoped = scoped.filter((q) => children.some((cid) => fixture.students.find((s) => s.id === cid)?.classId === q.classId));
            if (!isStaffRole(schoolRole)) scoped = scoped.map((q) => sanitizeQuiz(q, false));
          }
          return { status: 200, body: genericQuery(scoped, params) };
        }
        if (method === 'POST') {
          if (!canWriteResource(schoolRole, resource, identity, fixture, null, body)) return fail(403, 'school.writeDenied');
          if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'school.malformedBody');
          /* Attachment ids are only linked (mutated) after the whole batch validates, so a bad id in the list
             fails the create atomically instead of linking some files and rejecting others. */
          let newAttachments = null;
          if (resource === 'assignments' && body.attachments !== undefined) {
            const check = validateAttachmentIds(state, body.attachments, 'assignment', identity, schoolRole);
            if (!check.ok) return fail(400, 'school.invalidAttachments');
            newAttachments = check.records;
          }
          const created = { ...body, id: `${resource.slice(0, 2)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
          if (newAttachments) { newAttachments.forEach((r) => { r.context = { assignmentId: created.id }; }); created.attachments = canonicalAttachments(newAttachments); }
          if (schoolRole === 'teacher' && TEACHER_TRANSACTIONAL.has(resource)) created.teacherId = identity.id;
          /* Aggregate/demo counters are always computed server-side from real state, never trusted from the
             creating client (API-CONTRACT.md: "submitted/graded/total are server-initialized", likewise books'
             available/rating/cover and classes'/quizzes' rollups) — a bad reference fails the create atomically,
             before anything is pushed into the fixture. */
          if (resource === 'students') {
            const cls = fixture.classes.find((c) => c.id === body.classId);
            if (!cls) return fail(422, 'school.unknownClass');
            const count = fixture.students.filter((s) => s.classId === body.classId).length;
            Object.assign(created, { admissionNo: `NB/${new Date().getFullYear()}/${String(5000 + fixture.students.length).padStart(5, '0')}`, rollNo: count + 1, status: 'Active', attendancePct: 100, gpa: 0, feeStatus: 'Due', ability: 0.75, joinedOn: isoDay(now) });
            cls.strength += 1;
          }
          if (resource === 'teachers') Object.assign(created, { empId: `NB-EMP-${2100 + fixture.teachers.length}`, status: 'Active', rating: 0, weeklyPeriods: 0 });
          if (resource === 'classes') {
            if (body.classTeacherId != null && !fixture.teachers.find((t) => t.id === body.classTeacherId)) return fail(422, 'school.unknownTeacher');
            Object.assign(created, { strength: 0, avgScore: 0 });
          }
          if (resource === 'books') {
            const copies = body.copies;
            if (!Number.isInteger(copies) || copies < 0) return fail(400, 'school.invalidCopies');
            const title = typeof body.title === 'string' ? body.title : '';
            Object.assign(created, { copies, available: copies, rating: 0, cover: COVERS[title.length % COVERS.length] });
          }
          if (resource === 'quizzes') {
            if (!fixture.classes.find((c) => c.id === body.classId)) return fail(422, 'school.unknownClass');
            if (created.teacherId != null && !fixture.teachers.find((t) => t.id === created.teacherId)) return fail(422, 'school.unknownTeacher');
            Object.assign(created, { attempts: 0, avgScore: 0 });
          }
          if (resource === 'assignments') {
            if (!fixture.classes.find((c) => c.id === body.classId)) return fail(422, 'school.unknownClass');
            if (created.teacherId != null && !fixture.teachers.find((t) => t.id === created.teacherId)) return fail(422, 'school.unknownTeacher');
            Object.assign(created, { submitted: 0, graded: 0, total: fixture.students.filter((s) => s.classId === body.classId).length });
          }
          if (resource === 'issues') {
            const book = fixture.books.find((b) => b.id === body.bookId);
            if (!book) return fail(404, 'school.bookNotFound');
            if (book.available < 1) return fail(409, 'school.noCopiesAvailable');
            book.available -= 1;
            Object.assign(created, { bookTitle: book.title, returnedOn: null, status: 'Issued', fine: 0 });
          }
          if (resource === 'live') { Object.assign(created, { attendees: 0, capacity: 40 }); fixture.live.push(created); return { status: 201, body: { data: created } }; }
          if (resource === 'admissions') Object.assign(created, { applicationNo: `APP-27-${String(400 + fixture.admissions.length).padStart(4, '0')}`, stage: 'Applied', score: null, appliedOn: isoDay(now) });
          if (resource === 'threads') created.owner = schoolRole;
          fixture[resource].unshift(created);
          return { status: 201, body: { data: created } };
        }
        return fail(405, 'school.methodNotAllowed');
      }

      /* ---- generic resource item ---- */
      m = /^\/([a-zA-Z-]+)\/([^/]+)$/.exec(path);
      if (m && RESOURCES.includes(m[1])) {
        const resource = m[1];
        if (!canReadResource(schoolRole, resource)) return fail(403, 'school.notPermitted');
        const id = decodeURIComponent(m[2]);
        const rows = resource === 'live' ? fixture.live : fixture[resource];
        if (method === 'GET') {
          const row = resource === 'live' ? collection(fixture, 'live', now).find((r) => r.id === id) : rows.find((r) => r.id === id);
          if (!row) return fail(404, 'school.notFound');
          if (resource === 'students' && !ownsStudent(schoolRole, identity, children, id) && schoolRole !== 'admin' && schoolRole !== 'teacher') return fail(403, 'school.notOwn');
          if (resource === 'threads' && row.owner !== schoolRole && schoolRole !== 'admin') return fail(403, 'school.notOwn');
          if (resource === 'quizzes') {
            if (schoolRole === 'student' && fixture.students.find((s) => s.id === identity.id)?.classId !== row.classId) return fail(403, 'school.notOwn');
            if (schoolRole === 'parent' && !children.some((cid) => fixture.students.find((s) => s.id === cid)?.classId === row.classId)) return fail(403, 'school.notOwn');
            return { status: 200, body: { data: sanitizeQuiz(row, isStaffRole(schoolRole)) } };
          }
          return { status: 200, body: { data: row } };
        }
        if (method === 'PATCH') {
          const row = rows.find((r) => r.id === id);
          if (!row) return fail(404, 'school.notFound');
          if (!canWriteResource(schoolRole, resource, identity, fixture, row, body)) return fail(403, 'school.writeDenied');
          if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'school.malformedBody');
          if (resource === 'invoices') {
            /* The source form only ever sends `payAmount` (+ `method`): that is the ONLY way money moves on an
               invoice. Any other direct field (paid, status, receiptNo, receiptSent, lastPaymentOn, amount) is
               never client-settable — a request without a valid positive payAmount is a pure no-op, not a write,
               so it can never bypass the validated-payment path below to fabricate a partial payment/timestamp,
               forge a receipt, or move the invoice below its already-paid amount. */
            if (typeof body.payAmount === 'number') {
              if (!Number.isFinite(body.payAmount) || body.payAmount < 0) return fail(400, 'school.invalidAmount');
              if (row.paid + body.payAmount > row.amount) return fail(409, 'school.overpayment');
              if (body.payAmount > 0) {
                row.paid += body.payAmount;
                row.status = row.paid >= row.amount ? 'Paid' : 'Partial';
                row.lastPaymentOn = isoDay(now);
                row.method = String(body.method ?? 'Card');
                /* Synthetic receipt/notification: a receipt number is only issued for an actual positive payment,
                   from a per-scope sequence (never re-derived from Date.now or a client value). `receiptSent` is
                   true only when this demo backend records a real notification-outbox entry (here: the payment
                   fully settles the invoice) — it never claims a real email/SMS was sent. */
                state.receiptSeq += 1;
                row.receiptNo = `RCT-${scope.branchId}-${String(state.receiptSeq).padStart(6, '0')}`;
                row.receiptSent = row.status === 'Paid';
                if (row.receiptSent) state.notificationOutbox.push({ id: `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, invoiceId: row.id, receiptNo: row.receiptNo, at: now.toISOString() });
                const s = fixture.students.find((x) => x.id === row.studentId);
                if (s) { const mine = fixture.invoices.filter((i) => i.studentId === s.id); s.feeStatus = mine.some((i) => i.status === 'Overdue') ? 'Overdue' : mine.some((i) => i.status === 'Partial') ? 'Partial' : mine.some((i) => i.status === 'Due') ? 'Due' : 'Paid'; }
              }
            }
            return { status: 200, body: { data: row } };
          }
          if (resource === 'issues' && body.action === 'return') {
            if (row.status !== 'Returned') {
              row.status = 'Returned';
              row.returnedOn = isoDay(now);
              /* Authoritative fine, computed once at the actual return (never the client's estimate of "today"):
                 the source's own policy is $0.5/day late (see reference-school/src/pages/library.tsx FINE_PER_DAY),
                 applied to the real elapsed days between the due date and this return date. An already-returned
                 issue is left untouched above, so a repeated return can never double the fine or the book's stock. */
              const daysLate = Math.max(0, Math.round((toDate(row.returnedOn).getTime() - toDate(row.dueOn).getTime()) / 86400000));
              row.fine = Math.round(daysLate * 0.5 * 100) / 100;
              const book = fixture.books.find((b) => b.id === row.bookId);
              if (book) book.available += 1;
            }
            return { status: 200, body: { data: row } };
          }
          let assignmentAttachmentsPatch = null;
          if (resource === 'assignments' && body.attachments !== undefined) {
            const check = validateAttachmentIds(state, body.attachments, 'assignment', identity, schoolRole);
            if (!check.ok) return fail(400, 'school.invalidAttachments');
            check.records.forEach((r) => { r.context = { assignmentId: row.id }; });
            assignmentAttachmentsPatch = canonicalAttachments(check.records);
          }
          let sanitizedMessages = null;
          if (resource === 'threads' && Array.isArray(body.messages)) {
            /* Validate every message's shape/attachment ids before linking any of them, so one bad entry fails the
               whole patch instead of leaving some messages linked/forged and the request rejected. An id already
               present in this thread must reproduce that exact stored message byte-for-byte — from, text, at AND
               its attachment links — (append-only, no rewriting or unlinking past history); a brand-new id may
               only ever be authored "from" the caller themself — never fabricated as if it came "from" the other
               party, which is the only other actor a thread ever names. The real client always resends its full,
               untouched history plus one new message, so this never rejects the normal append flow — only a
               payload that drops, reorders-away or edits a previously persisted id. */
            const existingById = new Map(row.messages.map((m) => [m.id, m]));
            const seenExistingIds = new Set();
            const messageChecks = new Map();
            for (const msg of body.messages) {
              if (!msg || typeof msg.id !== 'string' || (msg.from !== 'me' && msg.from !== 'them') || typeof msg.text !== 'string') return fail(400, 'school.invalidMessage');
              const prior = existingById.get(msg.id);
              if (prior) {
                const priorAttIds = (prior.attachments ?? []).map((a) => a.id).join('|');
                const msgAttIds = Array.isArray(msg.attachments) ? msg.attachments.map((a) => extractAttachmentId(a) ?? '').join('|') : '';
                if (prior.from !== msg.from || prior.text !== msg.text || String(prior.at) !== String(msg.at) || priorAttIds !== msgAttIds) return fail(400, 'school.messageImmutable');
                seenExistingIds.add(msg.id);
              } else {
                if (msg.from !== 'me') return fail(403, 'school.messageImpersonation');
                if (msg.attachments !== undefined) {
                  const check = validateAttachmentIds(state, msg.attachments, 'message', identity, schoolRole);
                  if (!check.ok) return fail(400, 'school.invalidAttachments');
                  messageChecks.set(msg, check);
                }
              }
            }
            if (seenExistingIds.size !== existingById.size) return fail(400, 'school.messageHistoryDropped');
            messageChecks.forEach((check) => check.records.forEach((r) => { r.context = { threadId: row.id }; }));
            /* Never trust a client-supplied attachment object's own name/size/path — only its `id` is resolved
               (above), and the message stores the resulting canonical SchoolAttachment[], never the raw body. */
            sanitizedMessages = body.messages.map((msg) => (messageChecks.has(msg) ? { ...msg, attachments: canonicalAttachments(messageChecks.get(msg).records) } : msg));
          }
          /* Aggregate/derived fields are always recomputed from real state below, never taken from the body —
             capture the source-of-truth values (and validate any reference the body does carry) before the
             generic merge can plant a forged value, then restore/apply them after it. */
          let bookAggregatePatch = null;
          if (resource === 'books') {
            const issuedOut = fixture.issues.filter((i) => i.bookId === row.id && i.status !== 'Returned').length;
            let nextCopies = row.copies;
            if (body.copies !== undefined) {
              if (!Number.isInteger(body.copies) || body.copies < 0) return fail(400, 'school.invalidCopies');
              if (body.copies < issuedOut) return fail(409, 'school.copiesBelowIssued');
              nextCopies = body.copies;
            }
            const nextCover = typeof body.title === 'string' && body.title.trim() ? COVERS[body.title.length % COVERS.length] : row.cover;
            bookAggregatePatch = { copies: nextCopies, available: nextCopies - issuedOut, rating: row.rating, cover: nextCover };
          }
          let classAggregatePatch = null;
          if (resource === 'classes') {
            if (body.classTeacherId != null && !fixture.teachers.find((t) => t.id === body.classTeacherId)) return fail(422, 'school.unknownTeacher');
            classAggregatePatch = { strength: row.strength, avgScore: row.avgScore };
          }
          let quizAggregatePatch = null;
          if (resource === 'quizzes') {
            if (body.classId !== undefined && !fixture.classes.find((c) => c.id === body.classId)) return fail(422, 'school.unknownClass');
            if (body.teacherId != null && !fixture.teachers.find((t) => t.id === body.teacherId)) return fail(422, 'school.unknownTeacher');
            quizAggregatePatch = { attempts: row.attempts, avgScore: row.avgScore };
          }
          let assignmentAggregatePatch = null;
          if (resource === 'assignments') {
            if (body.classId !== undefined && !fixture.classes.find((c) => c.id === body.classId)) return fail(422, 'school.unknownClass');
            if (body.teacherId != null && !fixture.teachers.find((t) => t.id === body.teacherId)) return fail(422, 'school.unknownTeacher');
            assignmentAggregatePatch = { submitted: row.submitted, graded: row.graded, total: row.total };
          }
          // feeStatus, gpa and attendancePct are all derived server-side (from invoices, marks and attendance
          // records respectively) — never client-settable, while authored registration fields (house, phone,
          // guardian details, etc.) still merge normally below.
          const studentAggregatePatch = resource === 'students' ? { feeStatus: row.feeStatus, gpa: row.gpa, attendancePct: row.attendancePct } : null;
          /* `owner` is server-assigned (see the POST handler) and is what canWriteResource just checked above the
             caller against; the body must never be able to overwrite it and re-point a thread at another role. */
          const { id: _ignoredId, owner: _ignoredOwner, ...patch } = body;
          Object.assign(row, patch);
          if (assignmentAttachmentsPatch) row.attachments = assignmentAttachmentsPatch;
          if (sanitizedMessages) row.messages = sanitizedMessages;
          if (bookAggregatePatch) Object.assign(row, bookAggregatePatch);
          if (classAggregatePatch) Object.assign(row, classAggregatePatch);
          if (quizAggregatePatch) Object.assign(row, quizAggregatePatch);
          if (assignmentAggregatePatch) Object.assign(row, assignmentAggregatePatch);
          if (studentAggregatePatch) Object.assign(row, studentAggregatePatch);
          return { status: 200, body: { data: row } };
        }
        if (method === 'DELETE') {
          if (!canWriteResource(schoolRole, resource, identity, fixture, rows.find((r) => r.id === id), null)) return fail(403, 'school.writeDenied');
          const idx = rows.findIndex((r) => r.id === id);
          if (idx < 0) return fail(404, 'school.notFound');
          const [removed] = rows.splice(idx, 1);
          // The roster count a student's own create incremented (POST /students) is symmetrically decremented here,
          // so a class's `strength` never drifts from its actual, live student count.
          if (resource === 'students') { const cls = fixture.classes.find((c) => c.id === removed.classId); if (cls) cls.strength = Math.max(0, cls.strength - 1); }
          return { status: 200, body: { data: { id } } };
        }
        return fail(405, 'school.methodNotAllowed');
      }

      return fail(404, 'school.unknownRoute', { path });
    },
  };
}

function markFor(fixture, state, studentId, subjectId, termId) {
  const override = state.marks.get(`${termId}|${studentId}|${subjectId}`);
  if (override !== undefined) return override;
  const term = TERMS.find((t) => t.id === termId);
  if (!term || term.status !== 'Completed') return null;
  const s = fixture.students.find((x) => x.id === studentId);
  return s ? generatedMark(s, subjectId, termId, term.max) : null;
}
function attendanceFor(fixture, state, studentId, date, now) {
  const override = state.attendance.get(`${studentId}|${date}`);
  if (override !== undefined) return override;
  const d = toDate(date);
  const wd = d.getDay();
  if (wd === 0 || wd === 6) return null;
  if (d > now) return null;
  const s = fixture.students.find((x) => x.id === studentId);
  return s ? generatedAttendance(s, date) : null;
}
/** Merges a submission PATCH override (see the /submissions handler) into the deterministically-generated
    base, so a later GET reflects an earlier PATCH for the same assignment/student. */
function submissionsFor(fixture, state, assignmentId) {
  return generateSubmissions(fixture, assignmentId).map((s) => {
    const override = state.marks.get(`submission-override|submissions|${assignmentId}|${s.studentId}`);
    return override ? { ...s, ...override } : s;
  });
}
function ownsStudent(schoolRole, identity, children, studentId) {
  if (schoolRole === 'student') return identity.id === studentId;
  if (schoolRole === 'parent') return children.includes(studentId);
  return false;
}

/* ───────────────────────── live classroom room state (new) ───────────────────────── */
function canAccessLive(fixture, schoolRole, identity, children, liveRow) {
  if (schoolRole === 'admin') return true;
  if (schoolRole === 'teacher') return liveRow.teacherId === identity.id || teacherClassIds(fixture, identity.id).includes(liveRow.classId);
  if (schoolRole === 'student') return fixture.students.find((s) => s.id === identity.id)?.classId === liveRow.classId;
  if (schoolRole === 'parent') return children.some((cid) => fixture.students.find((s) => s.id === cid)?.classId === liveRow.classId);
  return false;
}
function seedLiveRoom(fixture, liveRow) {
  const rng = mulberry32(hashStr(`room|${liveRow.id}`));
  const roster = fixture.students.filter((s) => s.classId === liveRow.classId);
  const teacher = fixture.teachers.find((t) => t.id === liveRow.teacherId);
  const count = Math.min(roster.length, 6);
  const participants = [];
  if (teacher) participants.push({ id: teacher.id, name: teacher.name, role: 'Teacher', mic: true, cam: true, hand: false, speaking: false });
  for (let i = 0; i < count; i++) { const s = roster[i]; participants.push({ id: s.id, name: s.name, role: 'Student', mic: rng() > 0.7, cam: rng() > 0.4, hand: false, speaking: false }); }
  return {
    liveId: liveRow.id, hostId: liveRow.teacherId, classId: liveRow.classId, subjectId: liveRow.subjectId,
    participants,
    messages: teacher ? [{ id: 'm-1', fromId: teacher.id, from: teacher.name, text: 'Welcome everyone!', at: Date.now() }] : [],
    poll: null,
    scores: Object.fromEntries(participants.map((p) => [p.name, 0])),
    recording: false,
    startedAt: Date.now(),
  };
}
function roomState(fixture, state, liveRow) {
  let room = state.liveRooms.get(liveRow.id);
  if (!room) { room = seedLiveRoom(fixture, liveRow); state.liveRooms.set(liveRow.id, room); }
  return room;
}
function shapeRoom(room, identity, schoolRole) {
  const staff = isStaffRole(schoolRole);
  const people = room.participants.filter((p) => p.id !== identity.id).map(({ id, name, role, mic, cam, hand, speaking }) => ({ id, name, role, mic, cam, hand, speaking }));
  const messages = room.messages.map((m) => ({ id: m.id, from: m.from, text: m.text, at: m.at, ...(m.fromId === identity.id ? { me: true } : {}) }));
  let poll = null;
  if (room.poll) {
    const revealed = staff || !room.poll.open;
    poll = { q: room.poll.q, options: room.poll.options, votes: [...room.poll.votes], mine: room.poll.voters.has(identity.id) ? room.poll.voters.get(identity.id) : null, open: room.poll.open, n: room.poll.n, ...(revealed ? { answer: room.poll.answer } : {}) };
  }
  return { people, messages, poll, scores: { ...room.scores }, recording: room.recording, elapsed: Math.max(0, Math.floor((Date.now() - room.startedAt) / 1000)) };
}
function ensureParticipant(room, identity, schoolRole) {
  let me = room.participants.find((p) => p.id === identity.id);
  if (!me) { me = { id: identity.id, name: identity.name, role: schoolRole.charAt(0).toUpperCase() + schoolRole.slice(1), mic: false, cam: false, hand: false, speaking: false }; room.participants.push(me); }
  return me;
}
function applyLiveAction(fixture, room, identity, schoolRole, action) {
  const isHost = room.hostId === identity.id || schoolRole === 'admin';
  switch (action.action) {
    case 'join': { const me = ensureParticipant(room, identity, schoolRole); me.mic = !!action.enabled; return null; }
    case 'leave': { room.participants = room.participants.filter((p) => p.id !== identity.id); return null; }
    case 'end': {
      if (!isHost) return fail(403, 'school.hostOnly');
      room.poll = null;
      // Persist the ended state onto the underlying mock session (not just this in-memory room), so the class
      // actually shows Ended on a later /live list/detail or /stats call, not just for the room the host was in.
      // Idempotent: a retry (or the host closing twice) never moves an already-recorded end time.
      const liveRow = fixture.live.find((l) => l.id === room.liveId);
      if (liveRow && !liveRow.endedAt) liveRow.endedAt = new Date().toISOString();
      return null;
    }
    case 'message': {
      if (typeof action.text !== 'string' || !action.text.trim()) return fail(400, 'school.expectedText');
      room.messages.push({ id: `m-${room.messages.length + 1}`, fromId: identity.id, from: identity.name, text: action.text, at: Date.now() });
      return null;
    }
    case 'poll-launch': {
      if (!isHost) return fail(403, 'school.hostOnly');
      const bank = QUESTION_BANK[room.subjectId] ?? [];
      const idx = Number(action.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= bank.length) return fail(400, 'school.invalidQuestionIndex');
      const q = bank[idx];
      const pollNumber = Number.isInteger(action.pollNumber) ? action.pollNumber : (room.poll?.n ?? 0) + 1;
      room.poll = { q: q.text, options: q.options, answer: q.answer, votes: q.options.map(() => 0), voters: new Map(), open: true, n: pollNumber };
      return null;
    }
    case 'poll-vote': {
      if (!room.poll || !room.poll.open) return fail(409, 'school.noOpenPoll');
      if (Number.isInteger(action.pollNumber) && action.pollNumber !== room.poll.n) return fail(409, 'school.pollMismatch');
      const idx = Number(action.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= room.poll.options.length) return fail(400, 'school.invalidVote');
      const previous = room.poll.voters.get(identity.id);
      if (previous !== undefined) room.poll.votes[previous] -= 1;
      room.poll.voters.set(identity.id, idx);
      room.poll.votes[idx] += 1;
      return null;
    }
    case 'poll-close': {
      if (!isHost) return fail(403, 'school.hostOnly');
      if (!room.poll) return fail(409, 'school.noOpenPoll');
      room.poll.open = false;
      for (const [voterId, idx] of room.poll.voters) { if (idx === room.poll.answer) { const p = room.participants.find((x) => x.id === voterId); if (p) room.scores[p.name] = (room.scores[p.name] ?? 0) + 1; } }
      return null;
    }
    case 'poll-end': { if (!isHost) return fail(403, 'school.hostOnly'); room.poll = null; return null; }
    case 'hand': {
      if (action.text === '*') { if (!isHost) return fail(403, 'school.hostOnly'); room.participants.forEach((p) => (p.hand = false)); return null; }
      const me = ensureParticipant(room, identity, schoolRole); me.hand = !!action.raised; return null;
    }
    case 'recording': { if (!isHost) return fail(403, 'school.hostOnly'); room.recording = !!action.enabled; return null; }
    case 'mute': {
      if (typeof action.text === 'string') {
        if (!isHost) return fail(403, 'school.hostOnly');
        if (action.text === '*') { room.participants.forEach((p) => (p.mic = false)); return null; }
        const target = room.participants.find((p) => p.id === action.text);
        if (!target) return fail(404, 'school.notFound');
        target.mic = !!action.enabled;
        return null;
      }
      const me = ensureParticipant(room, identity, schoolRole); me.mic = !!action.enabled; return null;
    }
    case 'camera': { const me = ensureParticipant(room, identity, schoolRole); me.cam = !!action.enabled; return null; }
    case 'reaction': { if (typeof action.emoji !== 'string' || !action.emoji) return fail(400, 'school.expectedEmoji'); return null; }
    default: return fail(400, 'school.unknownAction');
  }
}

function schedule(fixture, now, filter) {
  const wd = (now.getDay() + 6) % 7;
  const dayIdx = wd < 5 ? wd : 0;
  const slots = fixture.timetable.filter((t) => t.day === dayIdx && (filter.classId ? t.classId === filter.classId : t.teacherId === filter.teacherId)).sort((a, b) => a.period - b.period).map((t) => {
    const p = PERIODS.find((x) => x.no === t.period);
    const sub = fixture.subjects.find((s) => s.id === t.subjectId);
    return { ...t, start: p.start, end: p.end, label: p.label, subject: sub.name, color: sub.color, className: fixture.classes.find((c) => c.id === t.classId).name, teacher: t.teacherId ? fixture.teachers.find((x) => x.id === t.teacherId).name : 'Self study' };
  });
  return { dayLabel: wd < 5 ? 'Today' : 'Monday (next school day)', slots };
}
function attendanceTrend(fixture, state, now, ids, n = 20) {
  return schoolDays(n, fixture.today).map((d) => { const v = ids.map((id) => attendanceFor(fixture, state, id, d, now)).filter(Boolean); return { date: d, pct: v.length ? Math.round((v.filter((x) => x !== 'A').length / v.length) * 1000) / 10 : 0 }; });
}
/* The source ReportsPage (src/pages/reports.tsx) has the admin fetch BOTH `?role=admin` (their own) and
   `?role=accountant` (the finance projection) on the same screen — a read of an existing, already-admin-readable
   projection (admin can already read every invoice directly), never a change of who the caller actually is. This
   never touches the authenticated schoolRole or /session identity, and never accepts an arbitrary role: only this
   one named, recognized cross-role stats READ is permitted, and only for admin. */
const ADMIN_READABLE_STATS_ROLES = new Set(['accountant']);
function handleStats(method, params, fixture, state, now, schoolRole, identity, children) {
  if (method !== 'GET') return fail(405, 'school.methodNotAllowed');
  const role = params.get('role');
  const id = params.get('id') ?? '';
  const live = materializeLiveSessions(fixture.live, now, now);
  const parentViewingOwnChild = schoolRole === 'parent' && role === 'student';
  const adminViewingRecognizedRole = schoolRole === 'admin' && ADMIN_READABLE_STATS_ROLES.has(role);
  if (role !== schoolRole && !parentViewingOwnChild && !adminViewingRecognizedRole) return fail(403, 'school.roleMismatch');
  if (role === 'student' && !ownsStudent(schoolRole, identity, children, id || identity.id)) return fail(403, 'school.notOwn');
  const effectiveId = role === 'student' && schoolRole === 'parent' ? (children.includes(id) ? id : children[0]) : role === 'student' ? identity.id : id || identity.id;

  if (role === 'admin') {
    const active = fixture.students.filter((s) => s.status === 'Active');
    const trend = attendanceTrend(fixture, state, now, active.map((s) => s.id), 20);
    const billed = fixture.invoices.reduce((a, i) => a + i.amount, 0);
    const collected = fixture.invoices.reduce((a, i) => a + i.paid, 0);
    const byMonth = new Map();
    fixture.invoices.forEach((i) => { if (i.lastPaymentOn) byMonth.set(i.lastPaymentOn.slice(0, 7), (byMonth.get(i.lastPaymentOn.slice(0, 7)) ?? 0) + i.paid); });
    return { status: 200, body: { data: {
      students: active.length, teachers: fixture.teachers.length, classes: fixture.classes.length, subjects: fixture.subjects.length - 1,
      attendanceToday: trend.at(-1).pct, attendanceTrend: trend, billed, collected, overdueAccounts: fixture.invoices.filter((i) => i.status === 'Overdue').length,
      feeByMonth: [...byMonth.entries()].sort().map(([month, amount]) => ({ month, amount })),
      classPerformance: fixture.classes.map((c) => ({ label: c.name.replace('Grade ', ''), value: c.avgScore })),
      gender: { male: active.filter((s) => s.gender === 'Male').length, female: active.filter((s) => s.gender === 'Female').length },
      liveNow: live.filter((l) => l.status === 'Live'), upcomingLive: live.filter((l) => l.status === 'Scheduled').slice(0, 5),
      admissions: ['Applied', 'Screening', 'Interview', 'Offered', 'Enrolled', 'Declined'].map((s) => ({ stage: s, count: fixture.admissions.filter((a) => a.stage === s).length })),
      booksOut: fixture.issues.filter((i) => i.status !== 'Returned').length, overdueBooks: fixture.issues.filter((i) => i.status === 'Overdue').length,
      teachersOnLeave: fixture.teachers.filter((t) => t.status === 'On leave').length,
      recentAdmissions: [...fixture.admissions].sort((a, b) => b.appliedOn.localeCompare(a.appliedOn)).slice(0, 5),
      trends: { ...STATS_TREND_FIXTURES.admin },
    } } };
  }
  if (role === 'teacher') {
    const t = fixture.teachers.find((x) => x.id === identity.id);
    if (!t) return fail(404, 'school.notFound');
    const mine = fixture.assignments.filter((a) => a.teacherId === identity.id);
    const classIds = teacherClassIds(fixture, identity.id);
    const homeClass = fixture.classes.find((c) => c.classTeacherId === identity.id);
    const homeRoster = homeClass ? fixture.students.filter((s) => s.classId === homeClass.id) : [];
    const perf = classIds.map((cid) => { const roster = fixture.students.filter((s) => s.classId === cid); const vals = roster.map((s) => markFor(fixture, state, s.id, t.subjectIds[0], 'QTR')).filter((v) => v !== null); return { label: fixture.classes.find((c) => c.id === cid).name.replace('Grade ', ''), value: Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1)) }; });
    return { status: 200, body: { data: {
      teacher: t, schedule: schedule(fixture, now, { teacherId: identity.id }), classIds, homeClass,
      pendingGrading: mine.reduce((a, x) => a + Math.max(0, x.submitted - x.graded), 0),
      openAssignments: mine.filter((a) => a.status === 'Open').length,
      toGrade: mine.filter((a) => a.submitted > a.graded).sort((a, b) => b.dueDate.localeCompare(a.dueDate)).slice(0, 5),
      homeAttendance: homeRoster.length ? attendanceTrend(fixture, state, now, homeRoster.map((s) => s.id), 15) : [],
      performance: perf, live: live.filter((l) => l.teacherId === identity.id && l.status !== 'Ended').slice(0, 4), quizzes: fixture.quizzes.filter((q) => q.teacherId === identity.id).length,
    } } };
  }
  if (role === 'student') {
    const s = fixture.students.find((x) => x.id === effectiveId);
    if (!s) return fail(404, 'school.notFound');
    const cls = fixture.classes.find((c) => c.id === s.classId);
    const subs = EXAM_SUBJECTS(cls.grade);
    const subjectPerf = subs.map((sid) => { const sub = fixture.subjects.find((x) => x.id === sid); const roster = fixture.students.filter((x) => x.classId === s.classId); const avg = roster.reduce((a, r) => a + (markFor(fixture, state, r.id, sid, 'QTR') ?? 0), 0) / roster.length; return { label: sub.code, name: sub.name, value: markFor(fixture, state, s.id, sid, 'QTR') ?? 0, classAvg: Math.round(avg), color: sub.color }; });
    const assignments = fixture.assignments.filter((a) => a.classId === s.classId);
    const pending = assignments.filter((a) => a.status === 'Open' && !submissionsFor(fixture, state, a.id).find((x) => x.studentId === s.id && x.status !== 'Missing'));
    const days = schoolDays(60, fixture.today).map((d) => attendanceFor(fixture, state, s.id, d, now)).filter(Boolean);
    return { status: 200, body: { data: {
      student: s, class: cls, schedule: schedule(fixture, now, { classId: s.classId }),
      attendancePct: days.length ? Math.round((days.filter((x) => x !== 'A').length / days.length) * 1000) / 10 : 0,
      attendanceTrend: attendanceTrend(fixture, state, now, [s.id], 20), subjectPerf, pending: pending.slice(0, 6), pendingCount: pending.length,
      exams: fixture.exams.filter((e) => e.classId === s.classId && e.status === 'Scheduled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6),
      quizzes: fixture.quizzes.filter((q) => q.classId === s.classId && q.status === 'Published'),
      live: live.filter((l) => l.classId === s.classId && l.status !== 'Ended').slice(0, 4),
      books: fixture.issues.filter((i) => i.memberId === s.id && i.status !== 'Returned'), invoices: fixture.invoices.filter((i) => i.studentId === s.id),
      classTeacher: fixture.teachers.find((t) => t.id === cls.classTeacherId),
    } } };
  }
  if (role === 'librarian') {
    const cats = new Map();
    fixture.books.forEach((b) => cats.set(b.category, (cats.get(b.category) ?? 0) + b.copies));
    const trend = schoolDays(14, fixture.today).map((d) => ({ date: d, issued: fixture.issues.filter((i) => i.issuedOn === d).length, returned: fixture.issues.filter((i) => i.returnedOn === d).length }));
    return { status: 200, body: { data: {
      titles: fixture.books.length, copies: fixture.books.reduce((a, b) => a + b.copies, 0), available: fixture.books.reduce((a, b) => a + b.available, 0),
      issued: fixture.issues.filter((i) => i.status === 'Issued').length, overdue: fixture.issues.filter((i) => i.status === 'Overdue'),
      fines: fixture.issues.reduce((a, i) => a + i.fine, 0), categories: [...cats.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      trend, recent: [...fixture.issues].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn)).slice(0, 8), popular: [...fixture.books].sort((a, b) => (b.copies - b.available) - (a.copies - a.available)).slice(0, 5),
    } } };
  }
  if (role === 'accountant') {
    const billed = fixture.invoices.reduce((a, i) => a + i.amount, 0);
    const collected = fixture.invoices.reduce((a, i) => a + i.paid, 0);
    const byClass = fixture.classes.map((c) => { const inv = fixture.invoices.filter((i) => i.classId === c.id); const b = inv.reduce((a, i) => a + i.amount, 0); return { label: c.name.replace('Grade ', ''), value: b ? Math.round((inv.reduce((a, i) => a + i.paid, 0) / b) * 100) : 0 }; });
    const methods = new Map();
    fixture.invoices.forEach((i) => { if (i.method) methods.set(i.method, (methods.get(i.method) ?? 0) + i.paid); });
    const byMonth = new Map();
    fixture.invoices.forEach((i) => { if (i.lastPaymentOn) byMonth.set(i.lastPaymentOn.slice(0, 7), (byMonth.get(i.lastPaymentOn.slice(0, 7)) ?? 0) + i.paid); });
    return { status: 200, body: { data: {
      billed, collected, outstanding: billed - collected, overdue: fixture.invoices.filter((i) => i.status === 'Overdue'), partial: fixture.invoices.filter((i) => i.status === 'Partial').length,
      byClass, methods: [...methods.entries()].map(([label, value]) => ({ label, value })), byMonth: [...byMonth.entries()].sort().map(([month, amount]) => ({ month, amount })),
      recent: fixture.invoices.filter((i) => i.lastPaymentOn).sort((a, b) => b.lastPaymentOn.localeCompare(a.lastPaymentOn)).slice(0, 8),
      trends: { ...STATS_TREND_FIXTURES.accountant },
    } } };
  }
  if (role === 'parent') {
    return { status: 200, body: { data: { children: children.map((cid) => { const s = fixture.students.find((x) => x.id === cid); return s ? { studentId: cid, name: s.name } : null; }).filter(Boolean) } } };
  }
  return fail(400, 'school.unknownRole');
}

function defaultSettings(identity) {
  return {
    profile: { name: identity.name, email: identity.email, phone: '', language: 'en', timezone: 'Asia/Kolkata' },
    notifications: { assignments: [true, true, false], attendance: [true, false, false], fees: [true, true, false], notices: [true, false, false] },
    twoStepVerification: false,
    sessions: [{ id: 'session-current', name: 'This device', detail: 'Current session', current: true }],
    password: 'demo-password',
  };
}
function handleSettings(path, method, body, state, identity) {
  let entry = state.settings.get(identity.id);
  if (!entry) { entry = defaultSettings(identity); state.settings.set(identity.id, entry); }
  const publicShape = () => ({ profile: entry.profile, notifications: entry.notifications, twoStepVerification: entry.twoStepVerification, sessions: entry.sessions });
  if (path === '/settings') {
    if (method === 'GET') return { status: 200, body: { data: publicShape() } };
    if (method === 'PATCH') {
      if (typeof body !== 'object' || body === null) return fail(400, 'school.malformedBody');
      if (body.profile) entry.profile = { ...entry.profile, ...body.profile };
      if (body.notifications) entry.notifications = { ...entry.notifications, ...body.notifications };
      if (typeof body.twoStepVerification === 'boolean') entry.twoStepVerification = body.twoStepVerification;
      return { status: 200, body: { data: publicShape() } };
    }
    return fail(405, 'school.methodNotAllowed');
  }
  if (path === '/settings/password') {
    if (method !== 'POST') return fail(405, 'school.methodNotAllowed');
    if (typeof body !== 'object' || body === null) return fail(400, 'school.malformedBody');
    if (body.current !== entry.password) return fail(403, 'school.wrongPassword');
    if (typeof body.next !== 'string' || body.next.length < 8 || body.next !== body.confirm) return fail(400, 'school.invalidPassword');
    entry.password = body.next;
    return { status: 200, body: { data: { updated: true } } };
  }
  const m = /^\/settings\/sessions\/([^/]+)$/.exec(path);
  if (m) {
    if (method !== 'DELETE') return fail(405, 'school.methodNotAllowed');
    const id = decodeURIComponent(m[1]);
    const idx = entry.sessions.findIndex((s) => s.id === id);
    if (idx < 0) return fail(404, 'school.notFound');
    entry.sessions.splice(idx, 1);
    return { status: 200, body: { data: { id } } };
  }
  return fail(404, 'school.unknownRoute', { path });
}
