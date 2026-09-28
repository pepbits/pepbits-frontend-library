import {
  Award, BarChart3, BookOpen, CalendarCheck, CalendarClock, CalendarDays, ClipboardList, FileText, GraduationCap,
  Kanban, LayoutDashboard, Library, ListChecks, Megaphone, MessageSquare, PenTool, School, Settings, Table2,
  UserCog, Users, Video, Wallet, type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem { href: string; label: string; icon: LucideIcon; title?: string }
export interface NavGroup { label: string; items: NavItem[] }

const I = {
  dashboard: { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  reports: { href: "/reports", label: "Reports", icon: BarChart3, title: "Reports & analytics" },
  students: { href: "/students", label: "Students", icon: GraduationCap },
  teachers: { href: "/teachers", label: "Teachers", icon: UserCog },
  admissions: { href: "/admissions", label: "Admissions", icon: Kanban },
  classes: { href: "/classes", label: "Classes", icon: School, title: "Classes & sections" },
  subjects: { href: "/subjects", label: "Subjects", icon: BookOpen },
  timetable: { href: "/timetable", label: "Timetable", icon: CalendarClock },
  attendance: { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  assignments: { href: "/assignments", label: "Assignments", icon: FileText },
  quizzes: { href: "/quizzes", label: "Quizzes", icon: ListChecks },
  exams: { href: "/exams", label: "Exams", icon: ClipboardList, title: "Examinations" },
  marks: { href: "/marks", label: "Mark list", icon: Table2 },
  results: { href: "/marks", label: "Results", icon: Award, title: "Results & report card" },
  live: { href: "/live", label: "Live classes", icon: Video },
  whiteboard: { href: "/whiteboard", label: "Whiteboard", icon: PenTool },
  library: { href: "/library", label: "Library", icon: Library },
  fees: { href: "/fees", label: "Fees", icon: Wallet, title: "Fees & payments" },
  calendar: { href: "/calendar", label: "Calendar", icon: CalendarDays, title: "School calendar" },
  notices: { href: "/notices", label: "Notices", icon: Megaphone, title: "Notice board" },
  messages: { href: "/messages", label: "Messages", icon: MessageSquare },
  settings: { href: "/settings", label: "Settings", icon: Settings },
} satisfies Record<string, NavItem>;

export interface RoleConfig {
  label: string;
  description: string;
  /** Portals with many modules get a sidebar; small portals get a compact top bar. */
  navMode: "sidebar" | "topbar";
  /** Students and teachers work in focus mode: the sidebar folds away after each navigation. */
  collapseOnNavigate: boolean;
  nav: NavGroup[];
}

export const ROLE_CONFIG: Record<Role, RoleConfig> = {
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

export function allowedPaths(role: Role) {
  return [...ALWAYS_ALLOWED, ...ROLE_CONFIG[role].nav.flatMap((g) => g.items.map((i) => i.href))];
}

const EXTRA_TITLES: [string, string][] = [
  ["/students/new", "Student registration"],
  ["/teachers/new", "Teacher registration"],
  ["/quizzes/new", "Quiz builder"],
  ["/quizzes/", "Quiz"],
  ["/live/", "Live classroom"],
];

export function pageMeta(role: Role, pathname: string) {
  for (const [p, t] of EXTRA_TITLES) if (pathname.startsWith(p)) {
    const parent = ROLE_CONFIG[role].nav.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))).find((i) => p.startsWith(i.href));
    return { title: t, group: parent?.label ?? "" };
  }
  for (const g of ROLE_CONFIG[role].nav) for (const i of g.items) {
    if (pathname === i.href || pathname.startsWith(i.href + "/")) return { title: i.title ?? i.label, group: g.label };
  }
  if (pathname.startsWith("/settings")) return { title: "Settings", group: "Account" };
  return { title: "Dashboard", group: "" };
}

export { I as NAV_ITEMS, Users };
