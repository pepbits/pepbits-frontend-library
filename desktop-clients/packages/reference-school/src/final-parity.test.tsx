import { LocalizationProvider, type Localization } from "@pepbits/ops-ui";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { ReferenceSchoolModule } from "./index";
import { AttachmentList } from "./lib/attachments";
import { createFakeBackend, fakeHost, FakeHttpError, type FakeBackend, type FakeBackendOptions, type HostOptions } from "./test-support/fake-host.test-support";
import { DataTable } from "./ui/data-table";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(() => vi.restoreAllMocks());

async function settle(backend: FakeBackend) {
  await waitFor(() => expect(screen.queryByText("Opening your portal")).toBeNull());
  for (let i = 0; i < 8; i++) { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); if (backend.pending === 0) break; }
}
function mount(path: string, options: HostOptions, backendOptions: FakeBackendOptions = {}, wrap: (n: ReactNode) => ReactNode = (n) => n) {
  const backend = createFakeBackend(backendOptions);
  render(<>{wrap(<ReferenceSchoolModule path={path} host={fakeHost(backend, options)} />)}</>);
  return backend;
}
const created = (b: FakeBackend, resource: string) => b.creates.filter((c) => c.resource === resource).map((c) => c.body);

describe("source option labels", () => {
  test("the Select shows the source English labels (static and enum) with unchanged values", async () => {
    const backend = mount("/students", { roles: ["admin"] });
    await settle(backend);
    const status = screen.getByRole("combobox", { name: "Status" }) as HTMLSelectElement;
    expect([...status.options].map((o) => [o.value, o.textContent])).toEqual([["", "Any status"], ["Active", "Active"], ["Inactive", "Inactive"], ["Alumni", "Alumni"]]);
    const gender = screen.getByRole("combobox", { name: "Gender" }) as HTMLSelectElement;
    expect([...gender.options].map((o) => [o.value, o.textContent])).toEqual([["", "Any gender"], ["Female", "Female"], ["Male", "Male"]]);
  });

  test("translation applies once to the English message and never to the value", async () => {
    const loc: Localization = { language: "de", direction: "ltr", dateTime: String, t: (m) => ({ "Any status": "Beliebiger Status", Active: "Aktiv" } as Record<string, string>)[m] ?? m };
    const backend = mount("/students", { roles: ["admin"] }, {}, (n) => <LocalizationProvider value={loc}>{n}</LocalizationProvider>);
    await settle(backend);
    const status = screen.getByRole("combobox", { name: "Status" }) as HTMLSelectElement;
    expect([...status.options].slice(0, 2).map((o) => [o.value, o.textContent])).toEqual([["", "Beliebiger Status"], ["Active", "Aktiv"]]);
    expect(status.value).toBe("Active");
  });
});

