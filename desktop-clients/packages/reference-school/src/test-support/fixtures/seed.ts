import type {
  Admission, Assignment, Book, BookIssue, CalendarEvent, ClassRoom, Exam, FeeInvoice, LiveSession, Notice,
  Period, Quiz, Student, Subject, Teacher, Thread, TimetableSlot,
} from "../../lib/types";
import { addDays, hashStr, isoDay } from "../../lib/utils";
import { mulberry32 } from "./random";
import { QUESTION_BANK } from "./bank";

export const PERIODS: Period[] = [
  { no: 1, label: "P1", start: "08:00", end: "08:45" },
  { no: 2, label: "P2", start: "08:50", end: "09:35" },
  { no: 3, label: "P3", start: "09:40", end: "10:25" },
  { no: -1, label: "Break", start: "10:25", end: "10:45", isBreak: true },
  { no: 4, label: "P4", start: "10:45", end: "11:30" },
  { no: 5, label: "P5", start: "11:35", end: "12:20" },
  { no: -2, label: "Lunch", start: "12:20", end: "13:00", isBreak: true },
  { no: 6, label: "P6", start: "13:00", end: "13:45" },
  { no: 7, label: "P7", start: "13:50", end: "14:35" },
  { no: 8, label: "P8", start: "14:40", end: "15:25" },
];
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const TERMS = [
  { id: "UT1", name: "Unit Test 1", max: 25, status: "Completed" as const },
  { id: "QTR", name: "Quarterly", max: 100, status: "Completed" as const },
  { id: "UT2", name: "Unit Test 2", max: 25, status: "Scheduled" as const },
  { id: "HY", name: "Half-Yearly", max: 100, status: "Scheduled" as const },
];

const SUBJECT_DEFS: [string, string, string, string, Subject["type"], number, string, number][] = [
  // id, code, name, dept, type, periods, color, teachers
  ["sub-math", "MAT", "Mathematics", "Mathematics", "Core", 6, "#2b59c3", 4],
  ["sub-eng", "ENG", "English Literature", "Languages", "Core", 5, "#b8336a", 4],
  ["sub-phy", "PHY", "Physics", "Science", "Core", 3, "#0f7c8c", 3],
  ["sub-chem", "CHE", "Chemistry", "Science", "Lab", 3, "#7a4fc9", 3],
  ["sub-bio", "BIO", "Biology", "Science", "Lab", 3, "#2e8b57", 3],
  ["sub-hist", "HIS", "History", "Humanities", "Core", 2, "#a0522d", 2],
  ["sub-geo", "GEO", "Geography", "Humanities", "Core", 2, "#6b8e23", 2],
  ["sub-cs", "CSC", "Computer Science", "Technology", "Core", 3, "#1f6f8b", 3],
  ["sub-fre", "FRE", "French", "Languages", "Elective", 2, "#c0392b", 2],
  ["sub-art", "ART", "Art & Design", "Arts", "Activity", 2, "#d4880f", 2],
  ["sub-pe", "PHE", "Physical Education", "Sports", "Activity", 3, "#16a085", 3],
  ["sub-mus", "MUS", "Music", "Arts", "Activity", 1, "#8e44ad", 1],
  ["sub-eco", "ECO", "Economics", "Humanities", "Elective", 2, "#34495e", 2],
];
export const STUDY_HALL = "sub-lib";

export const EXAM_SUBJECTS = (grade: number) =>
  ["sub-math", "sub-eng", "sub-phy", "sub-chem", "sub-bio", "sub-cs", "sub-hist", "sub-geo", ...(grade >= 11 ? ["sub-eco"] : [])];

const FIRST_M = ["Aarav", "Liam", "Noah", "Mateo", "Ethan", "Kwame", "Hiroshi", "Omar", "Lucas", "Arjun", "Daniel", "Yusuf", "Leo", "Samuel", "Rafael", "Kai", "Felix", "Ibrahim", "Oliver", "Jonas", "Theo", "Ravi", "Tomás", "Chidi", "Benjamin", "Marco", "Adrian", "Kenji", "Elias", "Nikhil"];
const FIRST_F = ["Elena", "Amara", "Sofia", "Priya", "Chloe", "Zara", "Mei", "Isla", "Aisha", "Hannah", "Lucia", "Ananya", "Grace", "Nadia", "Freya", "Yuki", "Leila", "Olivia", "Maya", "Ingrid", "Chiara", "Fatima", "Ava", "Nia", "Sienna", "Keira", "Rosa", "Tara", "Emilia", "Noor"];
const LAST = ["Okafor", "Chen", "Patel", "García", "Müller", "Nakamura", "Johansson", "Haddad", "Silva", "Kowalski", "Mensah", "Rossi", "Kim", "O'Brien", "Novak", "Dubois", "Ahmed", "Fernandes", "Larsen", "Iyer", "Bianchi", "Tanaka", "Mwangi", "Schmidt", "Cohen", "Reyes", "Andersson", "Sato", "Khan", "Moreau", "Walsh", "Adeyemi", "Petrov", "Lindqvist", "Menon"];
const HOUSES = ["Everest", "Kilimanjaro", "Andes", "Alps"];
const BLOOD = ["A+", "B+", "O+", "AB+", "A−", "O−", "B−"];
const STREETS = ["Maple Avenue", "Riverside Drive", "Oak Lane", "Harbour Road", "Cedar Close", "Kingsway", "Park Crescent", "Elm Street"];

