/* Fictional Scholaris fixtures for unit tests only (the backend owns production and demo data). Pure: no filesystem, clock, network or storage. Never imported by the public entry. */
import type { LiveSession, Role, Submission } from "../../lib/types";
import { SCHOOL } from "./profile";
import { addDays, gradeFor, hashStr, isoDay, toDate } from "../../lib/utils";
import { mulberry32 } from "./random";
import { createSeed, EXAM_SUBJECTS, fixtureDay, generatedAttendance, generatedMark, TERMS, type Seed, type SessionSeed } from "./seed";

export { DAYS, EXAM_SUBJECTS, fixtureDay, generatedAttendance, generatedMark, PERIODS, STUDY_HALL, TERMS } from "./seed";
export type { Seed, SessionSeed } from "./seed";
export { QUESTION_BANK } from "./bank";
export { mulberry32 } from "./random";

/** The source's fee tariff (per term), served as GET /fee-structure. */
export function feeStructureFixture(grades: number[] = [6, 7, 8, 9, 10, 11, 12]) {
  return {
    data: grades.map((g) => ({ g, tuition: 2100 + g * 60, lab: g >= 9 ? 180 : 90, library: 60, activities: 150, transport: 320 })),
    policy: { siblingDiscountPct: 10, lateFee: 25, lateAfterDays: 15 },
  };
}

/** Office contacts for GET /contacts (the source hardcoded them in the compose dialog). */
export const CONTACTS_FIXTURE = [
  { name: "Dr. Helen Okafor", role: "Principal" }, { name: "School Office", role: "Administration" },
  { name: "Grace Liu", role: "Finance Officer" }, { name: "Samuel Adeyemi", role: "Head Librarian" },
];

/** Canned replies a DEMO backend may append after a user message (PATCH /threads/:id). Never used by the client. */
export const DEMO_THREAD_REPLIES = ["Thanks for your message — I'll get back to you shortly.", "Noted, thank you!", "Sounds good. Let's discuss at the next meeting.", "Thank you, I've shared this with the team."];
export { gradeFor } from "../../lib/utils";

/** Fictional school profile shown on report cards and settings. */
export const SCHOOL_PROFILE = SCHOOL;

export interface SchoolIdentity { id: string; name: string; title: string; email: string }

/** The fictional people behind each portal. A demo backend maps an AUTHENTICATED user to one of these;
    the client never selects an identity from this table. */
export const SCHOOL_IDENTITIES: Record<Role, SchoolIdentity> = {
  admin: { id: "u-admin", name: "Dr. Helen Okafor", title: "Principal", email: "h.okafor@northbridge.edu" },
  teacher: { id: "t-001", name: "Priya Raman", title: "Mathematics · Class teacher 10-A", email: "p.raman@northbridge.edu" },
  student: { id: "s-1192", name: "Elena Vasquez", title: "Grade 10-A · Roll 1", email: "elena.v@students.northbridge.edu" },
  parent: { id: "p-vasquez", name: "Isabel Vasquez", title: "Parent of Elena & Mateo", email: "isabel.vasquez@mail.com" },
  librarian: { id: "u-lib", name: "Samuel Adeyemi", title: "Head Librarian", email: "s.adeyemi@northbridge.edu" },
  accountant: { id: "u-acc", name: "Grace Liu", title: "Finance Officer", email: "g.liu@northbridge.edu" },
};

export const PARENT_CHILDREN: Record<string, string[]> = { "p-vasquez": ["s-1192", "s-1072"] };

export interface SchoolFixture extends Seed {
  today: string;
  identities: Record<Role, SchoolIdentity>;
  parentChildren: Record<string, string[]>;
  school: typeof SCHOOL_PROFILE;
}

/** Last n weekdays (most recent last) up to and including `from`, skipping weekends. */
export function schoolDays(n: number, from: string | Date) {
  const out: string[] = [];
  let d = new Date(toDate(from));
  d.setHours(0, 0, 0, 0);
  while (out.length < n) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) out.unshift(isoDay(d));
    d = addDays(d, -1);
  }
  return out;
}

/** Deterministic fixture for one calendar day, including the derived attendance %, GPA and class averages the
    source computed when its server store was first built. */
