export type Role = "admin" | "teacher" | "student" | "parent" | "librarian" | "accountant";

export type Status = "Active" | "Inactive" | "On leave" | "Alumni";
export type FeeState = "Paid" | "Partial" | "Due" | "Overdue";

export interface Student {
  id: string;
  admissionNo: string;
  name: string;
  gender: "Male" | "Female";
  dob: string;
  classId: string;
  rollNo: number;
  email: string;
  phone: string;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
  address: string;
  bloodGroup: string;
  house: string;
  transport: string;
  status: Status;
  attendancePct: number;
  gpa: number;
  feeStatus: FeeState;
  joinedOn: string;
  ability: number;
}

export interface Teacher {
  id: string;
  empId: string;
  name: string;
  gender: "Male" | "Female";
  email: string;
  phone: string;
  department: string;
  subjectIds: string[];
  qualification: string;
  experience: number;
  designation: string;
  employmentType: "Full-time" | "Part-time" | "Visiting";
  status: Status;
  joinedOn: string;
  rating: number;
  weeklyPeriods: number;
}

export interface ClassRoom {
  id: string;
  grade: number;
  section: string;
  name: string;
  classTeacherId: string;
  room: string;
  capacity: number;
  strength: number;
  stream: string;
  avgScore: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
  type: "Core" | "Elective" | "Lab" | "Activity";
  credits: number;
  periodsPerWeek: number;
  color: string;
  grades: number[];
}

export interface Period {
  no: number;
  label: string;
  start: string;
  end: string;
  isBreak?: boolean;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  day: number; // 0 = Monday
  period: number;
  subjectId: string;
  teacherId: string | null;
  room: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  type: "Homework" | "Project" | "Lab report" | "Essay" | "Worksheet";
  assignedOn: string;
  dueDate: string;
  maxMarks: number;
  submitted: number;
  graded: number;
  total: number;
  status: "Open" | "Closed" | "Draft";
  attachments?: import("./contract").SchoolAttachment[];
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  submittedOn: string | null;
  status: "Submitted" | "Late" | "Missing" | "Graded";
  marks: number | null;
  feedback: string;
  text: string;
  attachments?: import("./contract").SchoolAttachment[];
}

export interface Exam {
  id: string;
  term: string;
  name: string;
  classId: string;
  subjectId: string;
  date: string;
  start: string;
  durationMin: number;
  maxMarks: number;
  room: string;
  invigilatorId: string;
  status: "Scheduled" | "Ongoing" | "Completed";
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  /** Present only for staff/authors (builder, question bank, preview). Students never receive it before grading. */
  answer?: number;
  points: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  durationMin: number;
  dueDate: string;
  status: "Published" | "Draft" | "Closed";
  attempts: number;
  avgScore: number;
  /** Public question list when the server includes it; students load questions from /quizzes/:id/questions. */
  questions?: QuizQuestion[];
  questionCount?: number;
  /** Builder options (the source collected these but did not save them). */
  shuffle?: boolean;
  revealAnswers?: boolean;
}

export interface LiveSession {
  id: string;
  title: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  start: string;
  durationMin: number;
  status: "Live" | "Scheduled" | "Ended";
  attendees: number;
  capacity: number;
  kind: "Class" | "Parent meeting" | "Staff meeting" | "Webinar";
  recording?: string;
}

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  publisher: string;
  year: number;
  copies: number;
  available: number;
  shelf: string;
  rating: number;
  cover: string;
}

export interface BookIssue {
  id: string;
  bookId: string;
  bookTitle: string;
  memberId: string;
  memberName: string;
  memberType: "Student" | "Teacher";
  issuedOn: string;
  dueOn: string;
  returnedOn: string | null;
  status: "Issued" | "Returned" | "Overdue" | "Reserved";
  fine: number;
}

export interface FeeInvoice {
  id: string;
  invoiceNo: string;
  studentId: string;
  studentName: string;
  classId: string;
  term: string;
  items: { label: string; amount: number }[];
  amount: number;
  paid: number;
  dueDate: string;
  status: FeeState;
  lastPaymentOn: string | null;
  method: string | null;
  /** Receipt issued by the server for the latest payment, when it issues one. */
  receiptNo?: string;
  /** True only when the server has actually sent the receipt to the guardian. */
  receiptSent?: boolean;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  audience: "All" | "Students" | "Teachers" | "Parents" | "Staff";
  priority: "Normal" | "Important" | "Urgent";
  postedBy: string;
  date: string;
  pinned: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: "Academic" | "Exam" | "Holiday" | "Sports" | "Cultural" | "Meeting";
  location: string;
}

export interface Admission {
  id: string;
  applicationNo: string;
  name: string;
  grade: number;
  parentName: string;
  phone: string;
  email: string;
  previousSchool: string;
  stage: "Applied" | "Screening" | "Interview" | "Offered" | "Enrolled" | "Declined";
  appliedOn: string;
  score: number | null;
}

export interface Thread {
  id: string;
  with: string;
  withRole: string;
  subject: string;
  unread: number;
  owner: Role;
  messages: { id: string; from: "me" | "them"; text: string; at: string; attachments?: import("./contract").SchoolAttachment[] }[];
}

export interface AttendanceRow {
  studentId: string;
  name: string;
  rollNo: number;
  status: "P" | "A" | "L" | "E";
}

export interface ApiList<T> {
  data: T[];
  total: number;
}
