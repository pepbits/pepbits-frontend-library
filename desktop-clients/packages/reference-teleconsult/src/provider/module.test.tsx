import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ReferenceTeleconsultProviderModule } from "./module";
import { encounter, json, makeHost, providerHandler, type ProviderServer } from "../test-utils";
import type { Recorded } from "../test-utils";

beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as never; });

const open = (server: ProviderServer, path: string, host = makeHost(providerHandler(server), { path })) => {
  const view = render(<ReferenceTeleconsultProviderModule path={path} host={host.host} />);
  return { ...host, ...view };
};
const roleHeader = (calls: ReturnType<typeof makeHost>["calls"]) => calls.filter((c) => c.url.pathname !== "/api/session").map((c) => c.headers.get("X-Teleconsult-Role"));

describe("provider module", () => {
  it("renders the Today workspace without a second sidebar or shell, with the demo disclosure", async () => {
    const view = open({ roles: ["doctor"] }, "/");
    expect(await screen.findByText("Virtual waiting room")).toBeInTheDocument();
    expect(view.container.querySelector("nav[aria-label='Main']")).toBeNull();
    expect(screen.queryByText("Clinic Desk")).toBeNull();
    expect(view.container.querySelector(".teleconsult-provider")).not.toBeNull();
    expect(screen.getByText(/Demo workspace/)).toBeInTheDocument();
  });

  it("offers only the modes the server granted", async () => {
    open({ roles: ["doctor"] }, "/");
    const group = await screen.findByRole("group", { name: "Working mode" });
    expect(within(group).getAllByRole("radio")).toHaveLength(1);
    expect(within(group).queryByRole("radio", { name: /Nurse/ })).toBeNull();
  });

  it("switches mode through the server: asks /api/session?role= and routes later requests with the validated role", async () => {
    const view = open({ roles: ["doctor", "nurse"] }, "/");
    const group = await screen.findByRole("group", { name: "Working mode" });
    await waitFor(() => expect(roleHeader(view.calls)).toContain("doctor"));
    fireEvent.click(within(group).getByRole("radio", { name: /Nurse/ }));
    await waitFor(() => expect(view.calls.some((c) => c.url.pathname === "/api/session" && c.url.searchParams.get("role") === "nurse")).toBe(true));
    await waitFor(() => expect(within(group).getByRole("radio", { name: /Nurse/ })).toHaveAttribute("aria-checked", "true"));
    await waitFor(() => expect(roleHeader(view.calls)).toContain("nurse"));
    // Every non-session request after the switch is routed as nurse.
    const lastDoctor = roleHeader(view.calls).lastIndexOf("doctor");
    expect(roleHeader(view.calls).slice(lastDoctor + 1).every((role) => role === "nurse")).toBe(true);
  });

  it("falls back to the granted role and reports the problem when the server refuses a mode", async () => {
    const view = open({ roles: ["doctor", "nurse"] }, "/");
    const group = await screen.findByRole("group", { name: "Working mode" });
    // The account loses its nurse grant after the chooser was shown.
    const server: ProviderServer = { roles: ["doctor", "nurse"] };
    const handler = providerHandler(server);
    view.fetch.mockImplementation(async (path: string, init: RequestInit = {}) => {
      const result = path.includes("role=nurse") ? { status: 403, body: { error: "Role not granted" } } : (await handler({ method: init.method ?? "GET", path, url: new URL(path, "https://host.test"), headers: new Headers(init.headers), signal: init.signal })) ?? { status: 404, body: {} };
      return new Response(JSON.stringify(result.body ?? null), { status: result.status ?? 200 });
    });
    fireEvent.click(within(group).getByRole("radio", { name: /Nurse/ }));
    expect(await screen.findByText("API offline")).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /Doctor/ })).toHaveAttribute("aria-checked", "true");
  });

  it("offers registration only when the server says the account can register", async () => {
    open({ roles: ["doctor"], canRegister: false }, "/patients");
    await screen.findByPlaceholderText(/Search by name, MRN/);
    expect(screen.queryByRole("button", { name: /Register patient/ })).toBeNull();
    cleanup();
    open({ roles: ["doctor"], canRegister: true }, "/patients");
    expect(await screen.findByRole("button", { name: /Register patient/ })).toBeInTheDocument();
  });

  it("aborts every in-flight request when the authenticated scope changes", async () => {
    const signals: AbortSignal[] = [];
    const base = providerHandler({ roles: ["doctor"] });
    const harness = makeHost((r) => { if (r.url.pathname === "/api/queue" && r.signal) signals.push(r.signal); return r.url.pathname === "/api/queue" ? new Promise(() => undefined) : base(r); }, { path: "/" });
    const view = render(<ReferenceTeleconsultProviderModule path="/" host={harness.host} />);
    await waitFor(() => expect(signals.length).toBeGreaterThan(0));
    const other = { ...harness.host, scope: { ...harness.host.scope, branchId: "dubai" } };
    view.rerender(<ReferenceTeleconsultProviderModule path="/" host={other} />);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it("reports an unknown route instead of rendering a page", async () => {
    open({ roles: ["doctor"] }, "/nope");
    expect(await screen.findByText("Teleconsult page not found")).toBeInTheDocument();
  });
});

