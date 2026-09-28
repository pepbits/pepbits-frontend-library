"use client";

import { AdminDashboard } from "../components/dashboards/admin";
import { AccountantDashboard, LibrarianDashboard } from "../components/dashboards/staff";
import { StudentDashboard } from "../components/dashboards/student";
import { TeacherDashboard } from "../components/dashboards/teacher";
import { useSession } from "../lib/session";

export function DashboardPage() {
  const { role } = useSession();
  switch (role) {
    case "admin": return <AdminDashboard />;
    case "teacher": return <TeacherDashboard />;
    case "student":
    case "parent": return <StudentDashboard />;
    case "librarian": return <LibrarianDashboard />;
    case "accountant": return <AccountantDashboard />;
  }
}
