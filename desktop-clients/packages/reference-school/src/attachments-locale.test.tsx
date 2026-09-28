import { LocalizationProvider, type Localization } from "@pepbits/ops-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { ReferenceSchoolModule } from "./index";
import type { AttachmentUpload, SchoolAttachment } from "./lib/contract";
import { createFakeBackend, fakeHost, FakeHttpError, type FakeBackend, type FakeBackendOptions, type HostOptions } from "./test-support/fake-host.test-support";

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
  const view = render(<>{wrap(<ReferenceSchoolModule path={path} host={fakeHost(backend, options)} />)}</>);
  return { backend, rerender: (o: HostOptions) => view.rerender(<>{wrap(<ReferenceSchoolModule path={path} host={fakeHost(backend, o)} />)}</>) };
}

const bytes = (n: number, seed = 7) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 256);
const pick = (container: HTMLElement, file: File) => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [file] } });
};
const uploads = (b: FakeBackend) => b.requests.filter((r) => r.method === "POST" && r.path === "/api/attachments");

describe("attachments", () => {
  test("a failed upload keeps the file and the draft, Retry sends the same bytes once, and the assignment saves the returned metadata", async () => {
    let fail = true;
    const { backend } = mount("/assignments", { roles: ["teacher"] }, { intercept: (r) => (r.method === "POST" && r.path === "/attachments" && fail ? new FakeHttpError(503, "Storage unavailable") : undefined) });
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "New assignment" }));
    const dialog = await screen.findByRole("dialog", { name: "New assignment" });
    const d = within(dialog);
    fireEvent.change(d.getByLabelText(/^Title/), { target: { value: "Probability worksheet" } });
    fireEvent.change(d.getByRole("combobox", { name: /Class/ }), { target: { value: backend.db.classes.find((c) => c.classTeacherId === "t-001")!.id } });
    const original = bytes(2048);
    pick(dialog, new File([original], "rubric.pdf", { type: "application/pdf" }));

    expect(await d.findByText("Storage unavailable")).toBeInTheDocument();
    expect(d.getByText("rubric.pdf", { exact: false })).toBeInTheDocument();
    expect(d.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(d.getByLabelText(/^Title/)).toHaveValue("Probability worksheet");
    const first = uploads(backend)[0]!.body as AttachmentUpload;
    expect(first).toMatchObject({ name: "rubric.pdf", type: "application/pdf", purpose: "assignment" });
    expect(Uint8Array.from(Buffer.from(first.content, "base64"))).toEqual(original);

    fail = false;
    fireEvent.click(d.getByRole("button", { name: "Retry upload" }));
    await waitFor(() => expect(d.getByText("Uploaded")).toBeInTheDocument());
    expect(uploads(backend)).toHaveLength(2);
    expect(uploads(backend)[1]!.body).toEqual(first);

    fireEvent.click(d.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New assignment" })).toBeNull());
    const saved = backend.requests.find((r) => r.method === "POST" && r.path === "/api/assignments")!.body as { attachments: SchoolAttachment[] };
    expect(saved.attachments).toEqual([{ id: "att-1", name: "rubric.pdf", type: "application/pdf", size: 2048, downloadPath: "/api/attachments/att-1" }]);
  });

  test("a file over 1 MB is refused before any request and blocks saving until removed", async () => {
    const { backend } = mount("/assignments", { roles: ["teacher"] });
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "New assignment" }));
    const dialog = await screen.findByRole("dialog", { name: "New assignment" });
    pick(dialog, new File([bytes(1024 * 1024 + 1)], "scan.png", { type: "image/png" }));
    expect(await within(dialog).findByText("Files larger than 1 MB cannot be attached.")).toBeInTheDocument();
    expect(uploads(backend)).toHaveLength(0);
    expect(within(dialog).getByRole("button", { name: "Publish" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove scan.png" }));
    expect(within(dialog).getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  test("a message keeps its text and file when sending fails, then sends the attachment and downloads the exact bytes", async () => {
    let fail = true;
    const { backend } = mount("/messages", { roles: ["teacher"] }, { intercept: (r) => (r.method === "PATCH" && r.path.startsWith("/threads/") && fail ? new FakeHttpError(503, "offline") : undefined) });
    await settle(backend);
    const original = bytes(300, 11);
    pick(document.body, new File([original], "notes.txt", { type: "text/plain" }));
    await screen.findByText("Uploaded");
    const box = screen.getByPlaceholderText(/Write a message/);
    fireEvent.change(box, { target: { value: "Here are the notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/Message not sent — offline/)).toBeInTheDocument();
    expect(box).toHaveValue("Here are the notes");
    expect(screen.getByText("notes.txt", { exact: false })).toBeInTheDocument();

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(box).toHaveValue(""));
    expect(screen.queryByText("Uploaded")).toBeNull();
    const patch = backend.requests.filter((r) => r.method === "PATCH" && r.path.startsWith("/api/threads/")).at(-1)!.body as { messages: { attachments?: SchoolAttachment[] }[] };
    expect(patch.messages.at(-1)!.attachments).toEqual([expect.objectContaining({ id: "att-1", name: "notes.txt", size: 300 })]);

    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return "blob:school"; }) as never;
    URL.revokeObjectURL = vi.fn() as never;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(await screen.findByRole("button", { name: "Download notes.txt" }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(backend.requests.some((r) => r.method === "GET" && r.path === "/api/attachments/att-1")).toBe(true);
    const read = await new Promise<ArrayBuffer>((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result as ArrayBuffer); r.readAsArrayBuffer(created[0]!); });
    expect(new Uint8Array(read)).toEqual(original);
    expect(created[0]!.type).toBe("text/plain");
  });

  test("a student submission sends its uploaded attachment with the answer", async () => {
    const { backend } = mount("/assignments", { roles: ["student"] });
    await settle(backend);
    fireEvent.click((await screen.findAllByRole("button", { name: "Submit" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Your answer/), { target: { value: "Answers in the attached file" } });
    pick(dialog, new File([bytes(64)], "answers.pdf", { type: "application/pdf" }));
    await within(dialog).findByText("Uploaded");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn in" }));
    await waitFor(() => expect(backend.requests.some((r) => r.method === "PATCH" && r.path === "/api/submissions")).toBe(true));
    const body = backend.requests.find((r) => r.method === "PATCH" && r.path === "/api/submissions")!.body as { text: string; attachments: SchoolAttachment[] };
    expect(body.text).toBe("Answers in the attached file");
    expect(body.attachments).toEqual([expect.objectContaining({ name: "answers.pdf", size: 64 })]);
    expect(backend.attachmentStore.get(body.attachments[0]!.id)!.purpose).toBe("submission");
  });
});

describe("localization and number format", () => {
  const german: Record<string, string> = { "Any status": "Beliebiger Status", Present: "Anwesend", Female: "Weiblich" };
  const loc: Localization = {
    language: "de", direction: "ltr", dateTime: (v) => String(v),
    t: (m, values) => (german[m] ?? m).replace(/\{(\w+)\}/g, (x, k) => (values?.[k] === undefined ? x : String(values[k]))),
  };
  const wrap = (n: ReactNode) => <LocalizationProvider value={loc}>{n}</LocalizationProvider>;

  test("option labels are the source English, translated once, with values unchanged", async () => {
    const { backend } = mount("/students", { roles: ["admin"] }, {}, wrap);
    await settle(backend);
    const status = screen.getByRole("combobox", { name: "Status" }) as HTMLSelectElement;
    const options = [...status.options].map((o) => [o.value, o.textContent]);
    expect(options[0]).toEqual(["", "Beliebiger Status"]);
    expect(options.map((o) => o[0])).toEqual(["", "Active", "Inactive", "Alumni"]);
    expect(status.value).toBe("Active");
  });

  test("chart values use the host number locale and chart labels are localized", async () => {
    const { backend } = mount("/dashboard", { roles: ["admin"], preferences: { numberLocale: "de-DE" } }, {}, wrap);
    await settle(backend);
    expect(screen.getByText("Weiblich")).toBeInTheDocument();
    // The attendance line chart's hover columns (one per school day).
    const hover = document.querySelectorAll<HTMLElement>("div.absolute.inset-0.flex > div.h-full.flex-1");
    expect(hover.length).toBeGreaterThan(0);
    fireEvent.mouseEnter(hover[hover.length - 1]!);
    const tip = await screen.findByText(/^Anwesend: /);
    expect(tip.textContent).toMatch(/^Anwesend: \d+(,\d)?%$/);
    expect(tip.textContent).not.toMatch(/\d\.\d/);
  });

  test("changing the locale does not clear an open draft", async () => {
    const env = mount("/admissions", { roles: ["admin"], preferences: { numberLocale: "en-US" } });
    await settle(env.backend);
    fireEvent.click(screen.getByRole("button", { name: "New application" }));
    const dialog = await screen.findByRole("dialog", { name: "New admission application" });
    fireEvent.change(within(dialog).getByLabelText(/Applicant name/), { target: { value: "Ada Fictional" } });
    env.rerender({ roles: ["admin"], preferences: { numberLocale: "de-DE", language: "ar" } });
    expect(within(screen.getByRole("dialog", { name: "New admission application" })).getByLabelText(/Applicant name/)).toHaveValue("Ada Fictional");
  });
});
