import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { ReferenceSchoolModule, SCHOOL_ROUTES } from "./index";
import { createFakeBackend, fakeHost, FakeHttpError, type FakeBackend, type HostOptions } from "./test-support/fake-host.test-support";

/* jsdom has no canvas, layout observer or media devices; the whiteboard and live room need the first two. */
beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => {} });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(() => vi.restoreAllMocks());

async function settle(backend: FakeBackend) {
  await waitFor(() => expect(screen.queryByText("Opening your portal")).toBeNull());
  // Drain chained requests (session → lookups → page data → dependent data).
  for (let i = 0; i < 6; i++) { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); if (backend.pending === 0) break; }
}

function mount(path: string, options: HostOptions, backend = createFakeBackend()) {
  const navigate = vi.fn();
  const host = fakeHost(backend, options, navigate);
  const view = render(<ReferenceSchoolModule path={path} host={host} />);
  return { backend, host, navigate, view, rerender: (p: string, o: HostOptions = options) => view.rerender(<ReferenceSchoolModule path={p} host={fakeHost(backend, o, navigate)} />) };
}

/* A label from each source page, so a route that renders only an empty root or a skeleton fails. */
const PAGE_MARKER: Record<string, string> = {
  dashboard: "Active students", reports: "Standard reports", students: "Enrolled students", "student-registration": "Registration summary",
  teachers: "Teaching staff", "teacher-registration": "Staff record preview", admissions: "New application", classes: "Add class",
  subjects: "Subjects offered", timetable: "Weekly load", attendance: "Absence policy", assignments: "Waiting to be graded",
  quizzes: "Build quiz", "quiz-builder": "Quiz settings", "quiz-player": "Start preview", exams: "Papers this term", marks: "Save marks",
  live: "Start instant class", "live-room": "Back to live classes", whiteboard: "Use in a live class", library: "Add book",
  fees: "Billed this year", calendar: "Coming up", notices: "Post", messages: "New message", settings: "Profile",
};
const visible = (label: string) => screen.queryAllByText(label).length + screen.queryAllByLabelText(label).length > 0;

