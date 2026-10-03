import { describe, expect, it } from "vitest";
import { ageParts, coverageActive, cx, normalize, toDateInput, toDateTimeInput } from "./lib/utils";
import { mergeChanges, mergeList, pickCounter } from "./lib/store";

describe("cx", () => {
  it("lets a later utility override an earlier conflicting one, like the source's tailwind-merge", () => {
    expect(cx("h-10 px-4", "h-8")).toBe("px-4 h-8");
    expect(cx("text-sm text-ink", "text-[13px]", false, null, "text-white")).toBe("text-[13px] text-white");
    expect(cx("bg-paper", "hover:bg-canvas", "bg-scrub-700")).toBe("hover:bg-canvas bg-scrub-700");
    expect(cx("rounded-lg", "rounded-l-[var(--radius-band)]")).toBe("rounded-lg rounded-l-[var(--radius-band)]");
    expect(cx("flex", "hidden")).toBe("hidden");
  });
});

describe("pure helpers", () => {
  it("keeps native input machine values", () => {
    const d = new Date(2026, 8, 5, 7, 3);
    expect(toDateInput(d)).toBe("2026-09-05");
    expect(toDateTimeInput(d)).toBe("2026-09-05T07:03");
  });
  it("computes age parts as years, or months under two years", () => {
    expect(ageParts("1990-05-04", new Date(2026, 4, 3))).toEqual({ unit: "y", value: 35 });
    expect(ageParts("2025-01-10", new Date(2026, 0, 9))).toEqual({ unit: "m", value: 11 });
    expect(ageParts("", new Date())).toBeNull();
  });
  it("normalizes search text and checks coverage windows", () => {
    expect(normalize("(050) 123-4567")).toBe("0501234567");
    expect(coverageActive({ validFrom: "2026-01-01", validTo: "2026-12-31" } as never, new Date(2026, 5, 1))).toBe(true);
    expect(coverageActive({ validFrom: "2026-01-01", validTo: "2026-02-01" } as never, new Date(2026, 5, 1))).toBe(false);
  });
});

describe("store merge and counter choice", () => {
  it("merges returned records by id, newest first, without losing the rest", () => {
    expect(mergeList([{ id: "a", v: 1 }, { id: "b", v: 1 }], [{ id: "b", v: 2 }, { id: "c", v: 1 }])).toEqual([{ id: "c", v: 1 }, { id: "a", v: 1 }, { id: "b", v: 2 }]);
    const state = { patients: [], episodes: [{ id: "e1" }], cases: [], encounters: [], admissionRequests: [] } as never;
    expect(mergeChanges(state, { episodes: [{ id: "e2" }] as never }).episodes).toEqual([{ id: "e2" }, { id: "e1" }]);
  });
  it("uses the saved counter only if the backend still lists it; otherwise the first backend counter, never an invented one", () => {
    const counters = [{ id: "x1" }, { id: "x2" }] as never;
    expect(pickCounter(counters, "x2")).toBe("x2");
    expect(pickCounter(counters, "gone")).toBe("x1");
    expect(pickCounter(counters, null)).toBe("x1");
    expect(pickCounter([] as never, "x1")).toBe("");
  });
});
