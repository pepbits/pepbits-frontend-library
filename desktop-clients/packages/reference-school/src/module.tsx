"use client";

import { AccessDenied, NotFoundState } from "@pepbits/ops-ui";
import { ReferenceHostProvider, referenceScopeKey, useReferenceHost, type ReferenceHost, type ReferenceModuleProps } from "@pepbits/reference-host";
import { Lock } from "lucide-react";
import { useMemo, type ComponentType, type CSSProperties } from "react";
import { LookupsProvider } from "./lib/lookups";
import { allowedPaths, ROLE_CONFIG } from "./lib/nav";
import { RouteParamsProvider, Link } from "./lib/router";
import { SessionProvider, useSession, useSessionState } from "./lib/session";
import { AdmissionsPage } from "./pages/admissions";
import { AssignmentsPage } from "./pages/assignments";
import { AttendancePage } from "./pages/attendance";
import { CalendarPage } from "./pages/calendar";
import { ClassesPage } from "./pages/classes";
import { DashboardPage } from "./pages/dashboard";
import { ExamsPage } from "./pages/exams";
import { FeesPage } from "./pages/fees";
import { LibraryPage } from "./pages/library";
import { LiveRoomPage } from "./pages/live-room";
import { LivePage } from "./pages/live";
import { MarksPage } from "./pages/marks";
import { MessagesPage } from "./pages/messages";
import { NoticesPage } from "./pages/notices";
import { QuizBuilderPage } from "./pages/quiz-builder";
import { QuizPlayerPage } from "./pages/quiz-player";
import { QuizzesPage } from "./pages/quizzes";
import { ReportsPage } from "./pages/reports";
import { SettingsPage } from "./pages/settings";
import { RegisterStudentPage } from "./pages/student-registration";
import { StudentsPage } from "./pages/students";
import { SubjectsPage } from "./pages/subjects";
import { RegisterTeacherPage } from "./pages/teacher-registration";
import { TeachersPage } from "./pages/teachers";
import { TimetablePage } from "./pages/timetable";
import { WhiteboardPage } from "./pages/whiteboard";
import { matchSchoolRoute, type SchoolPageId } from "./routes";
import styles from "./school.module.css";
import { Button, Empty, ErrorNote, Spinner, ToastProvider } from "./ui";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const PAGES: Record<SchoolPageId, ComponentType> = {
  dashboard: DashboardPage, reports: ReportsPage, students: StudentsPage, "student-registration": RegisterStudentPage,
  teachers: TeachersPage, "teacher-registration": RegisterTeacherPage, admissions: AdmissionsPage, classes: ClassesPage,
  subjects: SubjectsPage, timetable: TimetablePage, attendance: AttendancePage, assignments: AssignmentsPage, quizzes: QuizzesPage,
  "quiz-builder": QuizBuilderPage, "quiz-player": QuizPlayerPage, exams: ExamsPage, marks: MarksPage, live: LivePage,
  "live-room": LiveRoomPage, whiteboard: WhiteboardPage, library: LibraryPage, fees: FeesPage, calendar: CalendarPage,
  notices: NoticesPage, messages: MessagesPage, settings: SettingsPage,
};

/* Font stacks for the fontFamily preference, as the host shell applies them to <html>. Repeated on the module root so
   an embedding without that shell still honours the preference; inside the shell the value is identical. */
const FONT_STACK: Record<string, string> = {
  inter: "Inter, ui-sans-serif, system-ui, sans-serif",
  plex: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  "source-sans": "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
  nunito: "'Nunito Sans', ui-sans-serif, system-ui, sans-serif",
  manrope: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  "plex-mono": "'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
};

/** 13px is the reference size of the source design and of the host's type scales. */
const TYPE_REFERENCE_PX = 13;

/**
 * The Scholaris school module, rendered inside a host shell.
 *
 * `path` is the module-internal path ("/students", "/quizzes/qz-3", optionally "?role=teacher" to choose among the
 * portals the authenticated scope holds). The host supplies identity scope, effective preferences, requests and
 * navigation; the module renders no sidebar, header or sign-in of its own.
 */