describe("ReferenceSchoolModule", () => {
  test.each(SCHOOL_ROUTES.map((r) => [r.path, r.path.replace(":id", r.id === "quiz-player" ? "qz-1" : "lv-1"), r.id]))(
    "renders %s for an administrator through host.request only", async (_route, path, id) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const storage = vi.spyOn(Storage.prototype, "setItem");
      const { backend } = mount(path, { roles: ["school:admin"] });
      await settle(backend);
      expect(screen.queryByText(/isn't part of your portal/)).toBeNull();
      expect(screen.queryByText("Page not found")).toBeNull();
      expect(screen.queryByText("Something went wrong")).toBeNull();
      expect(document.querySelector(".reference-school-root")).not.toBeNull();
      await waitFor(() => expect(visible(PAGE_MARKER[id]!)).toBe(true));
      expect(backend.requests.length).toBeGreaterThan(0);
      expect(backend.requests.every((r) => r.path.startsWith("/api/"))).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(storage).not.toHaveBeenCalled();
    });

  test("a scope without a school role is denied without asking the server for a session", async () => {
    const { backend } = mount("/dashboard", { roles: ["viewer", "superuser"] });
    expect(await screen.findByText("Access not permitted")).toBeInTheDocument();
    expect(backend.requests.some((r) => r.path.startsWith("/api/session"))).toBe(false);
  });

  test("a session answering with a role the scope does not hold is rejected", async () => {
    const backend = createFakeBackend({ intercept: (r) => (r.path.startsWith("/session") ? { data: { role: "admin", user: { id: "u", name: "X", title: "", email: "" }, children: [] } } : undefined) });
    mount("/dashboard", { roles: ["student"] }, backend);
    expect(await screen.findByText(/did not match the signed-in role/)).toBeInTheDocument();
  });

  test("a page outside the portal shows the source's portal notice", async () => {
    const { backend } = mount("/admissions", { roles: ["student"] });
    await settle(backend);
    expect(screen.getByText("This area isn't part of your portal")).toBeInTheDocument();
    expect(backend.requests.some((r) => r.path.startsWith("/api/admissions"))).toBe(false);
  });

  test("the host ?role= hint only selects portals the scope grants", async () => {
    const { backend } = mount("/dashboard?role=admin", { roles: ["student", "school:teacher"] });
    await settle(backend);
    const session = backend.requests.find((r) => r.path.startsWith("/api/session"))!;
    expect(session.path).toBe("/api/session?role=teacher");
  });

  test("switching scope discards the previous scope's session and data", async () => {
    const a = createFakeBackend({ userName: "Tenant A Teacher" });
    const view = mount("/settings", { roles: ["teacher"], tenantId: "tenant-a" }, a);
    await settle(a);
    expect(screen.getAllByText("Tenant A Teacher").length).toBeGreaterThan(0);
    const b = createFakeBackend({ userName: "Tenant B Teacher" });
    view.view.rerender(<ReferenceSchoolModule path="/settings" host={fakeHost(b, { roles: ["teacher"], tenantId: "tenant-b" })} />);
    await settle(b);
    expect(screen.queryByText("Tenant A Teacher")).toBeNull();
    expect(screen.getAllByText("Tenant B Teacher").length).toBeGreaterThan(0);
    expect(b.requests.some((r) => r.path.startsWith("/api/session"))).toBe(true);
    expect(b.requests.some((r) => r.path === "/api/classes")).toBe(true);
  });

  test("changing the quiz id remounts the player instead of carrying state across quizzes", async () => {
    const { backend, rerender } = mount("/quizzes/qz-1", { roles: ["admin"] });
    await settle(backend);
    const first = backend.db.quizzes.find((q) => q.id === "qz-1")!;
    const second = backend.db.quizzes.find((q) => q.id === "qz-2")!;
    fireEvent.click(await screen.findByRole("button", { name: "Start preview" }));
    expect(await screen.findByText(first.questions![0]!.text)).toBeInTheDocument();
    rerender("/quizzes/qz-2");
    await settle(backend);
    expect(await screen.findByRole("heading", { name: second.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start preview" })).toBeInTheDocument();
  });
});

describe("failure handling", () => {
  test("a rejected create keeps the dialog and the entered values and shows the server message", async () => {
    const backend = createFakeBackend({ intercept: (r) => (r.method === "POST" && r.path === "/admissions" ? new FakeHttpError(409, "Duplicate application for this family") : undefined) });
    mount("/admissions", { roles: ["admin"] }, backend);
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "New application" }));
    const dialog = await screen.findByRole("dialog", { name: "New admission application" });
    const d = within(dialog);
    fireEvent.change(d.getByLabelText(/Applicant name/), { target: { value: "Ada Fictional" } });
    fireEvent.change(d.getByLabelText(/Applying for/), { target: { value: "7" } });
    fireEvent.change(d.getByLabelText(/Parent \/ guardian/), { target: { value: "Grace Fictional" } });
    fireEvent.change(d.getByLabelText(/^Email/), { target: { value: "family@example.test" } });
    fireEvent.change(d.getByLabelText(/^Phone/), { target: { value: "+1 555 010 2030" } });
    fireEvent.click(d.getByRole("button", { name: "Create application" }));
    expect(await screen.findByText("Duplicate application for this family")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New admission application" })).toBeInTheDocument();
    expect(d.getByLabelText(/Applicant name/)).toHaveValue("Ada Fictional");
  });
});

describe("quiz grading", () => {
  async function takeQuiz(backend: FakeBackend) {
    const q = backend.db.quizzes.find((x) => x.id === "qz-1")!.questions![0]!;
    fireEvent.click(await screen.findByRole("button", { name: "Start quiz" }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^A\\s*${q.options[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit now" }));
    return q;
  }

  test("students receive no answer keys and the client sends only answers for server grading", async () => {
    const backend = createFakeBackend();
    mount("/quizzes/qz-1", { roles: ["student"] }, backend);
    await settle(backend);
    const questionsRequest = backend.requests.find((r) => r.path === "/api/quizzes/qz-1/questions");
    expect(questionsRequest).toBeDefined();
    await takeQuiz(backend);
    expect(await screen.findByText("Answer review")).toBeInTheDocument();
    const grade = backend.requests.find((r) => r.path === "/api/quizzes/qz-1/grade")!;
    expect(Object.keys(grade.body as object).sort()).toEqual(["answers", "studentId", "timeTaken"]);
    expect((grade.body as { answers: unknown[] }).answers[0]).toBe(0);
    expect(backend.attempts).toHaveLength(1);
    // The result shown is the server's score.
    const server = backend.attempts[0]!;
    expect(screen.getByText(`${server.score} / ${server.total} points`, { exact: false })).toBeInTheDocument();
    expect(backend.requests.some((r) => r.path === "/api/quiz-attempts" && r.method === "POST")).toBe(false);
  });

  test("a rejected grade keeps the submitted answers and Retry grade resends the same attempt", async () => {
    let fail = true;
    const backend = createFakeBackend({ intercept: (r) => (r.method === "POST" && r.path === "/quizzes/qz-1/grade" && fail ? new FakeHttpError(503, "Service unavailable") : undefined) });
    mount("/quizzes/qz-1", { roles: ["student"] }, backend);
    await settle(backend);
    await takeQuiz(backend);
    const alert = await screen.findByText("Your answers are not graded yet");
    expect(screen.queryByText("Answer review")).toBeNull();
    const first = backend.requests.filter((r) => r.path === "/api/quizzes/qz-1/grade")[0]!.body;
    fail = false;
    fireEvent.click(within(alert.closest("[role=alert]") as HTMLElement).getByRole("button", { name: "Retry grade" }));
    await waitFor(() => expect(backend.attempts).toHaveLength(1));
    const retried = backend.requests.filter((r) => r.path === "/api/quizzes/qz-1/grade")[1]!.body;
    expect(retried).toEqual(first);
    expect(await screen.findByText("Answer review")).toBeInTheDocument();
  });

  test("staff preview is graded by the server as a preview and not stored", async () => {
    const backend = createFakeBackend();
    mount("/quizzes/qz-1", { roles: ["admin"] }, backend);
    await settle(backend);
    fireEvent.click(await screen.findByRole("button", { name: "Start preview" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit now" }));
    expect(await screen.findByText("Answer review")).toBeInTheDocument();
    expect(backend.gradeRequests[0]).toMatchObject({ preview: true });
    expect(backend.gradeRequests[0]).not.toHaveProperty("studentId");
    expect(backend.attempts).toHaveLength(0);
  });

  test("a recorded attempt opens on its server review, from the server, not the browser", async () => {
    const backend = createFakeBackend();
    backend.attempts.push({ studentId: "s-1192", quizId: "qz-1", score: 1, total: 8, answers: [1], at: new Date().toISOString(), timeTaken: 42, review: [{ answer: 1, explanation: "Server says so" }] });
    const storage = vi.spyOn(Storage.prototype, "getItem");
    mount("/quizzes/qz-1", { roles: ["student"] }, backend);
    await settle(backend);
    expect(await screen.findByText("Answer review")).toBeInTheDocument();
    expect(screen.getByText(/Server says so/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start quiz" })).toBeNull();
    expect(storage).not.toHaveBeenCalled();
  });
});

describe("server-held activity", () => {
  test("a message is shown from the server's returned thread and the draft survives a failure", async () => {
    let fail = true;
    const backend = createFakeBackend({ intercept: (r) => (r.method === "PATCH" && r.path.startsWith("/threads/") && fail ? new FakeHttpError(503, "offline") : undefined) });
    mount("/messages", { roles: ["teacher"] }, backend);
    await settle(backend);
    const box = screen.getByPlaceholderText(/Write a message/);
    fireEvent.change(box, { target: { value: "Please bring the consent form" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/Message not sent — offline/)).toBeInTheDocument();
    expect(box).toHaveValue("Please bring the consent form");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(box).toHaveValue(""));
    const sent = backend.requests.filter((r) => r.method === "PATCH").at(-1)!.body as { messages: { from: string; text: string }[] };
    expect(sent.messages.at(-1)).toMatchObject({ from: "me", text: "Please bring the consent form" });
    expect(sent.messages.every((m) => m.from === "me" || backend.db.threads.some(() => true))).toBe(true);
    expect((await screen.findAllByText("Thanks for your message — I'll get back to you shortly.")).length).toBeGreaterThan(0);
  });

  test("the live room shows the server's participants and chat and sends actions", async () => {
    const backend = createFakeBackend();
    mount("/live/lv-1", { roles: ["admin"] }, backend);
    await settle(backend);
    fireEvent.click(await screen.findByRole("button", { name: /Join as host|Start session|Join now/ }));
    expect(await screen.findByText("Welcome everyone!")).toBeInTheDocument();
    expect(backend.requests.find((r) => r.path === "/api/live/lv-1/actions")?.body).toMatchObject({ action: "join" });
    fireEvent.change(screen.getByLabelText("Message everyone"), { target: { value: "Open page 42" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Open page 42")).toBeInTheDocument();
    // Only the server's roster: one participant beside this user, no generated attendees or chatter.
    expect(backend.rooms.get("lv-1")!.people).toHaveLength(1);
    expect(screen.getAllByText("Amara Chen").length).toBeGreaterThan(0);
  });

  test("a room that cannot be read shows its error and no substitute data", async () => {
    const backend = createFakeBackend({ intercept: (r) => (r.path === "/live/lv-1/room" ? new FakeHttpError(503, "Room service unavailable") : undefined) });
    mount("/live/lv-1", { roles: ["admin"] }, backend);
    await settle(backend);
    fireEvent.click(await screen.findByRole("button", { name: /Join as host|Start session|Join now/ }));
    expect(await screen.findByText("Room service unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Welcome everyone!")).toBeNull();
  });

  test("school profile and fee tariff come from the API", async () => {
    const backend = createFakeBackend();
    mount("/fees", { roles: ["accountant"] }, backend);
    await settle(backend);
    fireEvent.click(screen.getByRole("tab", { name: /Fee structure/ }));
    expect(await screen.findByText(/Sibling discount of 10%/)).toBeInTheDocument();
    expect(backend.requests.some((r) => r.path === "/api/fee-structure")).toBe(true);
    expect(backend.requests.some((r) => r.path === "/api/school-profile")).toBe(true);
  });

  test("a failed first load of school data offers retry instead of a spinner", async () => {
    let fail = true;
    const backend = createFakeBackend({ intercept: (r) => (r.path === "/school-profile" && fail ? new FakeHttpError(500, "Profile unavailable") : undefined) });
    mount("/dashboard", { roles: ["admin"] }, backend);
    expect(await screen.findByText("Profile unavailable")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await settle(backend);
    expect(await screen.findByText("Active students")).toBeInTheDocument();
  });
});

describe("preferences", () => {
  test("editable presentation preferences go through the host callback", async () => {
    const onPreferenceChange = vi.fn();
    const { backend } = mount("/settings", { roles: ["teacher"], onPreferenceChange });
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "Preferences" }));
    fireEvent.click(await screen.findByRole("switch", { name: /Reduce motion/ }));
    expect(onPreferenceChange).toHaveBeenCalledWith("reducedMotion", true);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(onPreferenceChange).toHaveBeenCalledWith("theme", "midnight");
  });

  test("locked preferences are disabled and their handlers refuse changes", async () => {
    const onPreferenceChange = vi.fn();
    const policy = { revision: 2, rules: { reducedMotion: { value: false, locked: true }, theme: { value: "nexora", locked: true }, density: { value: "compact", locked: true } } } as const;
    const { backend } = mount("/settings", { roles: ["teacher"], onPreferenceChange, policy: policy as never });
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "Preferences" }));
    const motion = await screen.findByRole("switch", { name: /Reduce motion/ });
    expect(motion).toBeDisabled();
    fireEvent.click(motion);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeDisabled();
    expect(screen.getAllByText("Managed by your administrator").length).toBeGreaterThan(0);
    expect(onPreferenceChange).not.toHaveBeenCalled();
  });

  test("the settings page renders no portal/role chooser", async () => {
    const { backend } = mount("/settings", { roles: ["teacher", "student", "admin"] });
    await settle(backend);
    expect(screen.queryByText("Portal")).toBeNull();
    expect(screen.queryByText(/Sign out$/)).toBeNull();
  });

  test("an XLSX export preference disables CSV export with the reason", async () => {
    const { backend } = mount("/students", { roles: ["admin"], preferences: { exportFormat: "xlsx" } });
    await settle(backend);
    const button = screen.getByRole("button", { name: "Export" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", expect.stringMatching(/CSV only/));
  });

  test("managed table presentation reaches module tables", async () => {
    const { backend } = mount("/students", { roles: ["admin"], preferences: { density: "spacious", zebraStripes: true, wrapCellText: true } });
    await settle(backend);
    const table = document.querySelector("table[data-managed-table='true']")!;
    expect(table).toHaveAttribute("data-density", "spacious");
    expect(table).toHaveAttribute("data-striped", "true");
    expect(table).toHaveAttribute("data-wrap", "true");
  });

  test("an unavailable preference host disables page-size changes", async () => {
    const { backend } = mount("/students", { roles: ["admin"], preferencesAvailable: false, onPreferenceChange: vi.fn() });
    await settle(backend);
    const sizes = screen.getAllByRole("combobox").filter((el) => el.querySelector("option[value='50']"));
    expect(sizes.length).toBeGreaterThan(0);
    for (const el of sizes) expect(el).toBeDisabled();
  });
});

describe("grade retry under StrictMode", () => {
  test("after a failed grade, one Retry click sends exactly one more POST with the same answers", async () => {
    let fail = true;
    const backend = createFakeBackend({ intercept: (r) => (r.method === "POST" && r.path === "/quizzes/qz-1/grade" && fail ? new FakeHttpError(503, "Grader down") : undefined) });
    render(<StrictMode><ReferenceSchoolModule path="/quizzes/qz-1" host={fakeHost(backend, { roles: ["student"] })} /></StrictMode>);
    await settle(backend);
    const q = backend.db.quizzes.find((x) => x.id === "qz-1")!.questions![0]!;
    fireEvent.click(await screen.findByRole("button", { name: "Start quiz" }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^A\\s*${q.options[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit now" }));
    await screen.findByText("Your answers are not graded yet");
    const grades = () => backend.requests.filter((r) => r.method === "POST" && r.path === "/api/quizzes/qz-1/grade");
    const before = grades().length;
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry grade" }));
    expect(await screen.findByText("Answer review")).toBeInTheDocument();
    await settle(backend);
    expect(grades().length).toBe(before + 1);
    expect(grades().at(-1)!.body).toEqual(grades()[before - 1]!.body);
    expect(backend.attempts).toHaveLength(1);
  });
});

describe("record preview follows previewMode", () => {
  const openStudent = async (mode: string) => {
    const env = mount("/students", { roles: ["admin"], preferences: { previewMode: mode as never } });
    await settle(env.backend);
    const s = env.backend.db.students.find((x) => x.status === "Active")!;
    fireEvent.click(screen.getAllByText(s.name)[0]!);
    await screen.findByText(`${s.admissionNo}`, { exact: false, selector: "p" }).catch(() => null);
    return { ...env, student: s };
  };

  test.each([
    ["inline", false], ["center-card", true], ["center-modal", true], ["left-drawer", true], ["right-drawer", true],
  ] as const)("%s renders the record in the matching shared frame", async (mode, dialog) => {
    const { student } = await openStudent(mode);
    const body = await waitFor(() => { const el = document.querySelector(`[data-record-preview="${mode}"]`); expect(el).not.toBeNull(); return el as HTMLElement; });
    const frame = body.closest('[role="dialog"]');
    expect(Boolean(frame)).toBe(dialog);
    if (!dialog) expect(body.closest("section")).toHaveAccessibleName(student.name);
    if (mode === "left-drawer") expect(body.closest("aside")!.className).toMatch(/\bleft-0\b/);
    if (mode === "right-drawer") expect(body.closest("aside")!.className).toMatch(/\bright-0\b/);
    expect(within(body).getByText("Overview")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /close/i }).at(-1)!);
    await waitFor(() => expect(document.querySelector("[data-record-preview]")).toBeNull());
  });

  test("changing previewMode while open keeps the record and the grader's unsaved feedback", async () => {
    const env = mount("/assignments", { roles: ["teacher"], preferences: { previewMode: "right-drawer" } });
    await settle(env.backend);
    const a = env.backend.db.assignments.find((x) => x.teacherId === "t-001" && x.submitted > x.graded)!;
    fireEvent.click(screen.getAllByText(a.title)[0]!);
    const feedback = (await screen.findAllByPlaceholderText("Feedback for the student"))[0]!;
    fireEvent.change(feedback, { target: { value: "Show the method in part (b)" } });
    env.rerender("/assignments", { roles: ["teacher"], preferences: { previewMode: "center-modal" } });
    await waitFor(() => expect(document.querySelector('[data-record-preview="center-modal"]')).not.toBeNull());
    expect((await screen.findAllByPlaceholderText("Feedback for the student"))[0]).toHaveValue("Show the method in part (b)");
    env.rerender("/assignments", { roles: ["teacher"], preferences: { previewMode: "inline" } });
    await waitFor(() => expect(document.querySelector('[data-record-preview="inline"]')).not.toBeNull());
    expect((await screen.findAllByPlaceholderText("Feedback for the student"))[0]).toHaveValue("Show the method in part (b)");
    expect(screen.getAllByText(a.title).length).toBeGreaterThan(0);
  });
});

describe("fees receipts", () => {
  const payFirst = async (backend: FakeBackend) => {
    mount("/fees", { roles: ["student"] }, backend);
    await settle(backend);
    fireEvent.click((await screen.findAllByRole("button", { name: /^Pay / }))[0]!);
    fireEvent.click(await screen.findByRole("radio", { name: "Bank transfer" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getAllByRole("button", { name: /^Pay / }).at(-1)!);
  };

  test("a payment without a server receipt claims no receipt or email", async () => {
    const backend = createFakeBackend();
    await payFirst(backend);
    expect(await screen.findByText("Payment successful")).toBeInTheDocument();
    expect(screen.getByText("Thank you!")).toBeInTheDocument();
    expect(screen.queryByText(/Receipt|emailed/)).toBeNull();
  });

  test("the receipt shown is the server's, and the email claim only when the server sent it", async () => {
    const backend = createFakeBackend({ intercept: (r) => {
      if (r.method !== "PATCH" || !r.path.startsWith("/invoices/")) return undefined;
      const inv = backend.db.invoices.find((i) => r.path.endsWith(i.id))!;
      return { data: { ...inv, paid: inv.amount, status: "Paid", receiptNo: "RCPT-SRV-0042", receiptSent: true } };
    } });
    await payFirst(backend);
    expect(await screen.findByText(/Receipt RCPT-SRV-0042 has been emailed to the guardian/)).toBeInTheDocument();
  });

  test("a rejected collection keeps the dialog and the entered amount", async () => {
    const backend = createFakeBackend({ intercept: (r) => (r.method === "PATCH" && r.path.startsWith("/invoices/") ? new FakeHttpError(409, "Invoice changed; reload") : undefined) });
    mount("/fees", { roles: ["accountant"] }, backend);
    await settle(backend);
    fireEvent.click((await screen.findAllByRole("button", { name: "Collect" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Record payment" });
    const amount = within(dialog).getByLabelText(/^Amount/);
    fireEvent.change(amount, { target: { value: "100" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Record/ }));
    expect(await screen.findByText("Invoice changed; reload")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Record payment" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: "Record payment" })).getByLabelText(/^Amount/)).toHaveValue(100);
  });
});

describe("dashboard statistics and bridge presentation", () => {
  test("no trend is shown unless the server sends one", async () => {
    const { backend } = mount("/dashboard", { roles: ["admin"] });
    await settle(backend);
    expect(screen.getByText("Active students")).toBeInTheDocument();
    expect(screen.queryByText(/[+−]\d+(\.\d+)?%/)).toBeNull();
  });

  test("server trends are displayed on the compact source KPI tile", async () => {
    const env = mount("/dashboard", { roles: ["admin"] }, createFakeBackend({ trends: { students: 3.2, attendanceToday: 0.8 } }));
    await settle(env.backend);
    expect(screen.getByText("+3.2%")).toBeInTheDocument();
    const tile = screen.getByText("Active students").closest(".school-kpi")!;
    expect(tile).not.toBeNull();
    expect(tile.className).toMatch(/school-kpi-brand/);
  });

  test("avatars keep the source's exact pixel size", async () => {
    const { backend } = mount("/live/lv-1", { roles: ["admin"] });
    await settle(backend);
    await screen.findByText("Back to live classes");
    const sizes = [...document.querySelectorAll<HTMLElement>(".school-avatar")].map((el) => el.style.width);
    expect(sizes).toContain("88px");
    expect(sizes).toContain("26px");
  });
});
