/* Test-only fictional backend + ReferenceHost. It answers the API-CONTRACT.md endpoints from seedSchoolFixture in
   memory so page tests exercise the real module through host.request. It is NOT the demo backend and makes no claim
   to reproduce every server rule; derivations are simplified where tests do not depend on them. */
import { DEFAULT_PREFERENCES, type PreferencePolicy, type UserPreferences } from "@pepbits/erp-config";
import type { ReferenceHost, ReferencePreferenceHost } from "@pepbits/reference-host";
import {
  attendanceFor, CONTACTS_FIXTURE, DEMO_THREAD_REPLIES, EXAM_SUBJECTS, feeStructureFixture, QUESTION_BANK, generateSubmissions, markFor, materializeLiveSessions, PERIODS, schoolDays, seedSchoolFixture, TERMS,
  type SchoolFixture,
} from "./fixtures";
import type {
  AccStats, AdminStats, AttachmentUpload, GradeRequest, LibStats, LiveRoomActionBody, LiveRoomState, QuizAttempt, SchoolSettings, SessionPayload, StudentStats, TeacherStats,
} from "../lib/contract";
import type { Role, Submission, Thread } from "../lib/types";
import { gradeFor, isoDay } from "../lib/utils";

export interface RecordedRequest { method: string; path: string; body?: unknown }
export class FakeHttpError extends Error { constructor(public status: number, message: string) { super(message); } }

type Rows = Record<string, unknown>[];
const RESOURCES = ["students", "teachers", "classes", "subjects", "timetable", "assignments", "exams", "quizzes", "live", "books", "issues", "invoices", "notices", "events", "admissions", "threads"];

export interface FakeBackendOptions {
  /** Which fixture identity the authenticated user maps to, per granted school role. */
  identity?: Partial<Record<Role, string>>;
  /** Overrides the display name of the session user (to tell scopes apart). */
  userName?: string;
  /** Server-computed dashboard trends to include in /stats (omitted by default, as the contract allows). */
  trends?: { students?: number; attendanceToday?: number; collected?: number };
  /** Intercept a request before the default handler; return undefined to fall through. */
  intercept?: (req: RecordedRequest) => unknown;
}