describe("consultation", () => {
  it("polls authenticated /current frames (never an EventSource or stream URL) and labels simulated content", async () => {
    const eventSource = vi.fn();
    vi.stubGlobal("EventSource", eventSource);
    const view = open({ roles: ["doctor"], encounter: { recording: { consent: true, active: true, seconds: 5 } } }, "/consult/a1");
    expect(await screen.findByText(/Demo readings generated by the API/)).toBeInTheDocument();
    await waitFor(() => expect(view.calls.some((c) => c.url.pathname === "/api/appointments/a1/vitals/current")).toBe(true));
    await waitFor(() => expect(view.calls.some((c) => c.url.pathname === "/api/appointments/a1/transcript/current")).toBe(true));
    expect(view.calls.some((c) => /\/stream$/.test(c.url.pathname))).toBe(false);
    expect(eventSource).not.toHaveBeenCalled();
    expect(view.calls.every((c) => !c.path.includes("token"))).toBe(true);
    expect(screen.getByText(/Simulated remote participant/)).toBeInTheDocument();
    expect(screen.getByText(/Demo call: the remote participant, recording and transcript are simulated/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Add a demo clinical photo marker/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("stops polling the vitals once the note is signed", async () => {
    const view = open({ roles: ["doctor"], encounter: { status: "signed", version: 8, signedBy: "d1" }, appointment: { status: "completed" } }, "/consult/a1");
    await screen.findByText(/Signed and locked/);
    expect(view.calls.some((c) => c.url.pathname.endsWith("/vitals/current"))).toBe(false);
  });

  it("signs from the Sign off tab with the expected version and shows server problems without losing the draft", async () => {
    const server: ProviderServer = {
      roles: ["doctor"],
      encounter: { version: 3, allergiesReviewed: true, diagnoses: [{ code: "N30.0", display: "Acute cystitis", type: "primary", certainty: "confirmed", addToProblemList: false }], soap: { subjective: "Burning", objective: "", assessment: "Cystitis", plan: "Nitrofurantoin" }, patientInstructions: "Drink water" },
      sign: () => json({ error: "Cannot sign yet", problems: ["Resolve or override 1 critical safety alert(s)"] }, 422),
    };
    const view = open(server, "/consult/a1");
    fireEvent.click(await screen.findByRole("tab", { name: /Sign off/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Sign and complete visit/ }));
    expect(await screen.findByText("Resolve or override 1 critical safety alert(s)")).toBeInTheDocument();
    const sign = view.calls.find((c) => c.url.pathname === "/api/encounters/e1/sign")!;
    expect((sign.body as { encounter: { version: number }; signerId: string }).encounter.version).toBe(3);
    expect((sign.body as { signerId: string }).signerId).toBe("d1");
    expect(sign.headers.get("Idempotency-Key")).toBeTruthy();
    expect(sign.headers.get("X-Teleconsult-Role")).toBe("doctor");
    expect(screen.getByRole("button", { name: /Sign and complete visit/ })).toBeEnabled();
  });

  it("locks prescribing in nurse mode", async () => {
    open({ roles: ["nurse"] }, "/consult/a1");
    fireEvent.click(await screen.findByRole("tab", { name: /Prescriptions/ }));
    expect(await screen.findByText("Prescribing needs a doctor")).toBeInTheDocument();
  });

  it("shows the conflict banner and keeps the edited text when autosave is refused", async () => {
    const base = providerHandler({ roles: ["doctor"], encounter: { version: 3 } });
    let reads = 0;
    const harness = makeHost((r) => {
      if (r.method === "PUT") return json({ error: "version out of date" }, 409);
      if (r.url.pathname === "/api/appointments/a1/encounter" && reads++ > 0) return json(encounter({ version: 6, soap: { subjective: "Theirs", objective: "", assessment: "", plan: "" } }));
      return base(r);
    }, { path: "/consult/a1" });
    render(<ReferenceTeleconsultProviderModule path="/consult/a1" host={harness.host} />);
    const target = (await screen.findAllByRole("textbox")).find((box) => box.tagName === "TEXTAREA") as HTMLTextAreaElement;
    fireEvent.change(target, { target: { value: "My unsaved history" } });
    const alert = await screen.findByText(/saved elsewhere since you opened it/, undefined, { timeout: 4000 });
    expect(alert).toBeInTheDocument();
    expect(target.value).toBe("My unsaved history");
    expect(screen.getByRole("button", { name: /Keep my edits and save over the latest/ })).toBeInTheDocument();
  });
});

describe("nurse mode", () => {
  it("has no sign-off: no Sign off tab, no global Review and sign button, no nurse signature action; triage hand-off stays", async () => {
    const view = open({ roles: ["nurse"] }, "/consult/a1");
    expect(await screen.findByRole("tab", { name: /Triage/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Sign off/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Review and sign/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sign nurse-led visit|Sign and complete visit/ })).toBeNull();
    // The global trigger is triage review in nurse mode.
    expect(screen.getByRole("button", { name: "Review triage" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Complete triage and hand off to doctor/ })).toBeInTheDocument();
    // Alt+8 (the doctor's sign-off shortcut) does nothing for a nurse.
    fireEvent.click(screen.getByRole("tab", { name: /Notes/ }));
    fireEvent.keyDown(window, { key: "8", altKey: true });
    expect(screen.getByRole("tab", { name: /Notes/ })).toHaveAttribute("aria-selected", "true");
    expect(view.calls.some((c) => c.url.pathname.endsWith("/sign"))).toBe(false);
  });

  it("does not list Review and sign in the quick-add palette", async () => {
    open({ roles: ["nurse"] }, "/consult/a1");
    await screen.findByRole("tab", { name: /Triage/ });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByText("Go to Allergies")).toBeInTheDocument();
    expect(screen.queryByText("Go to Review and sign")).toBeNull();
  });

  it("keeps sign-off for the doctor", async () => {
    open({ roles: ["doctor"] }, "/consult/a1");
    expect(await screen.findByRole("tab", { name: /Sign off/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review and sign/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review triage" })).toBeNull();
  });

  it("drops the sign-off tab when a doctor switches to nurse mode on the sign-off tab", async () => {
    open({ roles: ["doctor", "nurse"] }, "/consult/a1");
    fireEvent.click(await screen.findByRole("tab", { name: /Sign off/ }));
    expect(await screen.findByRole("button", { name: /Sign and complete visit/ })).toBeInTheDocument();
    fireEvent.click(within(await screen.findByRole("group", { name: "Working mode" })).getByRole("radio", { name: /Nurse/ }));
    await waitFor(() => expect(screen.queryByRole("tab", { name: /Sign off/ })).toBeNull());
    expect(screen.queryByRole("button", { name: /Sign and complete visit/ })).toBeNull();
  });
});

describe("booking dialog uses the effective settings", () => {
  const server: ProviderServer = {
    roles: ["doctor"],
    settings: { modes: ["video", "audio"], scheduling: { slotIntervalMin: 30, defaultDurationMin: 30, minDurationMin: 30, maxDurationMin: 90 } },
  };
  const openDialog = async (over: ProviderServer = server) => {
    const view = open(over, "/schedule");
    fireEvent.click((await screen.findAllByRole("button", { name: "Book visit" }))[0]);
    const dialog = await screen.findByRole("dialog");
    return { view, dialog };
  };

  it("offers only the supported visit modes and the clinic's slot durations", async () => {
    const { dialog } = await openDialog();
    const type = within(dialog).getAllByRole("radiogroup")[0];
    expect(within(type).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Video", "Audio"]);
    const duration = within(dialog).getByLabelText("Duration") as HTMLSelectElement;
    expect([...duration.options].map((o) => o.value)).toEqual(["30", "60", "90"]);
    expect(duration.value).toBe("30");
  });

  it("asks for slots of the chosen length and books with that duration and a supported mode", async () => {
    const { view, dialog } = await openDialog();
    fireEvent.click(await within(dialog).findByRole("button", { name: /Sarah O'Connor/ }));
    fireEvent.change(within(dialog).getByPlaceholderText(/Cough and fever/), { target: { value: "Follow-up" } });
    fireEvent.change(within(dialog).getByLabelText("Duration"), { target: { value: "60" } });
    await waitFor(() => expect(view.calls.some((c: Recorded) => c.url.pathname === "/api/slots" && c.url.searchParams.get("durationMin") === "60")).toBe(true));
    fireEvent.click((await within(dialog).findAllByRole("button", { name: /\d:\d\d/ }))[0]);
    fireEvent.click(within(dialog).getByRole("radio", { name: "Audio" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Book visit" }));
    await waitFor(() => expect(view.calls.some((c: Recorded) => c.method === "POST" && c.url.pathname === "/api/appointments")).toBe(true));
    const post = view.calls.find((c: Recorded) => c.method === "POST" && c.url.pathname === "/api/appointments")!;
    expect(post.body).toMatchObject({ patientId: "p8", clinicianId: "d1", durationMin: 60, mode: "audio", createdBy: "staff", reason: "Follow-up" });
  });

  it("falls back to the first allowed mode and the default length when nothing was chosen", async () => {
    const { view, dialog } = await openDialog({ roles: ["doctor"], settings: { modes: ["chat"] } });
    expect(within(dialog).getAllByRole("radio").map((r) => r.textContent)).toContain("Chat");
    fireEvent.click(await within(dialog).findByRole("button", { name: /Sarah O'Connor/ }));
    fireEvent.change(within(dialog).getByPlaceholderText(/Cough and fever/), { target: { value: "Review" } });
    fireEvent.click((await within(dialog).findAllByRole("button", { name: /\d:\d\d/ }))[0]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Book visit" }));
    await waitFor(() => expect(view.calls.some((c: Recorded) => c.method === "POST" && c.url.pathname === "/api/appointments")).toBe(true));
    expect(view.calls.find((c: Recorded) => c.method === "POST" && c.url.pathname === "/api/appointments")!.body).toMatchObject({ mode: "chat", durationMin: 15 });
    expect(within(dialog).queryByRole("radio", { name: "Video" })).toBeNull();
  });
});
