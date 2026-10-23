import { expect, test } from "vitest";
import type {PatientCareRow} from '../../domain/clinical-templates';
import { selectOverviewRows } from "./overview-data";

test("care panels separate today, upcoming care and closed history", () => {
  const row = (
    id: string,
    kind: PatientCareRow["kind"],
    date: string,
    status: string,
  ): PatientCareRow => ({ id, kind, date, status, title: id, detail: "" });
  const rows = [
    row("tomorrow", "appointment", "2026-09-10T09:00:00Z", "scheduled"),
    row("cancelled", "appointment", "2026-09-10T10:00:00Z", "cancelled"),
    row("today", "encounter", "2026-09-09T08:00:00Z", "inProgress"),
    row("closed", "encounter", "2026-09-08T08:00:00Z", "completed"),
    row("lab", "order", "2026-09-09T07:00:00Z", "pending"),
  ];
  const ids = (section: string, kind: string) =>
    selectOverviewRows(rows, section, kind, "2026-09-09T12:00:00Z").map(
      (r) => r.id,
    );
  expect(ids("actionable", "appointment")).toEqual(["today", "lab"]);
  expect(ids("appointments", "appointment")).toEqual(["tomorrow"]);
  expect(ids("encounters", "encounter")).toEqual(["today"]);
  expect(ids("recent", "encounter")).toEqual(["today", "closed"]);
});