describe("server-initialized creation fields", () => {
  test("a new book sends only authored fields; the card shows the server's record", async () => {
    const backend = mount("/library", { roles: ["librarian"] });
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "Add book" }));
    const d = within(await screen.findByRole("dialog", { name: "Add book to catalogue" }));
    fireEvent.change(d.getByLabelText(/^Title/), { target: { value: "Fictional Field Guide" } });
    fireEvent.change(d.getByLabelText(/^Author/), { target: { value: "A. Author" } });
    fireEvent.change(d.getByLabelText(/^ISBN/), { target: { value: "978-0-00-000000-1" } });
    fireEvent.click(d.getByRole("button", { name: "Add book" }));
    await waitFor(() => expect(created(backend, "books")).toHaveLength(1));
    const body = created(backend, "books")[0]!;
    expect(body).toMatchObject({ title: "Fictional Field Guide", copies: 3, year: new Date().getFullYear() });
    for (const k of ["available", "rating", "cover"]) expect(body).not.toHaveProperty(k);
    const title = await screen.findByText("Fictional Field Guide", { selector: "p" });
    const card = title.parentElement!.parentElement!;
    expect(within(card).getByText("3 of 3 available")).toBeInTheDocument();
  });

  test("a rejected book keeps the dialog and the typed values", async () => {
    const backend = mount("/library", { roles: ["librarian"] }, { intercept: (r) => (r.method === "POST" && r.path === "/books" ? new FakeHttpError(409, "Duplicate ISBN") : undefined) });
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "Add book" }));
    const dialog = await screen.findByRole("dialog", { name: "Add book to catalogue" });
    const d = within(dialog);
    fireEvent.change(d.getByLabelText(/^Title/), { target: { value: "Fictional Field Guide" } });
    fireEvent.change(d.getByLabelText(/^Author/), { target: { value: "A. Author" } });
    fireEvent.change(d.getByLabelText(/^ISBN/), { target: { value: "978-0-00-000000-1" } });
    fireEvent.click(d.getByRole("button", { name: "Add book" }));
    expect(await screen.findByText("Duplicate ISBN")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: "Add book to catalogue" })).getByLabelText(/^Title/)).toHaveValue("Fictional Field Guide");
  });

  test("a new class and a new assignment send no counters, and numeric fields stay numbers under ar-EG", async () => {
    const backend = mount("/classes", { roles: ["admin"], preferences: { numberLocale: "ar-EG" as never } });
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "Add class" }));
    const d = within(await screen.findByRole("dialog", { name: "Add class section" }));
    fireEvent.change(d.getByLabelText(/^Grade/), { target: { value: "8" } });
    fireEvent.change(d.getByLabelText(/^Section/), { target: { value: "c" } });
    fireEvent.change(d.getByLabelText(/^Room/), { target: { value: "A-803" } });
    fireEvent.change(d.getByLabelText(/^Class teacher/), { target: { value: backend.db.teachers[1]!.id } });
    fireEvent.click(d.getByRole("button", { name: "Create class" }));
    await waitFor(() => expect(created(backend, "classes")).toHaveLength(1));
    const body = created(backend, "classes")[0]!;
    expect(body).toMatchObject({ grade: 8, section: "C", name: "Grade 8-C", capacity: 30 });
    expect(body).not.toHaveProperty("strength");
    expect(body).not.toHaveProperty("avgScore");
  });

  test("a new quiz sends its questions and options but no attempts or average", async () => {
    const backend = mount("/quizzes/new", { roles: ["teacher"] });
    await settle(backend);
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Fractions check" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Class/ }), { target: { value: backend.db.classes.find((c) => c.classTeacherId === "t-001")!.id } });
    fireEvent.change(screen.getByPlaceholderText("Type the question…"), { target: { value: "What is 1/2 + 1/4?" } });
    fireEvent.change(screen.getByPlaceholderText("Option A"), { target: { value: "3/4" } });
    fireEvent.change(screen.getByPlaceholderText("Option B"), { target: { value: "2/6" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark option A correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(created(backend, "quizzes")).toHaveLength(1));
    const body = created(backend, "quizzes")[0]!;
    expect(body).toMatchObject({ title: "Fractions check", status: "Published", durationMin: 15 });
    expect((body.questions as { options: string[]; answer: number }[])[0]).toMatchObject({ options: ["3/4", "2/6"], answer: 0 });
    expect(body).not.toHaveProperty("attempts");
    expect(body).not.toHaveProperty("avgScore");
  });
});

describe("numeric presentation", () => {
  test("KPI percentages and counts use the host number locale", async () => {
    const backend = mount("/dashboard", { roles: ["admin"], preferences: { numberLocale: "ar-EG" as never } });
    await settle(backend);
    const tile = screen.getByText("Attendance today").closest(".school-kpi") as HTMLElement;
    expect(tile.textContent).toMatch(/[٠-٩]+.*%/);
    expect(tile.textContent).not.toMatch(/[0-9]/);
    const students = screen.getByText("Active students").closest(".school-kpi") as HTMLElement;
    expect(students.textContent).toMatch(/[٠-٩]/);
  });

  test("host density wins over the source dense flag", () => {
    const backend = createFakeBackend();
    render(
      <ReferenceHostProvider host={fakeHost(backend, { roles: ["admin"], preferences: { density: "spacious" } })}>
        <DataTable dense rows={[{ id: "1", n: 12 }]} columns={[{ key: "n", header: "Number" }]} />
      </ReferenceHostProvider>,
    );
    expect(document.querySelector("table")).toHaveAttribute("data-density", "spacious");
  });

  test("an authored filename is shown exactly, even when it matches a UI message", () => {
    const backend = createFakeBackend();
    const loc: Localization = { language: "de", direction: "ltr", dateTime: String, t: (m, v) => (m === "Save" ? "Speichern" : m.replace(/\{(\w+)\}/g, (x, k) => String(v?.[k] ?? x))) };
    render(
      <LocalizationProvider value={loc}>
        <ReferenceHostProvider host={fakeHost(backend, { roles: ["admin"] })}>
          <AttachmentList attachments={[{ id: "a1", name: "Save", type: "text/plain", size: 4, downloadPath: "/api/attachments/a1" }]} />
        </ReferenceHostProvider>
      </LocalizationProvider>,
    );
    expect(screen.getByRole("button", { name: "Download Save" })).toHaveTextContent(/^Save$/);
  });
});
