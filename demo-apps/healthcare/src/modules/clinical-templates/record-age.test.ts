import { expect, test } from "vitest";
import { ageParts } from "./record-age";
test("age uses completed calendar months and handles short months without negative days", () => {
  expect(ageParts("2026-01-31", new Date("2026-03-01T12:00:00Z"))).toEqual({
    years: 0,
    months: 1,
    days: 1,
  });
  expect(ageParts("2000-06-15", new Date("2026-06-14T12:00:00Z"))).toEqual({
    years: 25,
    months: 11,
    days: 30,
  });
  expect(ageParts("2027-01-01", new Date("2026-01-01T12:00:00Z"))).toBeNull();
  expect(ageParts("2026-02-31")).toBeNull();
});