export interface SessionSeed extends Omit<LiveSession, "start" | "status"> {
  start?: string;
  offsetMin?: number;
}

export interface Seed {
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassRoom[];
  students: Student[];
  timetable: TimetableSlot[];
  assignments: Assignment[];
  exams: Exam[];
  quizzes: Quiz[];
  live: SessionSeed[];
  books: Book[];
  issues: BookIssue[];
  invoices: FeeInvoice[];
  notices: Notice[];
  events: CalendarEvent[];
  admissions: Admission[];
  threads: Thread[];
}

/** Parses the caller's calendar day. The seed never reads the clock, so one day always yields one fixture. */
export function fixtureDay(today: string | Date): Date {
  const iso = typeof today === "string" ? today : isoDay(today);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Fixture day must be YYYY-MM-DD, received "${iso}"`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function createSeed(todayInput: string | Date): Seed {
  const rng = mulberry32(20260927);
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)]!;
  const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const today = fixtureDay(todayInput);
  const day = (n: number) => isoDay(addDays(today, n));

  /* ---------------- subjects ---------------- */
  const subjects: Subject[] = SUBJECT_DEFS.map(([id, code, name, department, type, periodsPerWeek, color]) => ({
    id, code, name, department, type, periodsPerWeek, color,
    credits: type === "Core" ? 4 : type === "Lab" ? 3 : 2,
    grades: id === "sub-eco" ? [11, 12] : [6, 7, 8, 9, 10, 11, 12],
  }));
  subjects.push({ id: STUDY_HALL, code: "LIB", name: "Library & study", department: "Library", type: "Activity", credits: 0, periodsPerWeek: 0, color: "#7b8794", grades: [6, 7, 8, 9, 10, 11, 12] });

  /* ---------------- teachers ---------------- */
  const QUALS = ["M.Sc., B.Ed.", "Ph.D.", "M.A., PGCE", "M.Tech.", "M.Ed.", "B.Sc., B.Ed.", "M.Phil."];
  const teachers: Teacher[] = [];
  let tn = 1;
  for (const [sid, , sname, dept, , , , count] of SUBJECT_DEFS) {
    for (let i = 0; i < count; i++) {
      const female = rng() > 0.45;
      const name = tn === 1 ? "Priya Raman" : `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
      const id = `t-${String(tn).padStart(3, "0")}`;
      teachers.push({
        id, empId: `NB-EMP-${2000 + tn}`, name, gender: tn === 1 || female ? "Female" : "Male",
        email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@northbridge.edu`,
        phone: `+1 555 01${String(tn).padStart(2, "0")} ${int(1000, 9999)}`,
        department: dept, subjectIds: [sid], qualification: pick(QUALS), experience: tn === 1 ? 12 : int(2, 24),
        designation: i === 0 ? `Head of ${sname}` : pick(["Senior Teacher", "Teacher", "Teacher", "Lecturer"]),
        employmentType: rng() > 0.9 ? "Part-time" : "Full-time", status: rng() > 0.95 ? "On leave" : "Active",
        joinedOn: day(-int(200, 5000)), rating: Math.round((3.6 + rng() * 1.4) * 10) / 10, weeklyPeriods: 0,
      });
      tn++;
    }
  }
  const teachersBySubject = (sid: string) => teachers.filter((t) => t.subjectIds.includes(sid));

  /* ---------------- classes ---------------- */
  const classes: ClassRoom[] = [];
  let ci = 0;
  const classTeacherPool = teachers.filter((t) => t.id !== "t-001").map((t) => t.id);
  for (let g = 6; g <= 12; g++) {
    for (const sec of ["A", "B"]) {
      const id = `c-${g}${sec}`;
      classes.push({
        id, grade: g, section: sec, name: `Grade ${g}-${sec}`,
        classTeacherId: id === "c-10A" ? "t-001" : classTeacherPool[ci % classTeacherPool.length]!,
        room: `${g >= 11 ? "C" : g >= 9 ? "B" : "A"}-${g}0${sec === "A" ? 1 : 2}`,
        capacity: 30, strength: 24, stream: g >= 11 ? (sec === "A" ? "Science" : "Commerce & Humanities") : "General",
        avgScore: 0,
      });
      ci++;
    }
  }

  /* ---------------- students ---------------- */
  const students: Student[] = [];
  let sn = 0;
  for (const c of classes) {
    for (let r = 1; r <= 24; r++) {
      const female = rng() > 0.5;
      let first = pick(female ? FIRST_F : FIRST_M);
      let last = pick(LAST);
      const id = `s-${1000 + sn}`;
      let gender: Student["gender"] = female ? "Female" : "Male";
      if (id === "s-1192") { first = "Elena"; last = "Vasquez"; gender = "Female"; }
      if (id === "s-1072") { first = "Mateo"; last = "Vasquez"; gender = "Male"; }
      const ability = id === "s-1192" ? 0.86 : id === "s-1072" ? 0.72 : 0.42 + rng() * 0.55;
      const dob = new Date(today.getFullYear() - c.grade - 5, int(0, 11), int(1, 28));
      const guardian = id.startsWith("s-1192") || id === "s-1072" ? "Isabel Vasquez" : `${pick(rng() > 0.5 ? FIRST_F : FIRST_M)} ${last}`;
      students.push({
        id, admissionNo: `NB/${2014 + (12 - c.grade) + int(0, 1)}/${String(4000 + sn).padStart(5, "0")}`,
        name: `${first} ${last}`, gender, dob: isoDay(dob), classId: c.id, rollNo: r,
        email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, "")}${sn}@students.northbridge.edu`,
        phone: `+1 555 02${String(sn % 100).padStart(2, "0")} ${int(1000, 9999)}`,
        guardianName: guardian, guardianRelation: rng() > 0.5 ? "Mother" : "Father",
        guardianPhone: `+1 555 03${String(sn % 100).padStart(2, "0")} ${int(1000, 9999)}`,
        address: `${int(2, 220)} ${pick(STREETS)}, Northbridge`, bloodGroup: pick(BLOOD), house: pick(HOUSES),
        transport: rng() > 0.45 ? `Route ${int(1, 9)}` : "Own transport",
        status: rng() > 0.985 ? "Inactive" : "Active", attendancePct: 0, gpa: 0, feeStatus: "Paid",
        joinedOn: day(-int(30, 2600)), ability,
      });
      sn++;
    }
  }

  /* ---------------- timetable (clash-free per teacher) ---------------- */
  const classSubjectTeacher = new Map<string, string>();
  classes.forEach((c, idx) => {
    for (const s of subjects) {
      if (!s.grades.includes(c.grade) || s.id === STUDY_HALL) continue;
      const pool = teachersBySubject(s.id);
      classSubjectTeacher.set(`${c.id}|${s.id}`, pool[idx % pool.length]!.id);
    }
  });
  const timetable: TimetableSlot[] = [];
  const quota = new Map<string, number>();
  for (const c of classes) for (const s of subjects) if (s.grades.includes(c.grade) && s.periodsPerWeek) quota.set(`${c.id}|${s.id}`, s.periodsPerWeek);
  const teachingPeriods = PERIODS.filter((p) => !p.isBreak);
  for (let d = 0; d < 5; d++) {
    for (const p of teachingPeriods) {
      const busy = new Set<string>();
      for (const c of classes) {
        const usedToday = new Set(timetable.filter((t) => t.classId === c.id && t.day === d).map((t) => t.subjectId));
        const cands = subjects
          .filter((s) => (quota.get(`${c.id}|${s.id}`) ?? 0) > 0)
          .map((s) => ({ s, w: (quota.get(`${c.id}|${s.id}`) ?? 0) + rng() * 2 - (usedToday.has(s.id) ? 3 : 0) }))
          .sort((a, b) => b.w - a.w);
        const choice = cands.find(({ s }) => !busy.has(classSubjectTeacher.get(`${c.id}|${s.id}`)!));
        if (choice) {
          const tid = classSubjectTeacher.get(`${c.id}|${choice.s.id}`)!;
          busy.add(tid);
          quota.set(`${c.id}|${choice.s.id}`, quota.get(`${c.id}|${choice.s.id}`)! - 1);
          const lab = choice.s.type === "Lab" ? `Lab ${choice.s.code}` : choice.s.id === "sub-pe" ? "Sports field" : choice.s.id === "sub-cs" ? "Computer lab" : c.room;
          timetable.push({ id: `tt-${c.id}-${d}-${p.no}`, classId: c.id, day: d, period: p.no, subjectId: choice.s.id, teacherId: tid, room: lab });
        } else {
          timetable.push({ id: `tt-${c.id}-${d}-${p.no}`, classId: c.id, day: d, period: p.no, subjectId: STUDY_HALL, teacherId: null, room: "Library" });
        }
      }
    }
  }
  for (const t of teachers) t.weeklyPeriods = timetable.filter((s) => s.teacherId === t.id).length;

  /* ---------------- assignments ---------------- */
  const ASSIGN_TITLES: Record<string, string[]> = {
    "sub-math": ["Quadratic equations worksheet", "Trigonometry problem set", "Statistics project: school survey", "Coordinate geometry practice"],
    "sub-eng": ["Essay: themes in 'Animal Farm'", "Poetry analysis", "Persuasive letter", "Book review"],
    "sub-phy": ["Lab report: pendulum motion", "Electricity circuits worksheet", "Newton's laws problems"],
    "sub-chem": ["Titration lab report", "Periodic table trends", "Balancing equations set"],
    "sub-bio": ["Cell structure diagram", "Ecosystem field study", "Human digestion notes"],
    "sub-cs": ["Python: sorting algorithms", "Build a personal webpage", "Binary & logic gates quiz prep"],
    "sub-hist": ["Source analysis: Industrial Revolution", "Timeline of World War I"],
    "sub-geo": ["Map work: river systems", "Climate zones project"],
  };
  const assignments: Assignment[] = [];
  let an = 1;
  for (const c of classes) {
    const subs = Object.keys(ASSIGN_TITLES);
    const count = c.id === "c-10A" ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const sid = c.id === "c-10A" && i < 4 ? "sub-math" : subs[(i + c.grade) % subs.length]!;
      const offset = i < 3 ? int(1, 9) : -int(1, 20);
      const total = c.strength;
      const submitted = offset > 0 ? int(4, 18) : int(18, 24);
      assignments.push({
        id: `as-${an++}`, title: pick(ASSIGN_TITLES[sid]!), subjectId: sid, classId: c.id,
        teacherId: classSubjectTeacher.get(`${c.id}|${sid}`)!,
        description: "Complete all questions showing full working. Upload a single PDF or type your answer below. Late submissions lose 10% per day.",
        type: pick(["Homework", "Project", "Worksheet", "Essay", "Lab report"]),
        assignedOn: day(offset - int(5, 10)), dueDate: day(offset), maxMarks: pick([10, 20, 25, 50]),
        submitted, graded: offset > 0 ? int(0, 3) : Math.min(submitted, int(10, 24)), total,
        status: offset > 0 ? "Open" : "Closed",
      });
    }
  }

  /* ---------------- exams ---------------- */
  const exams: Exam[] = [];
  let en = 1;
  for (const c of classes) {
    const subs = EXAM_SUBJECTS(c.grade).slice(0, 6);
    subs.forEach((sid, i) => {
      exams.push({ id: `ex-${en++}`, term: "QTR", name: "Quarterly", classId: c.id, subjectId: sid, date: day(-20 + i), start: "09:00", durationMin: 120, maxMarks: 100, room: c.room, invigilatorId: pick(teachers).id, status: "Completed" });
      exams.push({ id: `ex-${en++}`, term: "UT2", name: "Unit Test 2", classId: c.id, subjectId: sid, date: day(9 + i + (i >= 4 ? 2 : 0)), start: "09:00", durationMin: 60, maxMarks: 25, room: c.room, invigilatorId: pick(teachers).id, status: "Scheduled" });
    });
  }

  /* ---------------- quizzes ---------------- */
  const quizzes: Quiz[] = [];
  let qn = 1;
  const bankSubjects = Object.keys(QUESTION_BANK);
  for (const c of classes) {
    for (let i = 0; i < 4; i++) {
      const sid = c.id === "c-10A" && i === 0 ? "sub-math" : bankSubjects[(i + c.grade) % bankSubjects.length]!;
      const bank = QUESTION_BANK[sid]!;
      const sname = subjects.find((s) => s.id === sid)!.name;
      const status: Quiz["status"] = i === 3 ? "Closed" : i === 2 && c.id !== "c-10A" ? "Draft" : "Published";
      quizzes.push({
        id: `qz-${qn}`, title: `${sname} ${["checkpoint", "weekly quiz", "revision quiz", "chapter test"][i]}`,
        subjectId: sid, classId: c.id, teacherId: classSubjectTeacher.get(`${c.id}|${sid}`)!,
        durationMin: pick([10, 15, 20]), dueDate: day(status === "Closed" ? -int(2, 10) : int(1, 6)), status,
        attempts: status === "Draft" ? 0 : int(8, 24), avgScore: status === "Draft" ? 0 : int(58, 88),
        questions: bank.map((q, k) => ({ ...q, id: `qz-${qn}-q${k + 1}`, points: 1 })),
      });
      qn++;
    }
  }

  /* ---------------- live sessions ---------------- */
  const live: SessionSeed[] = [];
  let ln = 1;
  const addLive = (s: Omit<SessionSeed, "id">) => live.push({ ...s, id: `lv-${ln++}` });
  addLive({ title: "Quadratic equations – factorisation methods", subjectId: "sub-math", classId: "c-10A", teacherId: "t-001", offsetMin: -12, durationMin: 45, attendees: 21, capacity: 30, kind: "Class" });
  addLive({ title: "Trigonometric ratios – guided practice", subjectId: "sub-math", classId: "c-12A", teacherId: "t-001", offsetMin: 95, durationMin: 45, attendees: 0, capacity: 30, kind: "Class" });
  addLive({ title: "Parent–teacher conference: Term 1 progress", subjectId: "sub-math", classId: "c-10A", teacherId: "t-001", offsetMin: 60 * 26, durationMin: 30, attendees: 0, capacity: 40, kind: "Parent meeting" });
  addLive({ title: "Grade 7 parents: settling-in review", subjectId: "sub-eng", classId: "c-7B", teacherId: classes.find((c) => c.id === "c-7B")!.classTeacherId, offsetMin: 60 * 50, durationMin: 40, attendees: 0, capacity: 40, kind: "Parent meeting" });
  addLive({ title: "Staff briefing: Unit Test 2 moderation", subjectId: "sub-math", classId: "c-10A", teacherId: "t-001", offsetMin: 60 * 5, durationMin: 30, attendees: 0, capacity: 60, kind: "Staff meeting" });
  for (const c of classes) {
    const slots = timetable.filter((t) => t.classId === c.id && t.teacherId).slice(0, 3);
    slots.forEach((s, i) => {
      const sname = subjects.find((x) => x.id === s.subjectId)!.name;
      const offset = i === 0 ? (c.grade % 3 === 0 ? -8 : 40 + c.grade * 7) : i === 1 ? 60 * 24 + c.grade * 10 : -60 * 24 * (1 + c.grade % 4);
      addLive({ title: `${sname}: ${["concept session", "doubt clearing", "revision"][i]}`, subjectId: s.subjectId, classId: c.id, teacherId: s.teacherId!, offsetMin: offset, durationMin: 45, attendees: offset < 0 ? int(15, 24) : 0, capacity: 30, kind: "Class", recording: offset < -60 ? `rec-${ln}` : undefined });
    });
  }
  addLive({ title: "Science fair orientation (all grades)", subjectId: "sub-phy", classId: "c-10A", teacherId: "t-006", offsetMin: 60 * 72, durationMin: 60, attendees: 0, capacity: 400, kind: "Webinar" });

  /* ---------------- library ---------------- */
  const BOOKS: [string, string, string, string, number][] = [
    ["To Kill a Mockingbird", "Harper Lee", "Fiction", "J. B. Lippincott", 1960], ["1984", "George Orwell", "Fiction", "Secker & Warburg", 1949],
    ["Animal Farm", "George Orwell", "Fiction", "Secker & Warburg", 1945], ["Pride and Prejudice", "Jane Austen", "Classics", "T. Egerton", 1813],
    ["The Great Gatsby", "F. Scott Fitzgerald", "Classics", "Scribner", 1925], ["Frankenstein", "Mary Shelley", "Classics", "Lackington", 1818],
    ["A Brief History of Time", "Stephen Hawking", "Science", "Bantam", 1988], ["The Selfish Gene", "Richard Dawkins", "Science", "Oxford UP", 1976],
    ["Cosmos", "Carl Sagan", "Science", "Random House", 1980], ["The Origin of Species", "Charles Darwin", "Science", "John Murray", 1859],
    ["Sapiens", "Yuval Noah Harari", "History", "Harvill Secker", 2014], ["Guns, Germs, and Steel", "Jared Diamond", "History", "W. W. Norton", 1997],
    ["The Diary of a Young Girl", "Anne Frank", "Biography", "Contact Publishing", 1947], ["Long Walk to Freedom", "Nelson Mandela", "Biography", "Little, Brown", 1994],
    ["I Am Malala", "Malala Yousafzai", "Biography", "Weidenfeld & Nicolson", 2013], ["Wings of Fire", "A. P. J. Abdul Kalam", "Biography", "Universities Press", 1999],
    ["Concepts of Physics Vol. 1", "H. C. Verma", "Textbooks", "Bharati Bhawan", 1992], ["Calculus", "Michael Spivak", "Textbooks", "Publish or Perish", 1967],
    ["Organic Chemistry", "Clayden, Greeves & Warren", "Textbooks", "Oxford UP", 2001], ["Campbell Biology", "Urry, Cain et al.", "Textbooks", "Pearson", 1987],
    ["Introduction to Algorithms", "Cormen, Leiserson et al.", "Computing", "MIT Press", 1990], ["Automate the Boring Stuff with Python", "Al Sweigart", "Computing", "No Starch", 2015],
    ["Clean Code", "Robert C. Martin", "Computing", "Prentice Hall", 2008], ["The Pragmatic Programmer", "Hunt & Thomas", "Computing", "Addison-Wesley", 1999],
    ["Wonder", "R. J. Palacio", "Young adult", "Knopf", 2012], ["The Hobbit", "J. R. R. Tolkien", "Young adult", "Allen & Unwin", 1937],
    ["Holes", "Louis Sachar", "Young adult", "Farrar, Straus", 1998], ["The Giver", "Lois Lowry", "Young adult", "Houghton Mifflin", 1993],
    ["Things Fall Apart", "Chinua Achebe", "Fiction", "Heinemann", 1958], ["One Hundred Years of Solitude", "Gabriel García Márquez", "Fiction", "Harper & Row", 1967],
    ["The Alchemist", "Paulo Coelho", "Fiction", "HarperCollins", 1988], ["Of Mice and Men", "John Steinbeck", "Classics", "Covici Friede", 1937],
    ["Freakonomics", "Levitt & Dubner", "Economics", "William Morrow", 2005], ["Thinking, Fast and Slow", "Daniel Kahneman", "Psychology", "FSG", 2011],
    ["Atlas of World Geography", "Oxford Cartographers", "Reference", "Oxford UP", 2019], ["Oxford English Dictionary (Concise)", "Oxford", "Reference", "Oxford UP", 2011],
    ["The Story of Art", "E. H. Gombrich", "Arts", "Phaidon", 1950], ["Mathematical Olympiad Challenges", "Andreescu & Gelca", "Textbooks", "Birkhäuser", 2000],
    ["Silent Spring", "Rachel Carson", "Science", "Houghton Mifflin", 1962], ["The Gene", "Siddhartha Mukherjee", "Science", "Scribner", 2016],
  ];
  const COVERS = ["#2b4c9b", "#8a3563", "#1f6f54", "#8a5a1b", "#0f6e8c", "#5b3f8c", "#a33b2b", "#3d5a40"];
  const books: Book[] = BOOKS.map(([title, author, category, publisher, year], i) => {
    const copies = int(2, 8);
    return {
      id: `bk-${i + 1}`, isbn: `978-${int(0, 9)}-${int(100, 999)}-${int(10000, 99999)}-${int(0, 9)}`, title, author, category, publisher, year,
      copies, available: 0, shelf: `${String.fromCharCode(65 + (i % 8))}-${int(1, 12)}`, rating: Math.round((3.8 + rng() * 1.2) * 10) / 10,
      cover: COVERS[i % COVERS.length]!,
    };
  });
  const issues: BookIssue[] = [];
  let iss = 1;
  const addIssue = (b: Book, memberId: string, memberName: string, memberType: BookIssue["memberType"], issuedAgo: number, returned: boolean) => {
    const issuedOn = day(-issuedAgo);
    const dueOn = day(-issuedAgo + 14);
    const overdue = !returned && -issuedAgo + 14 < 0;
    issues.push({
      id: `is-${iss++}`, bookId: b.id, bookTitle: b.title, memberId, memberName, memberType, issuedOn, dueOn,
      returnedOn: returned ? day(-issuedAgo + int(3, 13)) : null, status: returned ? "Returned" : overdue ? "Overdue" : "Issued",
      fine: overdue ? (issuedAgo - 14) * 0.5 : 0,
    });
  };
  addIssue(books[4]!, "s-1192", "Elena Vasquez", "Student", 6, false);
  addIssue(books[6]!, "s-1192", "Elena Vasquez", "Student", 17, false);
  addIssue(books[24]!, "s-1072", "Mateo Vasquez", "Student", 4, false);
  addIssue(books[17]!, "t-001", "Priya Raman", "Teacher", 9, false);
  for (let i = 0; i < 70; i++) {
    const b = pick(books);
    const member = rng() > 0.2 ? pick(students) : pick(teachers);
    addIssue(b, member.id, member.name, "admissionNo" in member ? "Student" : "Teacher", int(1, 40), rng() > 0.55);
  }
  for (const b of books) {
    const out = issues.filter((x) => x.bookId === b.id && x.status !== "Returned").length;
    b.copies = Math.max(b.copies, out);
    b.available = b.copies - out;
  }

  /* ---------------- fees ---------------- */
  const invoices: FeeInvoice[] = [];
  let inv = 1;
  for (const s of students) {
    const c = classes.find((x) => x.id === s.classId)!;
    const tuition = 2100 + c.grade * 60;
    for (const [term, dueOffset] of [["Term 1", -45], ["Term 2", 18]] as const) {
      const items = [
        { label: "Tuition", amount: tuition }, { label: "Laboratory", amount: c.grade >= 9 ? 180 : 90 },
        { label: "Library & digital resources", amount: 60 }, { label: "Activities & sports", amount: 150 },
        ...(s.transport !== "Own transport" ? [{ label: `Transport (${s.transport})`, amount: 320 }] : []),
      ];
      const amount = items.reduce((a, b) => a + b.amount, 0);
      const r = rng();
      let paid = 0;
      if (term === "Term 1") paid = r > 0.08 ? amount : r > 0.03 ? Math.round(amount * 0.5) : 0;
      else paid = r > 0.55 ? amount : r > 0.35 ? Math.round(amount * 0.4) : 0;
      if (s.id === "s-1192" && term === "Term 2") paid = 0;
      const status: FeeInvoice["status"] = paid >= amount ? "Paid" : paid > 0 ? "Partial" : dueOffset < 0 ? "Overdue" : "Due";
      invoices.push({
        id: `inv-${inv}`, invoiceNo: `INV-26-${String(inv).padStart(5, "0")}`, studentId: s.id, studentName: s.name, classId: s.classId,
        term, items, amount, paid, dueDate: day(dueOffset), status,
        lastPaymentOn: paid ? day(dueOffset - int(1, 20)) : null, method: paid ? pick(["Card", "Bank transfer", "UPI", "Cash", "Cheque"]) : null,
      });
      inv++;
    }
    const mine = invoices.filter((i) => i.studentId === s.id);
    s.feeStatus = mine.some((i) => i.status === "Overdue") ? "Overdue" : mine.some((i) => i.status === "Partial") ? "Partial" : mine.some((i) => i.status === "Due") ? "Due" : "Paid";
  }

  /* ---------------- notices, events, admissions ---------------- */
  const notices: Notice[] = [
    { id: "n-1", title: "Unit Test 2 timetable published", body: "Unit Test 2 runs from next week for Grades 6–12. Seating plans are on the exams page. Students must carry their ID cards.", audience: "All", priority: "Important", postedBy: "Examinations Office", date: day(-1), pinned: true },
    { id: "n-2", title: "Parent–teacher conferences", body: "Book a 10-minute online slot with each subject teacher through the parent portal. Slots close 48 hours before the meeting.", audience: "Parents", priority: "Important", postedBy: "Dr. Helen Okafor", date: day(-2), pinned: true },
    { id: "n-3", title: "Inter-house athletics trials", body: "Trials for the 100 m, 400 m, relay and long jump take place on the sports field after school on Thursday.", audience: "Students", priority: "Normal", postedBy: "Sports Department", date: day(-3), pinned: false },
    { id: "n-4", title: "Term 2 fee reminder", body: "Term 2 fees are due in 18 days. Pay online by card, bank transfer or UPI from the fees page to avoid late charges.", audience: "Parents", priority: "Normal", postedBy: "Finance Office", date: day(-4), pinned: false },
    { id: "n-5", title: "Staff moderation meeting", body: "Heads of department meet in the conference room on Wednesday at 3:45 pm to moderate Quarterly exam papers.", audience: "Teachers", priority: "Normal", postedBy: "Academic Coordinator", date: day(-4), pinned: false },
    { id: "n-6", title: "Campus Wi-Fi maintenance", body: "Wi-Fi will be unavailable on Saturday between 06:00 and 10:00 while access points are upgraded.", audience: "All", priority: "Normal", postedBy: "IT Services", date: day(-6), pinned: false },
    { id: "n-7", title: "Science fair registrations open", body: "Teams of up to three can register projects until the 15th. Mentors will be assigned within a week of registration.", audience: "Students", priority: "Normal", postedBy: "Science Department", date: day(-7), pinned: false },
    { id: "n-8", title: "Library extends evening hours", body: "The library now stays open until 6:30 pm on weekdays during exam season.", audience: "All", priority: "Normal", postedBy: "Library", date: day(-8), pinned: false },
    { id: "n-9", title: "Flu vaccination drive", body: "The school nurse will run a voluntary flu vaccination drive. Consent forms must be signed by parents in the portal.", audience: "Parents", priority: "Urgent", postedBy: "Health Centre", date: day(-9), pinned: false },
    { id: "n-10", title: "Updated safeguarding policy", body: "All staff must read and acknowledge the updated safeguarding policy by the end of the month.", audience: "Staff", priority: "Important", postedBy: "HR", date: day(-11), pinned: false },
  ];
  const events: CalendarEvent[] = [
    { id: "e-1", title: "Unit Test 2 begins", date: day(9), endDate: day(16), type: "Exam", location: "All classrooms" },
    { id: "e-2", title: "Parent–teacher conferences", date: day(1), type: "Meeting", location: "Online" },
    { id: "e-3", title: "Inter-house athletics", date: day(4), type: "Sports", location: "Sports field" },
    { id: "e-4", title: "Mid-term break", date: day(24), endDate: day(28), type: "Holiday", location: "School closed" },
    { id: "e-5", title: "Science fair", date: day(32), type: "Academic", location: "Main hall" },
    { id: "e-6", title: "Annual music concert", date: day(40), type: "Cultural", location: "Auditorium" },
    { id: "e-7", title: "Board of governors meeting", date: day(6), type: "Meeting", location: "Conference room" },
    { id: "e-8", title: "Model United Nations", date: day(12), endDate: day(13), type: "Academic", location: "Seminar block" },
    { id: "e-9", title: "Founders' Day", date: day(-5), type: "Cultural", location: "Auditorium" },
    { id: "e-10", title: "Quarterly results released", date: day(-3), type: "Academic", location: "Portal" },
    { id: "e-11", title: "Swimming gala", date: day(19), type: "Sports", location: "Aquatic centre" },
    { id: "e-12", title: "Half-Yearly exams", date: day(70), endDate: day(80), type: "Exam", location: "All classrooms" },
    { id: "e-13", title: "Staff professional development day", date: day(2), type: "Meeting", location: "Library" },
    { id: "e-14", title: "Art exhibition", date: day(15), type: "Cultural", location: "Gallery corridor" },
  ];
  const stages: Admission["stage"][] = ["Applied", "Screening", "Interview", "Offered", "Enrolled", "Declined"];
  const admissions: Admission[] = Array.from({ length: 30 }, (_, i) => {
    const female = rng() > 0.5;
    const last = pick(LAST);
    const stage = stages[Math.min(5, Math.floor(rng() * rng() * 7))]!;
    return {
      id: `ad-${i + 1}`, applicationNo: `APP-27-${String(310 + i).padStart(4, "0")}`, name: `${pick(female ? FIRST_F : FIRST_M)} ${last}`,
      grade: int(6, 11), parentName: `${pick(rng() > 0.5 ? FIRST_F : FIRST_M)} ${last}`, phone: `+1 555 04${String(i).padStart(2, "0")} ${int(1000, 9999)}`,
      email: `${last.toLowerCase().replace(/[^a-z]/g, "")}.family${i}@mail.com`, previousSchool: pick(["Riverside Academy", "St. Mary's School", "Greenwood High", "Lakeside International", "Home-schooled"]),
      stage, appliedOn: day(-int(1, 60)), score: stage === "Applied" ? null : int(52, 96),
    };
  });

  /* ---------------- messages ---------------- */
  const t = (d: number, h: number, m: number) => { const x = addDays(today, d); x.setHours(h, m, 0, 0); return x.toISOString(); };
  const threads: Thread[] = [
    { id: "th-1", owner: "teacher", with: "Isabel Vasquez", withRole: "Parent of Elena (10-A)", subject: "Elena's statistics project", unread: 1, messages: [
      { id: "m1", from: "them", text: "Hi Ms. Raman, Elena mentioned the statistics project. Can she survey students from other grades too?", at: t(-1, 18, 12) },
      { id: "m2", from: "me", text: "Absolutely — a wider sample will strengthen her analysis. Please ask her to note the grade for each response.", at: t(-1, 19, 3) },
      { id: "m3", from: "them", text: "Wonderful, thank you! Will she need consent forms?", at: t(0, 7, 41) },
    ] },
    { id: "th-2", owner: "teacher", with: "Dr. Helen Okafor", withRole: "Principal", subject: "Moderation schedule", unread: 0, messages: [
      { id: "m1", from: "them", text: "Priya, could the maths department share the moderated Quarterly papers by Wednesday?", at: t(-2, 10, 5) },
      { id: "m2", from: "me", text: "Yes, we'll have them uploaded by Tuesday evening.", at: t(-2, 10, 32) },
    ] },
    { id: "th-3", owner: "teacher", with: "Kwame Mensah", withRole: "Student, 10-A", subject: "Question about homework", unread: 2, messages: [
      { id: "m1", from: "them", text: "Ma'am, in question 7 should we use the quadratic formula or factorise?", at: t(0, 8, 2) },
      { id: "m2", from: "them", text: "Sorry, I meant question 7(b).", at: t(0, 8, 4) },
    ] },
    { id: "th-4", owner: "student", with: "Priya Raman", withRole: "Mathematics teacher", subject: "Statistics project", unread: 1, messages: [
      { id: "m1", from: "me", text: "Ms. Raman, is it okay if my survey includes students from Grade 9 too?", at: t(-1, 17, 30) },
      { id: "m2", from: "them", text: "Yes, that's a great idea. Label the grade for each response so you can compare groups.", at: t(-1, 19, 5) },
    ] },
    { id: "th-5", owner: "student", with: "Science Club", withRole: "Group · 18 members", subject: "Science fair team", unread: 4, messages: [
      { id: "m1", from: "them", text: "Team meeting at lunch tomorrow in Lab PHY. Bring your project ideas!", at: t(0, 9, 15) },
    ] },
    { id: "th-6", owner: "parent", with: "Priya Raman", withRole: "Class teacher, 10-A", subject: "Elena's statistics project", unread: 1, messages: [
      { id: "m1", from: "me", text: "Hi Ms. Raman, Elena mentioned the statistics project. Can she survey students from other grades too?", at: t(-1, 18, 12) },
      { id: "m2", from: "them", text: "Absolutely — a wider sample will strengthen her analysis.", at: t(-1, 19, 3) },
    ] },
    { id: "th-7", owner: "parent", with: "Finance Office", withRole: "Accounts", subject: "Term 2 invoice", unread: 0, messages: [
      { id: "m1", from: "them", text: "Dear parent, the Term 2 invoice for Elena is now available. You can pay online from the fees page.", at: t(-3, 11, 0) },
    ] },
    { id: "th-8", owner: "admin", with: "Priya Raman", withRole: "Head of Mathematics", subject: "Moderation schedule", unread: 1, messages: [
      { id: "m1", from: "me", text: "Priya, could the maths department share the moderated Quarterly papers by Wednesday?", at: t(-2, 10, 5) },
      { id: "m2", from: "them", text: "Yes, we'll have them uploaded by Tuesday evening.", at: t(-2, 10, 32) },
    ] },
    { id: "th-9", owner: "admin", with: "Grace Liu", withRole: "Finance Officer", subject: "Overdue Term 1 accounts", unread: 2, messages: [
      { id: "m1", from: "them", text: "We have 14 overdue Term 1 accounts. Shall I send the second reminder today?", at: t(0, 9, 12) },
    ] },
    { id: "th-10", owner: "librarian", with: "Priya Raman", withRole: "Teacher", subject: "Olympiad books", unread: 1, messages: [
      { id: "m1", from: "them", text: "Could we order three more copies of the Olympiad challenge book?", at: t(0, 8, 50) },
    ] },
    { id: "th-11", owner: "accountant", with: "Dr. Helen Okafor", withRole: "Principal", subject: "Overdue Term 1 accounts", unread: 0, messages: [
      { id: "m1", from: "me", text: "We have 14 overdue Term 1 accounts. Shall I send the second reminder today?", at: t(0, 9, 12) },
      { id: "m2", from: "them", text: "Yes please, and flag any family needing a payment plan.", at: t(0, 9, 40) },
    ] },
  ];

  return { subjects, teachers, classes, students, timetable, assignments, exams, quizzes, live, books, issues, invoices, notices, events, admissions, threads };
}

/* -------- deterministic derived data (marks, attendance, submissions) -------- */

export function generatedMark(student: { id: string; ability: number }, subjectId: string, termId: string, max: number) {
  const r = mulberry32(hashStr(`${student.id}|${subjectId}|${termId}`))();
  const subjBias = (mulberry32(hashStr(`${student.id}|${subjectId}`))() - 0.5) * 0.22;
  const pct = Math.max(0.18, Math.min(1, student.ability + subjBias + (r - 0.5) * 0.18));
  return Math.round(pct * max);
}

export function generatedAttendance(student: { id: string; ability: number }, date: string): "P" | "A" | "L" | "E" {
  const r = mulberry32(hashStr(`${student.id}|${date}`))();
  const pAbsent = 0.02 + (1 - student.ability) * 0.12;
  if (r < pAbsent) return "A";
  if (r < pAbsent + 0.03) return "L";
  if (r < pAbsent + 0.04) return "E";
  return "P";
}
