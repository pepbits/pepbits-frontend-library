import { SCHOOL_ROLE_CONFIG, schoolAllowedPaths, type SchoolRoleConfig } from "@pepbits/erp-config";
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

export const ROLE_CONFIG = Object.fromEntries(Object.entries(SCHOOL_ROLE_CONFIG).map(([role, config]) => [role, {...config, nav: config.nav.map(group => ({...group, items: group.items.map(item => ({...item, icon: Object.values(I).find(source => source.href === item.href)!.icon}))}))}])) as Record<Role, SchoolRoleConfig & {nav: NavGroup[]}>;
export const allowedPaths = schoolAllowedPaths;

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
