/* Typed payloads for every school endpoint. See API-CONTRACT.md; paths are relative to host.request("/api" + path). */
import type {
  Admission, Assignment, AttendanceRow, Book, BookIssue, ClassRoom, Exam, FeeInvoice, LiveSession, Period, Quiz, Role,
  Student, Subject, Teacher,
} from "./types";

export interface Envelope<T> { data: T }
export interface ListEnvelope<T> { data: T[]; total: number }

export interface SchoolUser { id: string; name: string; title: string; email: string }
export interface SessionPayload { role: Role; user: SchoolUser; children: string[] }

export interface Term { id: string; name: string; max: number; status: "Completed" | "Scheduled" }
export interface Meta { periods: Period[]; days: string[]; terms: Term[]; today: { weekday: number; schoolDay: number; isWeekend: boolean } }

export interface TrendPoint { date: string; pct: number }
export interface AttendanceRoster { data: AttendanceRow[]; taken: boolean; trend: TrendPoint[] }
export type AttendanceStatus = "P" | "A" | "L" | "E" | null;
export interface StudentAttendanceMonth {
  data: { date: string; status: AttendanceStatus }[];
  summary: { present: number; absent: number; late: number; excused: number; total: number };
}
export interface AttendanceSave { date: string; rows: { studentId: string; status: AttendanceRow["status"] }[] }

export interface MarkSheet {
  class: ClassRoom; term: Term; subjects: Subject[];
  students: { id: string; name: string; rollNo: number; admissionNo: string; marks: Record<string, number | null> }[];
}
export interface MarkSave { term: string; entries: { studentId: string; subjectId: string; value: number | null }[] }

export interface ScheduleSlot { id: string; start: string; end: string; label: string; subject: string; color: string; className: string; teacher: string; room: string }
export interface DaySchedule { dayLabel: string; slots: ScheduleSlot[] }

export interface AdminStats {
  students: number; teachers: number; classes: number; subjects: number; attendanceToday: number;
  attendanceTrend: TrendPoint[]; billed: number; collected: number; overdueAccounts: number;
  feeByMonth: { month: string; amount: number }[]; classPerformance: { label: string; value: number }[];
  gender: { male: number; female: number }; liveNow: LiveSession[]; upcomingLive: LiveSession[];
  admissions: { stage: string; count: number }[]; booksOut: number; overdueBooks: number; teachersOnLeave: number; recentAdmissions: Admission[];
  /** Server-computed change in percent against the previous period. Omitted means no trend is shown. */
  trends?: { students?: number; attendanceToday?: number };
}
export interface TeacherStats {
  teacher: Teacher; schedule: DaySchedule; classIds: string[]; homeClass?: ClassRoom;
  pendingGrading: number; openAssignments: number; toGrade: Assignment[]; homeAttendance: TrendPoint[];
  performance: { label: string; value: number }[]; live: LiveSession[]; quizzes: number;
}
export interface StudentStats {
  student: Student; class: ClassRoom; schedule: DaySchedule; attendancePct: number;
  attendanceTrend: TrendPoint[]; subjectPerf: { label: string; name: string; value: number; classAvg: number; color: string }[];
  pending: Assignment[]; pendingCount: number; exams: Exam[]; quizzes: Quiz[]; live: LiveSession[]; books: BookIssue[]; invoices: FeeInvoice[]; classTeacher: Teacher;
}
export interface LibStats {
  titles: number; copies: number; available: number; issued: number; overdue: BookIssue[]; fines: number;
  categories: { label: string; value: number }[]; trend: { date: string; issued: number; returned: number }[]; recent: BookIssue[]; popular: Book[];
}
export interface AccStats {
  billed: number; collected: number; outstanding: number; overdue: FeeInvoice[]; partial: number;
  byClass: { label: string; value: number }[]; methods: { label: string; value: number }[]; byMonth: { month: string; amount: number }[]; recent: FeeInvoice[];
  /** Server-computed change in percent against the previous period. Omitted means no trend is shown. */
  trends?: { collected?: number };
}

/** Server-graded attempt. `review` carries the answer key and explanations per question, released only with a result. */
export interface QuizAttempt {
  studentId: string; quizId: string; score: number; total: number; answers: (number | null)[]; at: string; timeTaken: number;
  review: { answer: number; explanation?: string }[];
  /** True for a staff preview grade, which the server does not store. */
  preview?: boolean;
}
export interface GradeRequest { studentId?: string; answers: (number | null)[]; timeTaken: number; preview?: boolean }

export interface SchoolProfile {
  name: string; short: string; product: string; year: string; campus: string;
  /** Optional payee details for bank-transfer payments; omitted when the school does not publish them. */
  bankTransfer?: { account: string; routing: string };
}

export interface FeeStructure {
  data: { g: number; tuition: number; lab: number; library: number; activities: number; transport: number }[];
  policy: { siblingDiscountPct: number; lateFee: number; lateAfterDays: number };
}

export interface LiveRoomPerson { id: string; name: string; role: string; mic: boolean; cam: boolean; hand: boolean; speaking: boolean }
export interface LiveRoomMessage { id: string; from: string; text: string; at: number; me?: boolean }
export interface LiveRoomPoll { q: string; options: string[]; answer?: number; votes: number[]; mine: number | null; open: boolean; n: number }
/** Server-held classroom state. `people` excludes the current user, whose tile is the real local media. */
export interface LiveRoomState {
  people: LiveRoomPerson[]; messages: LiveRoomMessage[]; poll: LiveRoomPoll | null; scores: Record<string, number>; recording: boolean; elapsed: number;
}
export type LiveRoomAction =
  | "join" | "leave" | "end" | "message" | "poll-launch" | "poll-vote" | "poll-close" | "poll-end" | "hand" | "recording" | "mute" | "camera" | "reaction";
export interface LiveRoomActionBody { action: LiveRoomAction; text?: string; index?: number; pollNumber?: number; raised?: boolean; enabled?: boolean; emoji?: string }

export type NotificationChannels = [inApp: boolean, email: boolean, sms: boolean];
export interface SchoolSettings {
  profile: { name: string; email: string; phone: string; language: string; timezone: string };
  notifications: Record<string, NotificationChannels>;
  twoStepVerification: boolean;
  sessions: { id: string; name: string; detail: string; current: boolean }[];
}
export type SettingsPatch = Partial<Pick<SchoolSettings, "profile" | "notifications" | "twoStepVerification">>;
export interface PasswordChange { current: string; next: string; confirm: string }

/* ---------- Attachments (POST /attachments, GET /attachments/:id) ---------- */
export type AttachmentPurpose = "assignment" | "submission" | "message";
/** Stored file metadata returned by the server; saved on assignments, submissions and thread messages. */
export interface SchoolAttachment { id: string; name: string; type: string; size: number; downloadPath: string }
/** Upload body: the file's bytes base64-encoded. The decoded size must not exceed 1 MB. */
export interface AttachmentUpload { name: string; type: string; content: string; purpose: AttachmentPurpose }
/** Download response (JSON, content base64). */
export interface AttachmentContent { id: string; name: string; type: string; size: number; content: string }