export function seedSchoolFixture({ today }: { today: string | Date }): SchoolFixture {
  const day = fixtureDay(today);
  const seed = createSeed(day);
  const days = schoolDays(40, day);
  for (const s of seed.students) {
    const present = days.filter((d) => generatedAttendance(s, d) !== "A").length;
    s.attendancePct = Math.round((present / days.length) * 1000) / 10;
    const c = seed.classes.find((x) => x.id === s.classId)!;
    const subs = EXAM_SUBJECTS(c.grade);
    const pct = subs.reduce((a, sid) => a + generatedMark(s, sid, "QTR", 100), 0) / subs.length;
    s.gpa = Math.round(gradeFor(pct).point * 100) / 100;
  }
  for (const c of seed.classes) {
    const roster = seed.students.filter((s) => s.classId === c.id);
    const subs = EXAM_SUBJECTS(c.grade);
    c.avgScore = Math.round(roster.reduce((a, s) => a + subs.reduce((x, sid) => x + generatedMark(s, sid, "QTR", 100), 0) / subs.length, 0) / roster.length);
  }
  return {
    ...seed,
    today: isoDay(day),
    identities: structuredCloneIdentities(),
    parentChildren: Object.fromEntries(Object.entries(PARENT_CHILDREN).map(([k, v]) => [k, [...v]])),
    school: SCHOOL_PROFILE,
  };
}

function structuredCloneIdentities(): Record<Role, SchoolIdentity> {
  return Object.fromEntries(Object.entries(SCHOOL_IDENTITIES).map(([k, v]) => [k, { ...v }])) as Record<Role, SchoolIdentity>;
}

/** A term mark: stored override first, otherwise generated for completed terms, otherwise null. */
export function markFor(students: { id: string; ability: number }[], studentId: string, subjectId: string, termId: string, stored?: ReadonlyMap<string, number | null>) {
  const key = `${termId}|${studentId}|${subjectId}`;
  if (stored?.has(key)) return stored.get(key)!;
  const term = TERMS.find((t) => t.id === termId);
  if (!term || term.status !== "Completed") return null;
  const s = students.find((x) => x.id === studentId);
  return s ? generatedMark(s, subjectId, termId, term.max) : null;
}

/** Attendance for a day: stored override first; null on weekends and after `now`. */
export function attendanceFor(students: { id: string; ability: number }[], studentId: string, date: string, now: Date, stored?: ReadonlyMap<string, "P" | "A" | "L" | "E">) {
  const key = `${studentId}|${date}`;
  if (stored?.has(key)) return stored.get(key)!;
  const d = toDate(date);
  const wd = d.getDay();
  if (wd === 0 || wd === 6) return null;
  if (d > now) return null;
  const s = students.find((x) => x.id === studentId);
  return s ? generatedAttendance(s, date) : null;
}

/** Materializes seeded sessions against `now`: Scheduled before start, Live during, Ended after. */
export function materializeLiveSessions(live: SessionSeed[], anchor: Date, now: Date = anchor): LiveSession[] {
  const base = anchor.getTime();
  const at = now.getTime();
  return live
    .map((s) => {
      const start = s.start ? new Date(s.start).getTime() : base + (s.offsetMin ?? 0) * 60000;
      const end = start + s.durationMin * 60000;
      const status: LiveSession["status"] = at < start ? "Scheduled" : at < end ? "Live" : "Ended";
      const { offsetMin: _offset, ...rest } = s;
      return { ...rest, start: new Date(start).toISOString(), status, attendees: status === "Scheduled" ? 0 : rest.attendees };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Deterministic submissions for one assignment (the source generated these lazily on first read). */
export function generateSubmissions(fixture: Pick<Seed, "assignments" | "students">, assignmentId: string): Submission[] {
  const a = fixture.assignments.find((x) => x.id === assignmentId);
  if (!a) return [];
  const roster = fixture.students.filter((s) => s.classId === a.classId);
  const rng = mulberry32(hashStr(assignmentId));
  let submittedLeft = a.submitted;
  let gradedLeft = a.graded;
  return roster.map((s) => {
    const submitted = s.id === "s-1192" ? a.status === "Closed" : submittedLeft-- > 0;
    const graded = submitted && gradedLeft-- > 0;
    const late = submitted && rng() > 0.85;
    return {
      id: `${assignmentId}-${s.id}`, assignmentId, studentId: s.id, studentName: s.name,
      submittedOn: submitted ? isoDay(addDays(toDate(a.dueDate), -Math.floor(rng() * 3) + (late ? 1 : 0))) : null,
      status: graded ? "Graded" : submitted ? (late ? "Late" : "Submitted") : "Missing",
      marks: graded ? Math.round(a.maxMarks * Math.min(1, s.ability + (rng() - 0.4) * 0.2)) : null,
      feedback: graded ? ["Clear working, well done.", "Check your units in Q3.", "Good effort — revise the method in part (b).", "Excellent presentation."][Math.floor(rng() * 4)]! : "",
      text: submitted ? "Answers attached as PDF. Question 4 includes an extra worked example." : "",
    };
  });
}