export function createFakeBackend(options: FakeBackendOptions = {}) {
  const today = isoDay(new Date());
  const db: SchoolFixture = seedSchoolFixture({ today });
  const now = new Date();
  const live = () => materializeLiveSessions(db.live, now, new Date());
  const attempts: QuizAttempt[] = [];
  const gradeRequests: GradeRequest[] = [];
  const creates: { resource: string; body: Record<string, unknown> }[] = [];
  const attachmentStore = new Map<string, { id: string; name: string; type: string; size: number; downloadPath: string; content: string; purpose: string }>();
  const rooms = new Map<string, LiveRoomState>();
  const roomFor = (id: string): LiveRoomState => {
    if (!rooms.has(id)) rooms.set(id, { people: [{ id: "p-1", name: "Amara Chen", role: "Student", mic: false, cam: true, hand: false, speaking: false }], messages: [{ id: "m-1", from: "Priya Raman", text: "Welcome everyone!", at: Date.now() }], poll: null, scores: {}, recording: false, elapsed: 60 });
    return rooms.get(id)!;
  };
  const submissions = new Map<string, Submission[]>();
  const requests: RecordedRequest[] = [];
  let pending = 0;
  const settings: SchoolSettings = {
    profile: { name: "", email: "", phone: "+1 555 014 2210", language: "English (UK)", timezone: "Europe/London" },
    notifications: { "Grades published": [true, true, false], Messages: [true, false, false] },
    twoStepVerification: false,
    sessions: [{ id: "se-1", name: "Chrome on macOS", detail: "now", current: true }, { id: "se-2", name: "Scholaris app on iPhone", detail: "2 hours ago", current: false }],
  };
  const collection = (name: string): Rows => (name === "live" ? (live() as unknown as Rows) : ((db as unknown as Record<string, Rows>)[name] ?? []));
  const subsOf = (id: string) => { if (!submissions.has(id)) submissions.set(id, generateSubmissions(db, id)); return submissions.get(id)!; };
  const mark = (s: string, sub: string, term: string) => markFor(db.students, s, sub, term);
  const att = (s: string, d: string) => attendanceFor(db.students, s, d, now);
  const trend = (ids: string[], n: number) => schoolDays(n, now).map((d) => { const v = ids.map((id) => att(id, d)).filter(Boolean); return { date: d, pct: v.length ? Math.round((v.filter((x) => x !== "A").length / v.length) * 1000) / 10 : 0 }; });
  const schedule = (f: { classId?: string; teacherId?: string }) => {
    const wd = (now.getDay() + 6) % 7;
    const day = wd < 5 ? wd : 0;
    return {
      dayLabel: wd < 5 ? "Today" : "Monday (next school day)",
      slots: db.timetable.filter((t) => t.day === day && (f.classId ? t.classId === f.classId : t.teacherId === f.teacherId)).map((t) => {
        const p = PERIODS.find((x) => x.no === t.period)!; const sub = db.subjects.find((s) => s.id === t.subjectId)!;
        return { id: t.id, start: p.start, end: p.end, label: p.label, subject: sub.name, color: sub.color, className: db.classes.find((c) => c.id === t.classId)!.name, teacher: db.teachers.find((x) => x.id === t.teacherId)?.name ?? "Self study", room: t.room };
      }),
    };
  };

  function query(rows: Rows, params: URLSearchParams) {
    let out = rows;
    for (const [k, v] of params) {
      if (["q", "page", "pageSize", "sort", "order", "limit"].includes(k) || v === "" || v === "all") continue;
      const values = v.split(",");
      out = out.filter((r) => { const f = r[k]; return Array.isArray(f) ? f.some((x) => values.includes(String(x))) : values.includes(String(f)); });
    }
    const sort = params.get("sort");
    if (sort) { const dir = params.get("order") === "desc" ? -1 : 1; out = [...out].sort((a, b) => (String(a[sort]) > String(b[sort]) ? dir : -dir)); }
    const total = out.length;
    const limit = Number(params.get("limit") || 0);
    return { data: limit ? out.slice(0, limit) : out, total };
  }

  function stats(role: string, id: string): unknown {
    const billed = db.invoices.reduce((a, i) => a + i.amount, 0), collected = db.invoices.reduce((a, i) => a + i.paid, 0);
    const byMonth = [...db.invoices.reduce((m, i) => (i.lastPaymentOn ? m.set(i.lastPaymentOn.slice(0, 7), (m.get(i.lastPaymentOn.slice(0, 7)) ?? 0) + i.paid) : m), new Map<string, number>())].sort().map(([month, amount]) => ({ month, amount }));
    if (role === "admin") {
      const active = db.students.filter((s) => s.status === "Active");
      const t = trend(active.slice(0, 40).map((s) => s.id), 20);
      const all = live();
      return {
        students: active.length, teachers: db.teachers.length, classes: db.classes.length, subjects: db.subjects.length - 1, attendanceToday: t.at(-1)!.pct, attendanceTrend: t,
        billed, collected, overdueAccounts: db.invoices.filter((i) => i.status === "Overdue").length, feeByMonth: byMonth,
        classPerformance: db.classes.map((c) => ({ label: c.name.replace("Grade ", ""), value: c.avgScore })),
        gender: { male: active.filter((s) => s.gender === "Male").length, female: active.filter((s) => s.gender === "Female").length },
        liveNow: all.filter((l) => l.status === "Live"), upcomingLive: all.filter((l) => l.status === "Scheduled").slice(0, 5),
        admissions: ["Applied", "Screening", "Interview", "Offered", "Enrolled", "Declined"].map((stage) => ({ stage, count: db.admissions.filter((a) => a.stage === stage).length })),
        booksOut: db.issues.filter((i) => i.status !== "Returned").length, overdueBooks: db.issues.filter((i) => i.status === "Overdue").length,
        teachersOnLeave: db.teachers.filter((t) => t.status === "On leave").length, recentAdmissions: db.admissions.slice(0, 5),
        ...(options.trends ? { trends: { students: options.trends.students, attendanceToday: options.trends.attendanceToday } } : {}),
      } satisfies AdminStats;
    }
    if (role === "teacher") {
      const t = db.teachers.find((x) => x.id === id);
      if (!t) throw new FakeHttpError(404, "Teacher not found");
      const mine = db.assignments.filter((a) => a.teacherId === id);
      const home = db.classes.find((c) => c.classTeacherId === id);
      return {
        teacher: t, schedule: schedule({ teacherId: id }), classIds: [...new Set(db.timetable.filter((s) => s.teacherId === id).map((s) => s.classId))], homeClass: home,
        pendingGrading: mine.reduce((a, x) => a + Math.max(0, x.submitted - x.graded), 0), openAssignments: mine.filter((a) => a.status === "Open").length,
        toGrade: mine.filter((a) => a.submitted > a.graded).slice(0, 5), homeAttendance: home ? trend(db.students.filter((s) => s.classId === home.id).map((s) => s.id), 15) : [],
        performance: [{ label: "10-A", value: 72 }], live: live().filter((l) => l.teacherId === id && l.status !== "Ended").slice(0, 4), quizzes: db.quizzes.filter((q) => q.teacherId === id).length,
      } satisfies TeacherStats;
    }
    if (role === "student") {
      const s = db.students.find((x) => x.id === id);
      if (!s) throw new FakeHttpError(404, "Student not found");
      const cls = db.classes.find((c) => c.id === s.classId)!;
      return {
        student: s, class: cls, schedule: schedule({ classId: s.classId }), attendancePct: s.attendancePct, attendanceTrend: trend([s.id], 20),
        subjectPerf: EXAM_SUBJECTS(cls.grade).map((sid) => { const sub = db.subjects.find((x) => x.id === sid)!; return { label: sub.code, name: sub.name, value: mark(s.id, sid, "QTR") ?? 0, classAvg: 70, color: sub.color }; }),
        pending: db.assignments.filter((a) => a.classId === s.classId && a.status === "Open").slice(0, 6), pendingCount: 2,
        exams: db.exams.filter((e) => e.classId === s.classId && e.status === "Scheduled").slice(0, 6), quizzes: db.quizzes.filter((q) => q.classId === s.classId && q.status === "Published"),
        live: live().filter((l) => l.classId === s.classId && l.status !== "Ended").slice(0, 4), books: db.issues.filter((i) => i.memberId === id && i.status !== "Returned"),
        invoices: db.invoices.filter((i) => i.studentId === id), classTeacher: db.teachers.find((t) => t.id === cls.classTeacherId)!,
      } satisfies StudentStats;
    }
    if (role === "librarian") {
      return {
        titles: db.books.length, copies: db.books.reduce((a, b) => a + b.copies, 0), available: db.books.reduce((a, b) => a + b.available, 0),
        issued: db.issues.filter((i) => i.status === "Issued").length, overdue: db.issues.filter((i) => i.status === "Overdue"), fines: db.issues.reduce((a, i) => a + i.fine, 0),
        categories: [{ label: "Fiction", value: 12 }], trend: schoolDays(14, now).map((d) => ({ date: d, issued: 1, returned: 1 })), recent: db.issues.slice(0, 8), popular: db.books.slice(0, 5),
      } satisfies LibStats;
    }
    if (role === "accountant") {
      return {
        billed, collected, outstanding: billed - collected, overdue: db.invoices.filter((i) => i.status === "Overdue"), partial: db.invoices.filter((i) => i.status === "Partial").length,
        byClass: db.classes.map((c) => ({ label: c.name.replace("Grade ", ""), value: 80 })), methods: [{ label: "Card", value: 1000 }], byMonth, recent: db.invoices.filter((i) => i.lastPaymentOn).slice(0, 8),
      } satisfies AccStats;
    }
    throw new FakeHttpError(400, "Unknown role");
  }

  function handle(method: string, url: URL, body: Record<string, unknown> | undefined, sessionRole: (r: string) => Role | null, staff: boolean): unknown {
    const path = url.pathname;
    const p = url.searchParams;
    const [, top, id, sub] = path.split("/");
    if (top === "school-profile") return { data: db.school };
    if (top === "fee-structure") return feeStructureFixture();
    if (top === "question-bank") {
      if (!staff) throw new FakeHttpError(403, "Authors only");
      return { data: (QUESTION_BANK[p.get("subjectId") ?? ""] ?? []).map((q, i) => ({ ...q, id: `bank-${i}`, points: 1 })) };
    }
    if (top === "quizzes" && id && sub === "questions") {
      const quiz = db.quizzes.find((q) => q.id === id);
      if (!quiz) throw new FakeHttpError(404, "Not found");
      // Students never receive the key before grading.
      return { data: quiz.questions!.map((q) => (staff ? q : { id: q.id, text: q.text, options: q.options, points: q.points })) };
    }
    if (top === "quizzes" && id && sub === "grade") {
      const quiz = db.quizzes.find((q) => q.id === id)!;
      const req = body as unknown as GradeRequest;
      gradeRequests.push(req);
      const qs = quiz.questions!;
      const attempt: QuizAttempt = {
        studentId: req.studentId ?? "", quizId: id, answers: req.answers, timeTaken: req.timeTaken, at: new Date().toISOString(), preview: req.preview,
        score: qs.reduce((a, q, k) => a + (req.answers[k] === q.answer ? q.points : 0), 0), total: qs.reduce((a, q) => a + q.points, 0),
        review: qs.map((q) => ({ answer: q.answer!, explanation: q.explanation })),
      };
      if (!req.preview) attempts.push(attempt);
      return { data: attempt };
    }
    if (top === "live" && id && sub === "room") return { data: roomFor(id) };
    if (top === "live" && id && sub === "actions") {
      const room = roomFor(id);
      const a = body as unknown as LiveRoomActionBody;
      if (a.action === "message") room.messages = [...room.messages, { id: `m-${room.messages.length + 1}`, from: "You", text: a.text ?? "", at: Date.now(), me: true }];
      if (a.action === "recording") room.recording = !!a.enabled;
      if (a.action === "poll-launch") room.poll = { q: "Server poll", options: ["One", "Two"], votes: [0, 0], mine: null, open: true, n: a.pollNumber ?? 0 };
      return { data: room };
    }
    if (top === "threads" && id && method === "PATCH") {
      const thread = (db.threads as Thread[]).find((t) => t.id === id)!;
      thread.messages = [...(body?.messages as Thread["messages"]), { id: `srv-${thread.messages.length + 2}`, from: "them", text: DEMO_THREAD_REPLIES[0]!, at: new Date().toISOString() }];
      return { data: thread };
    }
    if (top === "session") {
      const role = sessionRole(p.get("role") ?? "");
      if (!role) throw new FakeHttpError(403, "Role not granted");
      const who = db.identities[role];
      const userId = options.identity?.[role] ?? who.id;
      return { data: { role, user: { ...who, id: userId, name: options.userName ?? who.name }, children: role === "parent" ? db.parentChildren[who.id] ?? [] : [] } satisfies SessionPayload };
    }
    if (top === "meta") return { data: { periods: PERIODS, days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], terms: TERMS, today: { weekday: 0, schoolDay: 0, isWeekend: false } } };
    if (top === "stats") return { data: stats(p.get("role") ?? "", p.get("id") ?? "") };
    if (top === "attendance") {
      if (method === "POST") return { data: { saved: (body?.rows as unknown[]).length } };
      const classId = p.get("classId"), studentId = p.get("studentId");
      if (classId) {
        const date = p.get("date") ?? today;
        const roster = db.students.filter((s) => s.classId === classId).sort((a, b) => a.rollNo - b.rollNo);
        return { data: roster.map((s) => ({ studentId: s.id, name: s.name, rollNo: s.rollNo, status: att(s.id, date) ?? "P" })), taken: true, trend: trend(roster.map((s) => s.id), 20) };
      }
      const month = p.get("month") ?? today.slice(0, 7);
      const [y, m] = month.split("-").map(Number) as [number, number];
      return { data: Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, "0")}`; return { date, status: att(studentId!, date) }; }), summary: { present: 50, absent: 2, late: 1, excused: 1, total: 54 } };
    }
    if (top === "marks") {
      if (method === "POST") return { data: { saved: (body?.entries as unknown[]).length } };
      const cls = db.classes.find((c) => c.id === (p.get("classId") ?? "c-10A"));
      const term = TERMS.find((t) => t.id === (p.get("term") ?? "QTR"));
      if (!cls || !term) throw new FakeHttpError(404, "Unknown class or term");
      const subjects = EXAM_SUBJECTS(cls.grade).map((sid) => db.subjects.find((s) => s.id === sid)!);
      return { data: { class: cls, term, subjects, students: db.students.filter((s) => s.classId === cls.id).map((s) => ({ id: s.id, name: s.name, rollNo: s.rollNo, admissionNo: s.admissionNo, marks: Object.fromEntries(subjects.map((sub) => [sub.id, mark(s.id, sub.id, term.id)])) })) } };
    }
    if (top === "report-card") {
      const s = db.students.find((x) => x.id === p.get("studentId"));
      if (!s) throw new FakeHttpError(404, "Student not found");
      const cls = db.classes.find((c) => c.id === s.classId)!;
      const subjects = EXAM_SUBJECTS(cls.grade).map((sid) => db.subjects.find((x) => x.id === sid)!);
      return { data: { student: s, class: cls, subjects, terms: TERMS.map((t) => {
        const marks = Object.fromEntries(subjects.map((sub) => [sub.id, mark(s.id, sub.id, t.id)]));
        const vals = Object.values(marks).filter((v): v is number => v !== null);
        const total = vals.reduce((a, b) => a + b, 0);
        const pct = vals.length ? Math.round((total / (vals.length * t.max)) * 1000) / 10 : null;
        return { ...t, marks, classAvg: Object.fromEntries(subjects.map((sub) => [sub.id, 70])), total, pct, grade: pct === null ? null : gradeFor(pct).grade, rank: pct === null ? null : 3, outOf: 24 };
      }) } };
    }
    if (top === "submissions") {
      if (method === "PATCH") {
        const list = subsOf(String(body?.assignmentId));
        const sub = list.find((x) => x.studentId === body?.studentId)!;
        Object.assign(sub, typeof body?.marks === "number" ? { marks: body.marks, feedback: body.feedback ?? "", status: "Graded" } : { text: body?.text, status: "Submitted", submittedOn: today });
        return { data: sub };
      }
      if (p.get("assignmentId")) return { data: subsOf(p.get("assignmentId")!) };
      const s = db.students.find((x) => x.id === p.get("studentId"));
      return { data: db.assignments.filter((a) => a.classId === s?.classId).map((a) => subsOf(a.id).find((x) => x.studentId === s?.id)!).filter(Boolean) };
    }
    if (top === "quiz-attempts") {
      const mine = attempts.filter((a) => a.studentId === p.get("studentId"));
      return p.get("quizId") ? { data: mine.find((a) => a.quizId === p.get("quizId")) ?? null } : { data: mine };
    }
    if (top === "settings") {
      if (method === "PATCH") Object.assign(settings, body);
      if (id === "password" || id === "sessions") return { data: {} };
      return { data: settings };
    }
    if (top === "attachments") {
      if (method === "POST") {
        const up = body as unknown as AttachmentUpload;
        const size = Buffer.from(up.content, "base64").length;
        if (size > 1024 * 1024) throw new FakeHttpError(413, "Attachment exceeds 1 MB");
        const meta = { id: `att-${attachmentStore.size + 1}`, name: up.name, type: up.type, size, downloadPath: `/api/attachments/att-${attachmentStore.size + 1}` };
        attachmentStore.set(meta.id, { ...meta, content: up.content, purpose: up.purpose });
        return { data: meta };
      }
      const stored = attachmentStore.get(id ?? "");
      if (!stored) throw new FakeHttpError(404, "Not found");
      return { data: { id: stored.id, name: stored.name, type: stored.type, size: stored.size, content: stored.content } };
    }
    if (top === "contacts") return { data: CONTACTS_FIXTURE };
    if (["leave-requests", "reservations", "invoices"].includes(top!) && id === undefined && method === "POST") return { data: { id: "x-1" } };
    if (top === "invoices" && id === "reminders") return { data: { sent: (body?.invoiceIds as unknown[]).length } };
    if (RESOURCES.includes(top!)) {
      const rows = collection(top!);
      if (method === "GET") {
        if (id) { const row = rows.find((r) => r.id === id); if (!row) throw new FakeHttpError(404, "Not found"); return { data: row }; }
        return query(rows, p);
      }
      if (method === "POST") {
        creates.push({ resource: top!, body: { ...body } });
        // Server-initialized derived fields (the client never sends them).
        const derived: Record<string, unknown> =
          top === "books" ? { available: Number(body?.copies ?? 0), rating: 0, cover: "#2b4c9b" }
          : top === "classes" ? { strength: 0, avgScore: 0 }
          : top === "quizzes" ? { attempts: 0, avgScore: 0 }
          : top === "assignments" ? { submitted: 0, graded: 0, total: db.classes.find((c) => c.id === body?.classId)?.strength ?? 0 }
          : {};
        const row = { ...body, ...derived, id: `${top!.slice(0, 2)}-${rows.length + 1}` }; rows.unshift(row); return { data: row };
      }
      if (method === "PATCH") { const row = rows.find((r) => r.id === id); if (!row) throw new FakeHttpError(404, "Not found"); Object.assign(row, body); return { data: row }; }
      if (method === "DELETE") return { data: { id } };
    }
    throw new FakeHttpError(404, `Unknown endpoint ${method} ${path}`);
  }

  /** A host.request bound to one authenticated scope. Only "/api/..." paths exist. */
  const requestFor = (grantedRoles: readonly string[]) => async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const req = { method, path, body };
    requests.push(req);
    pending++;
    try {
      await Promise.resolve();
      if (!path.startsWith("/api/")) throw new FakeHttpError(404, `Not a school API path: ${path}`);
      const hooked = options.intercept?.({ ...req, path: path.slice(4) });
      if (hooked !== undefined) { if (hooked instanceof Error) throw hooked; return JSON.parse(JSON.stringify(hooked)) as T; }
      const url = new URL(`http://school.test${path.slice(4)}`);
      const grants = (r: string) => grantedRoles.some((g) => g === r || g.endsWith(`:${r}`));
      // Serialized like an HTTP response, so the page never shares objects with the fake server state.
      return JSON.parse(JSON.stringify(handle(method, url, body, (r) => (grants(r) ? (r as Role) : null), grants("admin") || grants("teacher")))) as T;
    } finally { pending--; }
  };

  return { db, requests, creates, attempts, gradeRequests, rooms, attachmentStore, settings, requestFor, get pending() { return pending; } };
}

export type FakeBackend = ReturnType<typeof createFakeBackend>;

export interface HostOptions {
  roles: string[];
  tenantId?: string;
  userId?: string;
  preferences?: Partial<UserPreferences>;
  policy?: PreferencePolicy;
  onPreferenceChange?: ReferencePreferenceHost["onPreferenceChange"];
  preferencesAvailable?: boolean;
}

export function fakeHost(backend: FakeBackend, o: HostOptions, navigate: (p: string) => void = () => {}): ReferenceHost {
  const preferences = { ...DEFAULT_PREFERENCES, keyboardShortcuts: true, ...o.preferences } as UserPreferences;
  return {
    scope: { tenantId: o.tenantId ?? "tenant-a", applicationId: "school", branchId: "main", userId: o.userId ?? "auth-user-1", roles: o.roles },
    preferences,
    preferenceHost: { preferences, preferencePolicy: o.policy, preferencesAvailable: o.preferencesAvailable ?? true, onPreferenceChange: o.onPreferenceChange },
    request: backend.requestFor(o.roles),
    navigate,
  };
}
