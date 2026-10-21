import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DRAFT_KEY, type StepId } from "./registration";
import { RegistrationWizard } from "./RegistrationWizard";
import { completeData, fakeHost } from "./test-support/fake-host";
import type { RegistrationData, RegistrationHost } from "./types";

beforeEach(() => {
  window.localStorage.clear();
  window.scrollTo = vi.fn() as never;
});
afterEach(() => {
  window.localStorage.clear();
});

function seedDraft(data: RegistrationData, stepId: StepId = "review", key = DEFAULT_DRAFT_KEY) {
  const steps: StepId[] = ["organisation", "details", "facilities", "scope", "workspace", "review"];
  window.localStorage.setItem(key, JSON.stringify({ data, stepId, completed: steps, reached: steps, savedAt: Date.now() }));
}

function renderWizard(host: RegistrationHost = fakeHost(), props: Partial<Parameters<typeof RegistrationWizard>[0]> = {}) {
  const user = userEvent.setup({ applyAccept: false });
  const view = render(<RegistrationWizard host={host} resendDelaySeconds={0} {...props} />);
  return { user, host, ...view };
}

const continueButton = () => screen.getByRole("button", { name: "Continue" });
const heading = (name: string | RegExp) => screen.findByRole("heading", { level: 1, name });

/** Waits until the review step has its host lists and shows the chosen plan. */
async function reviewReady(plan = "Basic, 100 per month") {
  await heading("Review and submit");
  await screen.findByText(plan);
}

async function enterCode(user: ReturnType<typeof userEvent.setup>, code = "123456") {
  const group = await screen.findByRole("group", { name: "Verification code" });
  await waitFor(() => expect(within(group).getAllByRole("textbox")[0]).not.toBeDisabled());
  await user.click(within(group).getAllByRole("textbox")[0]!);
  await user.paste(code);
}

