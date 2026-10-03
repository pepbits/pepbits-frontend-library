import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ReferenceTeleconsultPatientModule } from "./module";
import { appointment, appointmentView, encounter, json, makeHost, patient, patientHandler, settings, staff, type Handler, type PatientServer, type Recorded } from "../test-utils";

beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as never; });
afterEach(() => vi.restoreAllMocks());

const open = (server: PatientServer, path: string, handler: Handler = patientHandler(server)) => {
  const harness = makeHost(handler, { path, scope: { roles: ["teleconsult-patient"] } });
  const view = render(<ReferenceTeleconsultPatientModule path={path} host={harness.host} />);
  return { ...harness, ...view };
};
/** Continue is enabled only once the server has answered the current answers. */
const next = async () => {
  const button = screen.getByRole("button", { name: "Continue" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
};
const sarah = patient();
const other = patient({ id: "p1", firstName: "Ana", lastName: "Ruiz", phone: "+1 555 0101" });

describe("patient identity", () => {
  it("binds a dedicated patient account to its own record without touching browser storage or listing patients", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const view = open({ patients: [sarah], bound: "p8" }, "/");
    await waitFor(() => expect(view.host.navigate).toHaveBeenCalledWith("/home"));
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(view.calls.some((c) => c.url.pathname === "/api/patients")).toBe(false);
  });

  it("lets an administrator pick only server-granted people and routes later requests with the chosen beneficiary", async () => {
    const view = open({ patients: [sarah, other] }, "/");
    expect(await screen.findByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Sarah O'Connor")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ana Ruiz"));
    await waitFor(() => expect(view.host.navigate).toHaveBeenCalledWith("/home"));
    expect(view.calls.some((c) => c.url.pathname === "/api/session" && c.url.searchParams.get("patientId") === "p1")).toBe(true);
    view.rerender(<ReferenceTeleconsultPatientModule path="/home" host={{ ...view.host, path: "/home" }} />);
    await waitFor(() => expect(view.calls.some((c) => c.url.pathname === "/api/patients/p1/appointments" || c.headers.get("X-Teleconsult-Patient") === "p1")).toBe(true));
    expect(view.calls.filter((c) => c.url.pathname !== "/api/session").every((c) => c.headers.get("X-Teleconsult-Patient") === "p1")).toBe(true);
  });

  it("does not switch identity when the server refuses the person", async () => {
    const view = open({ patients: [sarah, other] }, "/", (r) => {
      if (r.url.pathname === "/api/session" && r.url.searchParams.get("patientId") === "p1") return json({ error: "Not allowed to act for that person" }, 403);
      return patientHandler({ patients: [sarah, other] })(r);
    });
    fireEvent.click(await screen.findByText("Ana Ruiz"));
    expect(await screen.findByText("Not allowed to act for that person")).toBeInTheDocument();
    expect(view.host.navigate).not.toHaveBeenCalled();
  });

  it("rejects a session that answers for a different person than requested", async () => {
    const view = open({ patients: [sarah, other] }, "/", (r) => {
      if (r.url.pathname === "/api/session" && r.url.searchParams.get("patientId")) return json({ patient: sarah, patients: [sarah, other], canRegister: false, settings: settings() });
      return patientHandler({ patients: [sarah, other] })(r);
    });
    fireEvent.click(await screen.findByText("Ana Ruiz"));
    expect(await screen.findByText("This account cannot act for that person")).toBeInTheDocument();
    expect(view.host.navigate).not.toHaveBeenCalled();
  });

  it("shows registration only when the session allows it", async () => {
    open({ patients: [sarah, other], canRegister: false }, "/");
    await screen.findByText("Ana Ruiz");
    expect(screen.queryByRole("button", { name: /Create an account/ })).toBeNull();
    cleanup();
    open({ patients: [sarah, other], canRegister: true }, "/");
    expect(await screen.findByRole("button", { name: /Create an account/ })).toBeInTheDocument();
    cleanup();
    open({ patients: [sarah], bound: "p8", canRegister: false }, "/register");
    expect(await screen.findByText(/Registration is not available/)).toBeInTheDocument();
  });
});

describe("patient layout", () => {
  it("keeps the phone column, bottom navigation and demo disclosure inside the module", async () => {
    const view = open({ patients: [sarah], bound: "p8" }, "/home");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Home", "Book", "My health"]);
    expect(view.container.querySelector(".teleconsult-patient .tc-phone")).not.toBeNull();
    expect(screen.getByText(/Demo CareCall with fictional data/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch person" })).toBeNull();
  });

  it("offers a way to switch person only when the account may act for several", async () => {
    open({ patients: [sarah, other], bound: "p8" }, "/home");
    expect(await screen.findByRole("button", { name: "Switch person" })).toBeInTheDocument();
  });
});

describe("visit", () => {
  it("polls the authenticated current vitals frame and labels the readings as simulated", async () => {
    const eventSource = vi.fn();
    vi.stubGlobal("EventSource", eventSource);
    const view = open({ patients: [sarah], bound: "p8" }, "/visit/a1");
    expect(await screen.findByText(/Demo readings, shared with your doctor/)).toBeInTheDocument();
    expect(screen.getByText(/Simulated by the demo API/)).toBeInTheDocument();
    expect(view.calls.some((c) => c.url.pathname === "/api/appointments/a1/vitals/current" && c.headers.get("X-Teleconsult-Patient") === "p8")).toBe(true);
    expect(view.calls.some((c) => c.url.pathname.endsWith("/stream"))).toBe(false);
    expect(eventSource).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("describes the call as a simulation and does not pretend audio or the clinician video is transmitted", async () => {
    const base = patientHandler({ patients: [sarah], bound: "p8" });
    open({ patients: [sarah], bound: "p8" }, "/visit/a1", (r) => r.url.pathname === "/api/appointments/a1" ? json(appointmentView({ status: "in-call", recordingActive: true })) : base(r));
    expect(await screen.findByText(/Demo call: your clinician’s video and audio are simulated/)).toBeInTheDocument();
    expect(screen.getByText("Recording")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mute \(demo: no audio is sent\)/ })).toBeInTheDocument();
  });

  it("keeps a typed chat message when sending fails, and reports why", async () => {
    const base = patientHandler({ patients: [sarah], bound: "p8" });
    open({ patients: [sarah], bound: "p8" }, "/visit/a1", (r) => r.method === "POST" && r.url.pathname.endsWith("/messages") ? json({ error: "Messaging is unavailable" }, 503) : base(r));
    fireEvent.click(await screen.findByRole("button", { name: "Open chat" }));
    const box = await screen.findByPlaceholderText("Message your care team");
    fireEvent.change(box, { target: { value: "I have a question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Messaging is unavailable")).toBeInTheDocument();
    expect((box as HTMLInputElement).value).toBe("I have a question");
  });

  it("books with an Idempotency-Key, and a retry after a lost response replays the same key", async () => {
    const base = patientHandler({ patients: [sarah], bound: "p8" });
    let posts = 0;
    const view = open({ patients: [sarah], bound: "p8" }, "/book", (r) => {
      if (r.method === "POST" && r.url.pathname === "/api/appointments") { posts++; if (posts === 1) throw new TypeError("connection reset"); }
      return base(r);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Cough" }));
    await next();
    fireEvent.click(await screen.findByRole("button", { name: /Dr\. Meera Iyer/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: /\d:\d\d/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm booking" }));
    expect(await screen.findByText(/Can't reach the Teleconsult API/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect(await screen.findByText("You’re booked")).toBeInTheDocument();
    const bookings = view.calls.filter((c) => c.method === "POST" && c.url.pathname === "/api/appointments");
    expect(bookings).toHaveLength(2);
    expect(bookings[0].headers.get("Idempotency-Key")).toBeTruthy();
    expect(bookings[1].headers.get("Idempotency-Key")).toBe(bookings[0].headers.get("Idempotency-Key"));
    expect(bookings[0].headers.get("X-Teleconsult-Patient")).toBe("p8");
    expect(bookings[0].body).toMatchObject({ patientId: "p8", clinicianId: "d1", createdBy: "patient", mode: "video", priority: "routine" });
  });
});

const advicePath = (calls: Recorded[]) => calls.filter((c) => c.url.pathname === "/api/booking-advice");
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };

describe("booking advice from the server", () => {
  const bound: PatientServer = { patients: [sarah], bound: "p8" };

  it("asks the API for the specialty and urgency, and uses its answer to label the suggestion and book as urgent", async () => {
    const view = open({ ...bound, advice: () => json({ specialty: "Cardiology", urgent: true, demo: true }) }, "/book");
    fireEvent.click(await screen.findByRole("button", { name: "Chest pain" }));
    await next();
    const asked = advicePath(view.calls).at(-1)!;
    expect(asked.url.searchParams.get("patientId")).toBe("p8");
    expect(asked.url.searchParams.get("symptoms")).toBe("Chest pain");
    expect(asked.url.searchParams.get("severity")).toBe("4");
    expect(asked.headers.get("X-Teleconsult-Patient")).toBe("p8");
    // The API's specialty is the suggested one and filters the clinicians; the answer is labelled as demo advice.
    expect(await screen.findByRole("button", { name: "Cardiology · suggested" })).toBeInTheDocument();
    expect(screen.getByText(/demo advice from the demo API, not medical advice/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dr\. Meera Iyer/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Dr\. Omar Haddad/ }));
    await next();
    fireEvent.click(await screen.findByRole("button", { name: /\d:\d\d/ }));
    await next();
    expect(await screen.findByText("Urgent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect(await screen.findByText("You’re booked")).toBeInTheDocument();
    expect(view.calls.find((c) => c.method === "POST" && c.url.pathname === "/api/appointments")!.body).toMatchObject({ clinicianId: "d2", priority: "urgent" });
  });

  it("shows the urgent warning only from the API's urgency, not from the browser's own reading of the symptoms", async () => {
    // The API says routine for chest pain: the browser must not second-guess it.
    open({ ...bound, advice: () => json({ specialty: "General medicine", urgent: false, demo: true }) }, "/book");
    fireEvent.click(await screen.findByRole("button", { name: "Chest pain" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    expect(screen.queryByText(/call your local emergency number/)).toBeNull();
    cleanup();
    open({ ...bound, advice: (r) => json({ specialty: "General medicine", urgent: Number(r.url.searchParams.get("severity")) >= 8, demo: true }) }, "/book");
    fireEvent.click(await screen.findByRole("button", { name: "Cough" }));
    fireEvent.change(screen.getByRole("slider", { name: "Severity" }), { target: { value: "9" } });
    expect(await screen.findByText(/call your local emergency number/)).toBeInTheDocument();
  });

  it("cannot continue or book on a stale answer: changed answers wait for new advice and a late old reply is ignored", async () => {
    const first = deferred<{ body: unknown }>();
    const view = open({
      ...bound,
      advice: (r) => (r.url.searchParams.get("symptoms") === "Cough" ? (first.promise as never) : json({ specialty: "Cardiology", urgent: false, demo: true })),
    }, "/book");
    fireEvent.click(await screen.findByRole("button", { name: "Cough" }));
    await waitFor(() => expect(advicePath(view.calls)).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByText("Checking your answers…")).toBeInTheDocument();
    // The answers change before the first reply: a different request goes out and the first is abandoned.
    fireEvent.click(screen.getByRole("button", { name: "Chest pain" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    expect(advicePath(view.calls).at(-1)!.url.searchParams.get("symptoms")).toBe("Cough,Chest pain");
    first.resolve(json({ specialty: "Psychiatry", urgent: true, demo: true }) as never);
    await new Promise((r) => setTimeout(r, 20));
    // The late "Psychiatry / urgent" reply for the old answers changed nothing.
    expect(screen.queryByText(/call your local emergency number/)).toBeNull();
    await next();
    expect(await screen.findByRole("button", { name: "Cardiology · suggested" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Psychiatry/ })).toBeNull();
  });

  it("does not offer Continue when the API cannot answer, reports why, and asks again on retry", async () => {
    let calls = 0;
    open({ ...bound, advice: () => (++calls === 1 ? json({ error: "Advice is unavailable" }, 503) : json({ specialty: "General medicine", urgent: false, demo: true })) }, "/book");
    fireEvent.click(await screen.findByRole("button", { name: "Cough" }));
    expect(await screen.findByText(/Advice is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await next();
    expect(await screen.findByRole("button", { name: "General medicine · suggested" })).toBeInTheDocument();
  });

  it("does not accept a malformed advice payload", async () => {
    open({ ...bound, advice: () => json({ specialty: "Cardiology" }) }, "/book");
    fireEvent.click(await screen.findByRole("button", { name: "Cough" }));
    expect(await screen.findByText(/booking advice is malformed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("effective settings in patient booking", () => {
  it("offers only the visit modes the branch supports and books with one of them", async () => {
    const view = open({ patients: [sarah], bound: "p8", settings: { modes: ["audio", "chat"] } }, "/book");
    fireEvent.click(await screen.findByRole("button", { name: "Cough" }));
    await next();
    fireEvent.click(await screen.findByRole("button", { name: /Dr\. Meera Iyer/ }));
    await next();
    fireEvent.click(await screen.findByRole("button", { name: /\d:\d\d/ }));
    expect(screen.queryByRole("button", { name: /^Video$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Phone/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chat/ })).toBeInTheDocument();
    await next();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm booking" }));
    await screen.findByText("You’re booked");
    // No choice was made, so the first mode the server allows is used, never an unsupported default.
    expect(view.calls.find((c) => c.method === "POST" && c.url.pathname === "/api/appointments")!.body).toMatchObject({ mode: "audio" });
  });

  it("does not let a patient book, or ask for advice, when the branch disables patient booking", async () => {
    const view = open({ patients: [sarah], bound: "p8", settings: { allowPatientBooking: false } }, "/book");
    expect(await screen.findByText(/Online booking is not available for this clinic/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cough" })).toBeNull();
    expect(advicePath(view.calls)).toHaveLength(0);
    expect(within(screen.getByRole("navigation", { name: "Main" })).queryByRole("link", { name: "Book" })).toBeNull();
    cleanup();
    open({ patients: [sarah], bound: "p8", settings: { allowPatientBooking: false } }, "/home");
    await screen.findByText("Allergies and medicines");
    expect(screen.queryByRole("link", { name: /Book a visit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Book a video visit/ })).toBeNull();
  });
});

describe("patient registration", () => {
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
  const clickContinue = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  it("registers through the allowed administrator session with the form's own fields, then acts for the new person", async () => {
    const server: PatientServer = { patients: [sarah, other], canRegister: true };
    const view = open(server, "/register");
    fill("First name", "Lena");
    fill("Last name", "Fischer");
    fill("Date of birth", "1991-03-14");
    clickContinue();
    fill("Mobile number", "+1 555 0123");
    clickContinue();
    fireEvent.click(await screen.findByRole("switch", { name: "I have no known allergies" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(view.host.navigate).toHaveBeenCalledWith("/home"));
    const post = view.calls.find((c) => c.method === "POST" && c.url.pathname === "/api/patients")!;
    expect(post.body).toMatchObject({ firstName: "Lena", lastName: "Fischer", dob: "1991-03-14", phone: "+1 555 0123", noKnownAllergies: true, allergies: [], insurance: { payer: "Self-pay" } });
    expect(post.headers.get("Idempotency-Key")).toBeTruthy();
    // Who recorded the registration is the server's authenticated actor, never something the form claims.
    expect(JSON.stringify(post.body)).not.toContain("recordedBy");
    expect(view.calls.some((c) => c.url.pathname === "/api/session" && c.url.searchParams.get("patientId") === "p9")).toBe(true);
  });

  it("shows the welcome entry point to register only for a session that may, and refuses the form otherwise", async () => {
    const denied = open({ patients: [sarah], bound: "p8", canRegister: false }, "/register");
    expect(await screen.findByText(/Registration is not available for this account/)).toBeInTheDocument();
    expect(screen.queryByLabelText("First name")).toBeNull();
    expect(denied.calls.some((c) => c.method === "POST" && c.url.pathname === "/api/patients")).toBe(false);
    cleanup();
    open({ patients: [sarah, other], canRegister: true }, "/");
    expect(await screen.findByRole("button", { name: "Create an account" })).toBeInTheDocument();
  });

  it("shows the server's refusal and does not continue as a new person", async () => {
    const base = patientHandler({ patients: [sarah, other], canRegister: true });
    const view = open({ patients: [sarah, other], canRegister: true }, "/register", (r) => (r.method === "POST" && r.url.pathname === "/api/patients" ? json({ error: "This account may not register patients" }, 403) : base(r)));
    fill("First name", "Lena");
    fill("Last name", "Fischer");
    fill("Date of birth", "1991-03-14");
    clickContinue();
    fill("Mobile number", "+1 555 0123");
    clickContinue();
    fireEvent.click(await screen.findByRole("switch", { name: "I have no known allergies" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("This account may not register patients")).toBeInTheDocument();
    expect(view.host.navigate).not.toHaveBeenCalled();
  });
});

describe("dates follow the host preference", () => {
  it("writes a chosen date of birth in the effective date format, whatever the browser shows in the field", async () => {
    const harness = makeHost(patientHandler({ patients: [sarah, other], canRegister: true }), { path: "/register", preferences: { dateFormat: "dmy" }, scope: { roles: ["teleconsult-patient"] } });
    render(<ReferenceTeleconsultPatientModule path="/register" host={harness.host} />);
    fireEvent.change(await screen.findByLabelText("Date of birth"), { target: { value: "1991-03-04" } });
    expect(document.querySelector("[data-date-preview]")?.textContent).toBe("04/03/1991");
    cleanup();
    const medium = makeHost(patientHandler({ patients: [sarah, other], canRegister: true }), { path: "/register", preferences: { dateFormat: "medium" }, scope: { roles: ["teleconsult-patient"] } });
    render(<ReferenceTeleconsultPatientModule path="/register" host={medium.host} />);
    fireEvent.change(await screen.findByLabelText("Date of birth"), { target: { value: "1991-03-04" } });
    expect(document.querySelector("[data-date-preview]")?.textContent).toBe("04 Mar 1991");
  });
});

describe("visit summary print", () => {
  const summaryServer: PatientServer = { patients: [sarah], bound: "p8" };
  const summary = () => json({
    appointment: appointment({ status: "completed" }),
    clinician: staff(),
    encounter: encounter({
      status: "signed", patientInstructions: "Drink water and rest.",
      diagnoses: [{ code: "N30.0", display: "Acute cystitis, unspecified (demo)", type: "primary", certainty: "provisional", addToProblemList: false }],
      prescriptions: [{ id: "rx1", drugId: "nit", name: "Nitrofurantoin", strength: "100 mg", form: "capsule", dose: "1 capsule", route: "oral", frequency: "Twice daily", durationDays: 5, quantity: 10, refills: 0, instructions: "", prn: false }],
      orders: [{ id: "o1", kind: "referral", code: "REF-ED", name: "Emergency department", priority: "stat", notes: "", orderedBy: "d1", orderedByRole: "doctor", status: "pending" }],
      followUp: { inDays: 7, mode: "video", note: "" }, sickNoteDays: 2,
    }),
  });

  it("uses the shared print surface: the summary is a plain document outside the phone column, and the button opens the browser print dialog", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const base = patientHandler(summaryServer);
    const view = open(summaryServer, "/visit/a1/summary", (r) => (r.url.pathname === "/api/appointments/a1/summary" ? summary() : base(r)));
    fireEvent.click(await screen.findByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    const doc = document.body.querySelector(":scope > .ops-print-document") as HTMLElement;
    expect(doc).not.toBeNull();
    expect(view.container.contains(doc)).toBe(false);
    expect(doc.querySelector(".tc-phone")).toBeNull();
    expect(within(doc).getByRole("heading", { level: 1, name: "Visit summary", hidden: true })).toBeInTheDocument();
    for (const text of [/Signed by Dr\. Meera Iyer/, "Drink water and rest.", /Nitrofurantoin 100 mg: 1 capsule, twice daily for 5 days/, /Acute cystitis/, "Go to the emergency department today", /follow-up in 7 days/, /stay off work for 2 days/]) expect(within(doc).getByText(text)).toBeInTheDocument();
    // The paper copy is the browser's print of a demo page: it must not read as a clinical document or a PDF service.
    expect(within(doc).getByText(/not a clinical document, a prescription or medical advice/)).toBeInTheDocument();
    expect(doc.querySelector("button, nav, [class*='teleconsult']")).toBeNull();
    // The print surface formats its date and time through the same preference formatter as the screen.
    expect(within(doc).getByText(/Dr\. Meera Iyer · .*2026-10-01.*/)).toBeInTheDocument();
  });

  it("prints nothing before the summary is signed", async () => {
    const base = patientHandler(summaryServer);
    open(summaryServer, "/visit/a1/summary", (r) => (r.url.pathname === "/api/appointments/a1/summary" ? json({ error: "Not signed yet" }, 404) : base(r)));
    await screen.findByText("Your doctor is writing up your visit");
    expect(document.body.querySelector(".ops-print-document")).toBeNull();
    expect(screen.queryByRole("button", { name: "Print or save as PDF" })).toBeNull();
  });
});

describe("phone column layout", () => {
  it("keeps the bottom navigation in the phone column but outside the scroller, so it does not scroll away", async () => {
    const view = open({ patients: [sarah], bound: "p8" }, "/home");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    const phone = view.container.querySelector(".tc-phone") as HTMLElement;
    const scroller = phone.querySelector(":scope > .tc-phone-scroll") as HTMLElement;
    expect(scroller).not.toBeNull();
    expect(phone.contains(nav)).toBe(true);
    // The phone (transform context) never scrolls itself; the scroller inside it carries the page.
    expect(phone.className).not.toMatch(/overflow-y-auto/);
    expect(view.container.querySelector(".teleconsult-patient")?.contains(phone)).toBe(true);
  });
});
