import type {PatientCareRow} from '../../domain/clinical-templates';

/** Demo care dates use UTC, including the definition of "today". */
export function selectOverviewRows(
  rows: PatientCareRow[],
  section: string,
  kind: string,
  loadedAt: string,
): PatientCareRow[] {
  const now = Date.parse(loadedAt);
  const today = loadedAt.slice(0, 10);
  const active = (r: PatientCareRow) =>
    ["scheduled", "pending", "active", "inProgress"].includes(r.status);
  if (section === "actionable")
    return rows.filter(
      (r) =>
        ["appointment", "encounter", "order"].includes(r.kind) &&
        r.date.slice(0, 10) === today &&
        active(r),
    );
  let selected = rows.filter((r) => r.kind === kind);
  if (section === "appointments")
    selected = selected.filter((r) => Date.parse(r.date) >= now && active(r));
  if (
    section === "encounters" ||
    section === "episodes" ||
    section === "orders"
  )
    selected = selected.filter(active);
  return selected.sort((a, b) =>
    section === "recent"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date),
  );
}
