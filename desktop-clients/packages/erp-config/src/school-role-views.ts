/** Canonical School portal views. Routing metadata is not server authority. */
export type SchoolRole = "admin" | "teacher" | "student" | "parent" | "librarian" | "accountant";
export interface SchoolNavItem { href: string; label: string; title?: string }
export interface SchoolNavGroup { label: string; items: SchoolNavItem[] }
const I = {
  dashboard: { href: "/dashboard", label: "Dashboard" },
  reports: { href: "/reports", label: "Reports", title: "Reports & analytics" },
  students: { href: "/students", label: "Students" },
  teachers: { href: "/teachers", label: "Teachers" },
  admissions: { href: "/admissions", label: "Admissions" },
  classes: { href: "/classes", label: "Classes", title: "Classes & sections" },
  subjects: { href: "/subjects", label: "Subjects" },
  timetable: { href: "/timetable", label: "Timetable" },
  attendance: { href: "/attendance", label: "Attendance" },
  assignments: { href: "/assignments", label: "Assignments" },
  quizzes: { href: "/quizzes", label: "Quizzes" },
  exams: { href: "/exams", label: "Exams", title: "Examinations" },
  marks: { href: "/marks", label: "Mark list" },
  results: { href: "/marks", label: "Results", title: "Results & report card" },
  live: { href: "/live", label: "Live classes" },
  whiteboard: { href: "/whiteboard", label: "Whiteboard" },
  library: { href: "/library", label: "Library" },
  fees: { href: "/fees", label: "Fees", title: "Fees & payments" },
  calendar: { href: "/calendar", label: "Calendar", title: "School calendar" },
  notices: { href: "/notices", label: "Notices", title: "Notice board" },
  messages: { href: "/messages", label: "Messages" },
  settings: { href: "/settings", label: "Settings" },
};

export interface SchoolRoleConfig {
  label: string;
  description: string;
  /** Portals with many modules get a sidebar; small portals get a compact top bar. */
  navMode: "sidebar" | "topbar";
  /** Students and teachers work in focus mode: the sidebar folds away after each navigation. */
  collapseOnNavigate: boolean;
  nav: SchoolNavGroup[];
}

export const SCHOOL_ROLE_CONFIG: Record<SchoolRole, SchoolRoleConfig> = {
  admin: {
    label: "Administration", description: "Run the whole school: people, academics, finance and reporting.",
    navMode: "sidebar", collapseOnNavigate: false,
    nav: [
      { label: "Overview", items: [I.dashboard, I.reports] },
      { label: "People", items: [I.students, I.teachers, I.admissions] },
      { label: "Academics", items: [I.classes, I.subjects, I.timetable, I.attendance, I.assignments, I.quizzes, I.exams, I.marks] },
      { label: "Learning", items: [I.live, I.whiteboard, I.library] },
      { label: "Operations", items: [I.fees, I.calendar, I.notices, I.messages] },
    ],
  },
  teacher: {
    label: "Teacher", description: "Teach live, set work, take attendance and enter marks.",
    navMode: "sidebar", collapseOnNavigate: true,
    nav: [
      { label: "Today", items: [I.dashboard, I.timetable, I.attendance] },
      { label: "Teaching", items: [I.live, I.whiteboard, I.assignments, I.quizzes] },
      { label: "Assessment", items: [I.exams, I.marks] },
      { label: "School", items: [{ ...I.classes, label: "My classes" }, I.students, I.library, I.calendar, I.notices, I.messages] },
    ],
  },
  student: {
    label: "Student", description: "Join classes, submit work, take quizzes and track results.",
    navMode: "sidebar", collapseOnNavigate: true,
    nav: [
      { label: "Today", items: [I.dashboard, I.timetable, I.live] },
      { label: "Learning", items: [I.assignments, I.quizzes, I.whiteboard, I.library] },
      { label: "Progress", items: [I.exams, I.results, I.attendance] },
      { label: "School", items: [I.fees, I.calendar, I.notices, I.messages] },
    ],
  },
  parent: {
    label: "Parent", description: "Follow your children's attendance, results and fees.",
    navMode: "topbar", collapseOnNavigate: true,
    nav: [{ label: "Parent", items: [{ ...I.dashboard, label: "Overview" }, I.attendance, I.results, I.timetable, I.fees, { ...I.live, label: "Meetings" }, I.notices, I.messages] }],
  },
  librarian: {
    label: "Library", description: "Manage the catalogue, circulation and fines.",
    navMode: "topbar", collapseOnNavigate: true,
    nav: [{ label: "Library", items: [I.dashboard, { ...I.library, label: "Catalogue & circulation" }, I.students, I.calendar, I.notices, I.messages] }],
  },
  accountant: {
    label: "Finance", description: "Invoices, collections and outstanding balances.",
    navMode: "topbar", collapseOnNavigate: true,
    nav: [{ label: "Finance", items: [I.dashboard, I.fees, I.students, I.reports, I.notices, I.messages] }],
  },
};

export const ALWAYS_ALLOWED = ["/dashboard", "/settings"];

export function schoolAllowedPaths(role: SchoolRole) {
  return [...ALWAYS_ALLOWED, ...SCHOOL_ROLE_CONFIG[role].nav.flatMap((g) => g.items.map((i) => i.href))];
}


export const SCHOOL_ROLE_VIEWS = ([
  ["reference-school", "admin", "Administrator"],
  ["reference-school-teacher", "teacher", "Teacher"],
  ["reference-school-student", "student", "Student"],
  ["reference-school-parent", "parent", "Parent"],
  ["reference-school-librarian", "librarian", "Librarian"],
  ["reference-school-accountant", "accountant", "Accountant"],
] as const).map(([id, role, label]) => ({ id, role, title: `School ${label}`, shortLabel: `School ${label}`, titleKey: `${id}.title`, shortLabelKey: `${id}.shortLabel`, groups: SCHOOL_ROLE_CONFIG[role].nav }));
export type SchoolRoleViewId = typeof SCHOOL_ROLE_VIEWS[number]["id"];
export function schoolRoleView(moduleId: string | undefined) { return SCHOOL_ROLE_VIEWS.find(view => view.id === moduleId); }
export function schoolRoleForHost(hostRole: string): SchoolRole | null {
  const value = hostRole.trim().toLowerCase();
  const aliases: Record<string, SchoolRole> = { "enterprise-admin": "admin", "finance-manager": "accountant", "operations-analyst": "teacher" };
  if (aliases[value]) return aliases[value];
  const match = /^(?:school[:\-._/])?(admin|teacher|student|parent|librarian|accountant)$/.exec(value);
  return match ? match[1] as SchoolRole : null;
}

export function schoolPathAllowed(role:SchoolRole,path:string):boolean{
 const pathname=path.split('?')[0];
 if(['/students/new','/teachers/new'].includes(pathname))return role==='admin';
 if(pathname==='/quizzes/new')return role==='admin'||role==='teacher';
 return schoolAllowedPaths(role).some(base=>pathname===base||pathname.startsWith(base+'/'));
}
