import { render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { SourceDateField } from "./controls";
import { useTeleconsultFormat } from "./format";
import { makeHost } from "../test-utils";

const originalZone = process.env.TZ;
afterEach(() => { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; });

const wrapperFor = (preferences: Parameters<typeof makeHost>[1] extends infer O ? (O extends { preferences?: infer P } ? P : never) : never) => {
  const { host } = makeHost(() => undefined, { preferences });
  return ({ children }: { children: React.ReactNode }) => <ReferenceHostProvider host={host}>{children}</ReferenceHostProvider>;
};

describe("useTeleconsultFormat", () => {
  it.each(["America/Los_Angeles", "Asia/Dubai", "UTC"])("writes a bare calendar date (date of birth) as the same day in %s and in the preferred format", (zone) => {
    process.env.TZ = zone;
    const { result } = renderHook(() => useTeleconsultFormat(), { wrapper: wrapperFor({ dateFormat: "dmy" }) });
    expect(result.current.fmtDate("1990-04-02")).toBe("02/04/1990");
    expect(result.current.fmtDay("1990-04-02", "long")).toMatch(/^Monday, 02\/04\/1990$/);
    expect(result.current.fmtDate(new Date(1990, 3, 2))).toBe("02/04/1990");
  });

  it("follows every date format the host preference offers", () => {
    const formats = { iso: "2026-10-01", dmy: "01/10/2026", mdy: "10/01/2026", medium: "01 Oct 2026" } as const;
    for (const [dateFormat, expected] of Object.entries(formats)) {
      const { result } = renderHook(() => useTeleconsultFormat(), { wrapper: wrapperFor({ dateFormat: dateFormat as keyof typeof formats }) });
      expect(result.current.fmtDate("2026-10-01")).toBe(expected);
    }
  });
});

describe("SourceDateField", () => {
  const field = (value: string, preferences: Parameters<typeof wrapperFor>[0]) => {
    const Wrapper = wrapperFor(preferences);
    return render(<Wrapper><SourceDateField aria-label="Date" value={value} onChange={() => undefined} /></Wrapper>);
  };

  it("keeps the shared native date control with its ISO value and writes the date in the preferred format beneath it", () => {
    const view = field("2026-10-01", { dateFormat: "mdy" });
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-10-01");
    expect(view.container.querySelector("[data-date-preview]")?.textContent).toBe("10/01/2026");
  });

  it("shows no preview for an empty or incomplete value", () => {
    expect(field("", { dateFormat: "dmy" }).container.querySelector("[data-date-preview]")).toBeNull();
  });
});
