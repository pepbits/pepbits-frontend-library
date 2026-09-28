/* The 26 authenticated Scholaris pages (source src/app/(app)/**\/page.tsx). The source root "/" was a demo role chooser;
   here "/" resolves to the dashboard because identity comes from the host. Pure data: safe for host navigation code. */
import type { Role } from "./lib/types";

export type SchoolPageId =
  | "dashboard" | "reports" | "students" | "student-registration" | "teachers" | "teacher-registration" | "admissions"
  | "classes" | "subjects" | "timetable" | "attendance" | "assignments" | "quizzes" | "quiz-builder" | "quiz-player"
  | "exams" | "marks" | "live" | "live-room" | "whiteboard" | "library" | "fees" | "calendar" | "notices" | "messages" | "settings";

export interface SchoolRoute {
  path: string;
  title: string;
  id: SchoolPageId;
  /** Source file the page was ported from. */
  source: string;
}

export const SCHOOL_ROUTES: readonly SchoolRoute[] = [
  { path: "/dashboard", title: "Dashboard", id: "dashboard", source: "app/(app)/dashboard/page.tsx" },
  { path: "/reports", title: "Reports & analytics", id: "reports", source: "app/(app)/reports/page.tsx" },
  { path: "/students", title: "Students", id: "students", source: "app/(app)/students/page.tsx" },
  { path: "/students/new", title: "Student registration", id: "student-registration", source: "app/(app)/students/new/page.tsx" },
  { path: "/teachers", title: "Teachers", id: "teachers", source: "app/(app)/teachers/page.tsx" },
  { path: "/teachers/new", title: "Teacher registration", id: "teacher-registration", source: "app/(app)/teachers/new/page.tsx" },
  { path: "/admissions", title: "Admissions", id: "admissions", source: "app/(app)/admissions/page.tsx" },
  { path: "/classes", title: "Classes & sections", id: "classes", source: "app/(app)/classes/page.tsx" },
  { path: "/subjects", title: "Subjects", id: "subjects", source: "app/(app)/subjects/page.tsx" },
  { path: "/timetable", title: "Timetable", id: "timetable", source: "app/(app)/timetable/page.tsx" },
  { path: "/attendance", title: "Attendance", id: "attendance", source: "app/(app)/attendance/page.tsx" },
  { path: "/assignments", title: "Assignments", id: "assignments", source: "app/(app)/assignments/page.tsx" },
  { path: "/quizzes", title: "Quizzes", id: "quizzes", source: "app/(app)/quizzes/page.tsx" },
  { path: "/quizzes/new", title: "Quiz builder", id: "quiz-builder", source: "app/(app)/quizzes/new/page.tsx" },
  { path: "/quizzes/:id", title: "Quiz", id: "quiz-player", source: "app/(app)/quizzes/[id]/page.tsx" },
  { path: "/exams", title: "Examinations", id: "exams", source: "app/(app)/exams/page.tsx" },
  { path: "/marks", title: "Mark list & results", id: "marks", source: "app/(app)/marks/page.tsx" },
  { path: "/live", title: "Live classes", id: "live", source: "app/(app)/live/page.tsx" },
  { path: "/live/:id", title: "Live classroom", id: "live-room", source: "app/(app)/live/[id]/page.tsx" },
  { path: "/whiteboard", title: "Whiteboard", id: "whiteboard", source: "app/(app)/whiteboard/page.tsx" },
  { path: "/library", title: "Library", id: "library", source: "app/(app)/library/page.tsx" },
  { path: "/fees", title: "Fees & payments", id: "fees", source: "app/(app)/fees/page.tsx" },
  { path: "/calendar", title: "School calendar", id: "calendar", source: "app/(app)/calendar/page.tsx" },
  { path: "/notices", title: "Notice board", id: "notices", source: "app/(app)/notices/page.tsx" },
  { path: "/messages", title: "Messages", id: "messages", source: "app/(app)/messages/page.tsx" },
  { path: "/settings", title: "Settings", id: "settings", source: "app/(app)/settings/page.tsx" },
];

export interface SchoolRouteMatch { route: SchoolRoute; params: Record<string, string>; query: URLSearchParams }

/** Resolves a module-internal path ("/quizzes/qz-4?role=student") to a page and its dynamic parameters.
    Static segments win over parameters, so /quizzes/new is the builder, not a quiz with id "new". */
export function matchSchoolRoute(path: string): SchoolRouteMatch | null {
  const [rawPath, search = ""] = path.split("?");
  const clean = `/${(rawPath ?? "").split("/").filter(Boolean).join("/")}`;
  const target = clean === "/" ? "/dashboard" : clean;
  const segments = target.split("/").filter(Boolean);
  let best: SchoolRouteMatch | null = null;
  for (const route of SCHOOL_ROUTES) {
    const parts = route.path.split("/").filter(Boolean);
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length && ok; i++) {
      if (parts[i]!.startsWith(":")) {
        try { params[parts[i]!.slice(1)] = decodeURIComponent(segments[i]!); } catch { ok = false; }
      } else ok = parts[i] === segments[i];
    }
    if (!ok) continue;
    const dynamic = Object.keys(params).length > 0;
    if (!best || (!dynamic && Object.keys(best.params).length > 0)) best = { route, params, query: new URLSearchParams(search) };
  }
  return best;
}

/** Source role navigation, for hosts that build the module sidebar. Hiding an entry is not authorization. */
export { ROLE_CONFIG as SCHOOL_ROLE_NAVIGATION, allowedPaths as schoolAllowedPaths } from "./lib/nav";
export type { Role as SchoolRole };
