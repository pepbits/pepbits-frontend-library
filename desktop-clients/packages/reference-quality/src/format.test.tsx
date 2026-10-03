import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { useQualityFormat } from "./lib/format";
import { makeHost } from "./test-utils";

const format = (preferences: Parameters<typeof makeHost>[1] extends infer O ? (O extends { preferences?: infer P } ? P : never) : never = {}) => {
  const { host } = makeHost(() => undefined, { preferences });
  return renderHook(() => useQualityFormat(), { wrapper: ({ children }: { children: React.ReactNode }) => <ReferenceHostProvider host={host}>{children}</ReferenceHostProvider> }).result.current;
};

describe("useQualityFormat follows the host preferences", () => {
  it("writes dates and times in the chosen date and time format; a bare day never shifts", () => {
    const f = format({ dateFormat: "dmy", timeFormat: "24h" });
    expect(f.fmtDate("2026-10-01")).toBe("01/10/2026");
    expect(f.fmtDateTime(new Date(2026, 9, 1, 14, 5).toISOString())).toBe("01/10/2026 14:05");
    expect(format({ dateFormat: "mdy" }).fmtDate("2026-10-01")).toBe("10/01/2026");
    expect(format({ dateFormat: "medium" }).fmtDate("2026-10-01")).toBe("01 Oct 2026");
    expect(f.fmtDate(null)).toBe("—");
  });

  it("formats numbers with the preferred locale and keeps the source's per-unit precision", () => {
    expect(format({ numberLocale: "de-DE" }).fmtNumber(1234.5, 1)).toBe("1.234,5");
    expect(format({ numberLocale: "en-US" }).fmtValue(97.456, "percent")).toBe("97.5%");
    expect(format().fmtValue(2.345, "per_1000")).toMatch(/^2[.,]35$/);
    expect(format().fmtValue(null, "percent")).toBe("—");
  });

  it("formats durations and periods", () => {
    const f = format({ language: "en" });
    expect(f.fmtMinutes(5)).toBe("5.0 min");
    expect(f.fmtMinutes(125)).toBe("2 h 05 m");
    expect(f.fmtMinutes(1500)).toBe("1 d 1 h");
    expect(f.fmtMinutes(-30)).toBe("−30 min");
    expect(f.fmtPeriod("2026-03")).toMatch(/Mar/);
    expect(f.fmtPeriodRange("2026-01", "2026-03")).toMatch(/Jan.*–.*Mar/);
    expect(f.fmtPeriodRange("2026-03", "2026-03")).toBe(f.fmtPeriod("2026-03"));
  });

  it("humanizes codes and passes unknown text through the translation boundary", () => {
    const f = format();
    expect(f.humanize("pending_approval")).toBe("Pending approval");
    expect(f.humanize(null)).toBe("—");
  });
});
