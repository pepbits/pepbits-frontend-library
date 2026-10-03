import { cleanup, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { Button, DateInput, Field, Input, Modal, PageHeader, Panel, Select, Tabs, TimeInput } from "./components/ui";
import { ReferenceQualityModule } from "./module";
import { chain, json, makeHost, recordingLocalization, sessionHandler } from "./test-utils";

afterEach(cleanup);

const inHost = (node: React.ReactNode, preferences = {}, table: Record<string, string> = {}) => {
  const { host } = makeHost(() => undefined, { preferences });
  const l = recordingLocalization(table);
  return { ...render(<l.Wrapper><ReferenceHostProvider host={host}>{node}</ReferenceHostProvider></l.Wrapper>), seen: l.seen };
};

describe("source controls on the shared primitives", () => {
  it("translates copy, labels, placeholders and aria names through the host localization", () => {
    inHost(
      <>
        <PageHeader title="Audit trail" description="Every change." />
        <Panel title="Filters"><Field label="User" hint="Who did it"><Input placeholder="Search summaries" /></Field></Panel>
        <Tabs value="a" onChange={() => undefined} items={[{ id: "a", label: "Open" }]} />
        <Button>Save</Button>
        <Select aria-label="Period"><option>x</option></Select>
      </>,
      {},
      { "Audit trail": "سجل التدقيق", Filters: "عوامل التصفية", User: "المستخدم", "Search summaries": "ابحث", Open: "مفتوح", Save: "حفظ", Period: "الفترة" },
    );
    expect(screen.getByRole("heading", { name: "سجل التدقيق" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "عوامل التصفية" })).toBeTruthy();
    expect(screen.getByPlaceholderText("ابحث")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "مفتوح" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "حفظ" })).toBeTruthy();
    expect(screen.getByLabelText("الفترة")).toBeTruthy();
  });

  it("uses native machine-value date/time fields (ISO) rather than text inputs", () => {
    const { container } = inHost(<><DateInput aria-label="From" value="2026-10-01" onChange={() => undefined} /><TimeInput aria-label="At" value="08:30" onChange={() => undefined} /></>);
    expect((container.querySelector('input[aria-label="From"]') as HTMLInputElement).type).toBe("date");
    expect((container.querySelector('input[aria-label="From"]') as HTMLInputElement).value).toBe("2026-10-01");
    expect((container.querySelector('input[aria-label="At"]') as HTMLInputElement).type).toBe("time");
  });

  it("renders panels on the shared Card and buttons as typed native buttons", () => {
    const { container } = inHost(<><Panel title="P">body</Panel><Button>Go</Button></>);
    const panel = container.querySelector("section");
    expect(panel?.className).toContain("border-line");
    expect(panel?.className).toContain("border-[var(--border)]"); // the shared Card contributes its theme border token
    expect((screen.getByRole("button", { name: "Go" }) as HTMLButtonElement).type).toBe("button");
  });

  it("wraps the dialog body in the module scope so scoped utilities reach shared overlay content, keeping the dialog semantics", () => {
    const { host } = makeHost(() => undefined, { preferences: { theme: "midnight" } });
    render(<ReferenceHostProvider host={host}><Modal open onClose={() => undefined} title="Edit thing" footer={<Button>Apply</Button>}><p>content</p></Modal></ReferenceHostProvider>);
    const dialog = screen.getByRole("dialog", { name: "Edit thing" });
    const scoped = [...dialog.querySelectorAll(".reference-quality")];
    expect(scoped.length).toBe(2);
    expect(scoped.every((s) => s.getAttribute("data-theme") === "midnight" && s.hasAttribute("data-overlay"))).toBe(true);
    expect(within(scoped[0] as HTMLElement).getByText("content")).toBeTruthy();
    expect(within(scoped[1] as HTMLElement).getByRole("button", { name: "Apply" })).toBeTruthy();
  });
});

describe("tables use the shared Table with the source look", () => {
  it("renders a data-table through Table (managed presentation attributes) inside TableContainer", async () => {
    const h = makeHost(chain((r) => { if (r.url.pathname === "/users") return json({ rows: [{ id: 1, name: "Local Admin", email: "admin@example.test", role: "admin", title: null, facility_id: null, facility_name: null, last_login_at: null, actions_30d: 2, status: "active" }], roles: [] }); }, sessionHandler()), { path: "/users", preferences: { density: "compact", zebraStripes: true } });
    const { container } = render(<ReferenceQualityModule path="/users" host={h.host} />);
    await screen.findByText("Local Admin");
    const table = container.querySelector("table.data-table") as HTMLTableElement;
    expect(table).toBeTruthy();
    expect(table.getAttribute("data-density")).toBe("compact");
    expect(table.getAttribute("data-striped")).toBe("true");
    expect(table.style.getPropertyValue("--fs-scale")).toBe("var(--fs-result)");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
  });

  it("makes host-managed directory rows read-only and explains that the directory grants nothing", async () => {
    const row = (id: number, email: string, name: string) => ({ id, name, email, role: "viewer", title: null, facility_id: null, facility_name: null, last_login_at: null, actions_30d: 0, status: "active" });
    const h = makeHost(chain((r) => { if (r.url.pathname === "/users") return json({ rows: [row(1, "admin@example.test", "Local Admin"), row(2, "host-user-9@quality.invalid", "Host Person")], roles: [] }); }, sessionHandler()), { path: "/users" });
    const { container } = render(<ReferenceQualityModule path="/users" host={h.host} />);
    await screen.findByText("Host Person");
    const hostRow = screen.getByText("Host Person").closest("tr") as HTMLElement;
    expect(within(hostRow).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(hostRow).getByText("Managed by the host sign-in")).toBeTruthy();
    const localRow = screen.getByText("Local Admin").closest("tr") as HTMLElement;
    expect(within(localRow).getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(container.querySelector("[data-directory-note]")?.textContent).toContain("does not grant access to the shared platform");
  });
});