export function ReferenceSchoolModule({ path, host }: ReferenceModuleProps) {
  const routed = useMemo<ReferenceHost>(() => ({ ...host, path }), [host, path]);
  return (
    <ReferenceHostProvider host={routed}>
      {/* Keyed by the authenticated scope: a tenant, application, branch, user or role change discards every page,
          session, lookup, draft and toast of the previous scope, even when the consumer does not key the module. */}
      <SchoolRoot key={referenceScopeKey(host.scope)} path={path} />
    </ReferenceHostProvider>
  );
}

function SchoolRoot({ path }: { path: string }) {
 const referenceT = useReferenceLocalization().t;

  const host = useReferenceHost();
  const match = matchSchoolRoute(path);
  const session = useSessionState(match?.query.get("role") ?? null);
  const p = host.preferences;
  const role = session.status === "ready" ? session.value.role : undefined;

  /* The host shell normally sets these on <html>; they are repeated on the module root so an embedding host that
     does not still gets the effective font scales and corner radius. --fs-scale is re-declared so it is computed
     here rather than inherited already resolved. */
  const style = {
    "--fs-shell": String(p.fontSizeBase / TYPE_REFERENCE_PX),
    "--fs-form": String(p.fontSizeForm / TYPE_REFERENCE_PX),
    "--fs-result": String(p.fontSizeResult / TYPE_REFERENCE_PX),
    "--fs-scale": "var(--fs-shell)",
    "--radius": `${p.cornerRadius}px`,
    ...(FONT_STACK[p.fontFamily] ? { "--font-ui": FONT_STACK[p.fontFamily] } : {}),
  } as CSSProperties;

  return (
    <div
      className={`${styles.root} reference-school-root print-full h-full min-h-0 overflow-auto p-2.5 sm:p-3`}
      data-role={role}
      data-reduced-motion={p.reducedMotion ? "true" : "false"}
      data-density={p.density}
      style={style}
    >
      {session.status === "loading" ? <Spinner label={referenceT("Opening your portal")} />
        : session.status === "denied" ? <AccessDenied description={referenceT("Your account has no school portal role in this workspace. Ask an administrator to grant one.")} />
        : session.status === "error" ? <ErrorNote message={session.message} onRetry={session.retry} />
        : (
          <SessionProvider value={session.value}>
            <LookupsProvider>
              <ToastProvider>
                <RoutedPage match={match} />
              </ToastProvider>
            </LookupsProvider>
          </SessionProvider>
        )}
    </div>
  );
}

/** Page for the matched route, after the source's portal check (a page outside the role's navigation shows the
    source's "not part of your portal" state). This is presentation only; the server authorizes every request. */
function RoutedPage({ match }: { match: ReturnType<typeof matchSchoolRoute> }) {
 const referenceT = useReferenceLocalization().t;

  const { role } = useSession();
  if (!match) return <NotFoundState title={referenceT("Page not found")} description={referenceT("This school page does not exist.")} action={<Link href="/dashboard"><Button variant="primary"><ReferenceText message="Go to dashboard" /></Button></Link>} />;
  const allowed = allowedPaths(role).some((p) => match.route.path === p || match.route.path.startsWith(p + "/"));
  if (!allowed) {
    return (
      <Empty icon={Lock} title={referenceT("This area isn't part of your portal")}
        text={referenceT("The {value0} portal doesn't include this page. Go back to your dashboard.", { value0: ROLE_CONFIG[role].label.toLowerCase() })}
        action={<Link href="/dashboard"><Button variant="primary"><ReferenceText message="Go to dashboard" /></Button></Link>} />
    );
  }
  const Page = PAGES[match.route.id];
  /* Keyed by page and parameters: /quizzes/a → /quizzes/b must not carry answers, timers, results or open camera
     streams from the previous record into the next. */
  return <RouteParamsProvider value={match.params}><Page key={`${match.route.id}:${JSON.stringify(match.params)}`} /></RouteParamsProvider>;
}