describe("RegistrationWizard", () => {
  it("renders inside a scoped root and uses the host brand, not a hard-coded one", async () => {
    const { container } = renderWizard();
    expect(container.firstElementChild).toHaveClass("pb-registration");
    expect(screen.getAllByText("Example Health").length).toBeGreaterThan(0);
    expect(screen.queryByText(/orvia/i)).toBeNull();
    expect(await screen.findByRole("button", { name: /Hospital/ })).toBeInTheDocument();
  });

  it("shows the host's optional header link, and nothing when the host gives none", async () => {
    const host = fakeHost();
    const { unmount } = renderWizard({ ...host, brand: { ...host.brand, secondaryLink: { label: "Check your registration", href: "/start/status" } } });
    expect(await screen.findByRole("link", { name: "Check your registration" })).toHaveAttribute("href", "/start/status");
    unmount();
    renderWizard();
    expect(screen.queryByRole("link", { name: "Check your registration" })).toBeNull();
  });

  it("requires a structure and facility type and focuses the first invalid control", async () => {
    const { user } = renderWizard();
    await screen.findByRole("button", { name: /Hospital/ });
    await user.click(continueButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("2 items need your attention");
    await waitFor(() => expect(document.activeElement).toHaveAttribute("id", "structure"));
    await user.click(screen.getByRole("radio", { name: /Single facility/ }));
    await user.click(screen.getByRole("button", { name: /Hospital/ }));
    await user.click(continueButton());
    await heading("Organisation details");
  });

  it("applies the host prefill and shows licensed beds for a single hospital", async () => {
    const { user } = renderWizard(fakeHost(), { initial: { structure: "SINGLE", facilityTypes: ["HOSPITAL", "UNKNOWN"] } });
    await screen.findByRole("button", { name: /Hospital/, pressed: true });
    await user.click(continueButton());
    await heading("Organisation details");
    expect(screen.getByLabelText(/Licensed beds/)).toBeInTheDocument();
  });

  it("offers only the country's time zones, auto-selects a single one and clears it when the country changes", async () => {
    const host = fakeHost();
    const { user } = renderWizard(host, { initial: { structure: "SINGLE", facilityTypes: ["CLINIC"] } });
    await screen.findByRole("button", { name: /Clinic/, pressed: true });
    await user.click(continueButton());
    await heading("Organisation details");
    const country = await screen.findByLabelText(/Country/);
    await waitFor(() => expect(country).not.toBeDisabled());
    const tz = () => screen.getByLabelText(/Time zone/) as HTMLSelectElement;
    const currency = () => screen.getByLabelText(/Billing currency/) as HTMLSelectElement;

    await user.selectOptions(country, "AE");
    await waitFor(() => expect(tz().value).toBe("Asia/Dubai"));
    expect(currency().value).toBe("AED"); // the primary entry
    expect(Array.from(tz().options).map((o) => o.value).filter(Boolean)).toEqual(["Asia/Dubai"]);

    await user.selectOptions(country, "US");
    await waitFor(() => expect(Array.from(tz().options).map((o) => o.value).filter(Boolean)).toEqual(["America/New_York", "America/Los_Angeles"]));
    expect(tz().value).toBe("");
    expect(currency().value).toBe("USD");
    expect(host.lists.timeZones).toHaveBeenCalledWith("US");

    // Singapore: no states, so the state field is not required or shown
    await user.selectOptions(country, "SG");
    await waitFor(() => expect(tz().value).toBe("Asia/Singapore"));
    expect(screen.queryByLabelText(/State or province/)).toBeNull();
  });

  it("shows a failed list with a retry without blocking the rest of the step", async () => {
    let fail = true;
    const host = fakeHost();
    host.lists.facilityTypes = vi.fn(async () => {
      if (fail) throw new Error("down");
      return [{ code: "CLINIC", name: "Clinic" }];
    });
    const { user } = renderWizard(host);
    expect(await screen.findByText(/couldn't load facility types/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Multi-facility network/ })).toBeEnabled();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /^Clinic/ })).toBeInTheDocument();
  });

  it("starts a network with the head office and enforces 2 to 50 facilities", async () => {
    const data = completeData({ structure: "NETWORK", facilityTypes: ["HOSPITAL", "CLINIC"] });
    seedDraft(data, "details");
    const { user } = renderWizard();
    await heading("Organisation details");
    await waitFor(() => expect((screen.getByLabelText(/Time zone/) as HTMLSelectElement).value).toBe("Asia/Dubai"));
    await user.click(continueButton());
    await heading("Facilities");
    expect(screen.getByLabelText("Facility 1 name")).toHaveValue("Example Care");
    expect(screen.getByText(/started your list with your head office/)).toBeInTheDocument();
    // Second row defaults to the second facility type; the head office is a hospital and needs beds
    await user.click(continueButton());
    expect(await screen.findByText("Enter beds")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Facility 1 beds"), "80");
    await user.type(screen.getByLabelText("Facility 2 name"), "North Clinic");
    await user.click(screen.getByRole("button", { name: "Remove North Clinic" }));
    await user.click(continueButton());
    expect(await screen.findByText(/Add at least two facilities/)).toBeInTheDocument();
    for (let i = 0; i < 48; i += 1) fireEvent.click(screen.getByRole("button", { name: "Add facility" }));
    fireEvent.click(screen.getByRole("button", { name: "Add facility" }));
    expect(screen.getByRole("button", { name: "Add facility" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(50);
  }, 30000);

  it("treats care settings as optional and pre-selects only from the host mapping", async () => {
    seedDraft(completeData({ careSettings: [] }), "scope");
    const { user, unmount } = renderWizard();
    await heading("Clinical scope");
    await screen.findByRole("button", { name: /Outpatient/ });
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    await user.click(continueButton());
    await heading("Workspace and administrator");
    unmount();

    window.localStorage.clear();
    seedDraft(completeData({ careSettings: [] }), "details");
    const host = fakeHost({ recommendedCareSettings: () => ["IPD", "NOT_A_SETTING"] });
    const second = renderWizard(host);
    await heading("Organisation details");
    await screen.findByText("Testland East");
    await waitFor(() => expect((screen.getByLabelText(/Time zone/) as HTMLSelectElement).value).toBe("Asia/Dubai"));
    await second.user.click(continueButton());
    await heading("Clinical scope");
    expect(await screen.findByRole("button", { name: /Inpatient/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Outpatient/, pressed: false })).toBeInTheDocument();
  });

  it("requires a plan, and the workspace step has no password, MFA, region or modules", async () => {
    seedDraft(completeData({ workspace: { slug: "", offerId: "" } }), "scope");
    const { user } = renderWizard();
    await heading("Clinical scope");
    await user.click(continueButton());
    await heading("Workspace and administrator");
    await screen.findByRole("radio", { name: /Basic/ });
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByText(/second sign-in step/i)).toBeNull();
    expect(screen.queryByText(/data residency/i)).toBeNull();
    expect(screen.queryByText(/modules/i)).toBeNull();
    expect(screen.queryByText(/EMRAM/i)).toBeNull();
    expect(screen.getByLabelText(/Workspace address/)).toHaveValue("example-care");
    await user.click(continueButton());
    expect(await screen.findByText("Choose a plan")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Licensed/ }));
    await user.click(continueButton());
    await heading("Review and submit");
  });

  it("requires the plan terms, BAA and DPA before submitting", async () => {
    seedDraft(completeData({ agreements: { ...completeData().agreements, terms: false, baa: false, dpa: false } }));
    const host = fakeHost();
    const { user } = renderWizard(host);
    await reviewReady();
    expect(screen.getByText(/version T-1/)).toBeInTheDocument();
    expect(screen.getByText("Basic plan terms.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    expect(await screen.findByText("Accept the plan terms to continue")).toBeInTheDocument();
    expect(screen.getByText("Accept the business associate agreement to continue")).toBeInTheDocument();
    expect(screen.getByText("Accept the data processing agreement to continue")).toBeInTheDocument();
    expect(host.requestCode).not.toHaveBeenCalled();
  });

  it("verifies the administrator email with a 6-digit code, then submits the payload", async () => {
    seedDraft(completeData());
    const host = fakeHost();
    const { user } = renderWizard(host);
    await reviewReady();
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    await heading("Confirm your email");
    await waitFor(() => expect(host.requestCode).toHaveBeenCalledWith("alex@example.test"));
    expect(host.requestCode).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/We sent a 6-digit code to/)).toBeInTheDocument();
    await enterCode(user);
    await waitFor(() => expect(host.verifyCode).toHaveBeenCalledWith("alex@example.test", "123456"));
    await heading("Registration submitted");
    expect(screen.getByText("REG-0001")).toBeInTheDocument();
    expect(screen.getByText("We will review your licence.")).toBeInTheDocument();
    expect(host.uploadDocument).not.toHaveBeenCalled();

    const payload = host.submit.mock.calls[0]![0] as RegistrationData;
    expect(Object.keys(payload).sort()).toEqual(Object.keys(completeData()).sort());
    expect(payload.structure).toBe("SINGLE");
    expect(payload.facilityTypes).toEqual(["HOSPITAL"]);
    expect(payload.profile.beds).toBe("120");
    expect(payload.facilities).toEqual([]);
    expect(payload.workspace).toEqual({ slug: "example-care", offerId: "ae-basic" });
    expect(payload.administrator).toEqual({ fullName: "Alex Example", role: "CEO", email: "alex@example.test", mobile: "50 123 4567" });
    expect(payload.agreements).toMatchObject({ termsVersion: "T-1", baaVersion: "BAA-3", dpaVersion: "DPA-5" });
    expect(JSON.stringify(payload)).not.toContain("123456");
    // The draft is cleared after a successful submit
    expect(window.localStorage.getItem(DEFAULT_DRAFT_KEY)).toBeNull();
  });

  it("allows resending the code only after the countdown", async () => {
    seedDraft(completeData());
    const host = fakeHost();
    const { user } = render2(host, 2);
    await reviewReady();
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    await heading("Confirm your email");
    expect(await screen.findByRole("button", { name: /Resend code in/ })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled(), { timeout: 4000 });
    await user.click(screen.getByRole("button", { name: "Resend code" }));
    await waitFor(() => expect(host.requestCode).toHaveBeenCalledTimes(2));
  });

  it("shows the code error from the host and never stores the code in the draft", async () => {
    seedDraft(completeData());
    const host = fakeHost({ verifyCode: vi.fn(async () => Promise.reject({ message: "That code has expired.", code: "CODE_EXPIRED" })) });
    const { user } = renderWizard(host);
    await reviewReady();
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    await heading("Confirm your email");
    await enterCode(user, "654321");
    expect(await screen.findByText("That code has expired.")).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800));
    });
    const stored = window.localStorage.getItem(DEFAULT_DRAFT_KEY) ?? "";
    expect(stored).toContain("Example Care LLC");
    expect(stored).not.toContain("654321");
    for (const key of Object.keys(window.localStorage)) expect(window.localStorage.getItem(key)).not.toContain("654321");
    expect(host.submit).not.toHaveBeenCalled();
  });

  it("asks for the offer's documents and rejects oversized or wrong-type files", async () => {
    seedDraft(completeData({ workspace: { slug: "example-care", offerId: "ae-licensed" } }));
    const host = fakeHost({ documentTypeLabel: (t) => (t === "OPERATING_LICENCE" ? "Operating licence" : "Trade licence") });
    const { user } = renderWizard(host);
    await reviewReady("Licensed, 200 per month");
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    await heading("Confirm your email");
    await enterCode(user);
    await heading("Upload documents");

    const submit = screen.getByRole("button", { name: "Submit registration" });
    expect(submit).toBeDisabled();
    const operating = screen.getByLabelText("Operating licence");
    const trade = screen.getByLabelText("Trade licence");

    await user.upload(operating, new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(/larger than 2 MB/)).toBeInTheDocument();
    await user.upload(trade, new File(["x"], "notes.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    expect(await screen.findByText(/Upload a PDF, PNG or JPEG file/)).toBeInTheDocument();
    expect(host.uploadDocument).not.toHaveBeenCalled();

    const pdf = new File(["%PDF"], "licence.pdf", { type: "application/pdf" });
    const png = new File(["png"], "trade.png", { type: "image/png" });
    await user.upload(operating, pdf);
    await user.upload(trade, png);
    await waitFor(() => expect(host.uploadDocument).toHaveBeenCalledTimes(2));
    expect(host.uploadDocument).toHaveBeenCalledWith("OPERATING_LICENCE", pdf);
    expect(host.uploadDocument).toHaveBeenCalledWith("TRADE_LICENCE", png);
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await heading("Registration submitted");
    expect(host.submit).toHaveBeenCalledTimes(1);
  });

  it("puts a host field error next to its field on the right step", async () => {
    seedDraft(completeData());
    const host = fakeHost({
      submit: vi.fn(async () => Promise.reject({ message: "That address is already taken.", code: "SLUG_TAKEN", field: "form.slug" })),
    });
    const { user } = renderWizard(host);
    await reviewReady();
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    await enterCode(user);
    await heading("Workspace and administrator");
    const slug = screen.getByLabelText(/Workspace address/);
    expect(slug).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("That address is already taken.")).toHaveAttribute("id", "workspace.slug-error");
    // The error stays until the value changes, then the next submit skips the verified code
    await user.clear(slug);
    await user.type(slug, "example-care-2");
    expect(screen.queryByText("That address is already taken.")).toBeNull();
  });

  it("maps a host time-zone error to the details step", async () => {
    seedDraft(completeData());
    const host = fakeHost({
      submit: vi.fn(async () => Promise.reject(Object.assign(new Error("Time zone not allowed."), { field: "profile.timeZone" }))),
    });
    const { user } = renderWizard(host);
    await reviewReady();
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    await enterCode(user);
    await heading("Organisation details");
    expect(screen.getByLabelText(/Time zone/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Time zone not allowed.")).toBeInTheDocument();
  });

  it("shows a host error without a field in the alert banner", async () => {
    seedDraft(completeData());
    const host = fakeHost({ submit: vi.fn(async () => Promise.reject(new Error("Registration is closed today."))) });
    const { user } = renderWizard(host);
    await reviewReady();
    await user.click(screen.getByRole("button", { name: "Submit registration" }));
    await enterCode(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Registration is closed today.");
    await heading("Review and submit");
  });

  it("autosaves form fields under the host draft key", async () => {
    const host = fakeHost({ draftKey: "test.draft" });
    const { user } = renderWizard(host);
    await user.click(await screen.findByRole("radio", { name: /Multi-facility network/ }));
    await waitFor(() => expect(window.localStorage.getItem("test.draft")).toContain('"structure":"NETWORK"'), { timeout: 2000 });
    expect(window.localStorage.getItem(DEFAULT_DRAFT_KEY)).toBeNull();
  });
});

function render2(host: RegistrationHost, resendDelaySeconds: number) {
  const user = userEvent.setup({ applyAccept: false });
  const view = render(<RegistrationWizard host={host} resendDelaySeconds={resendDelaySeconds} />);
  return { user, ...view };
}
