import React from "react";
import {fireEvent,  screen, waitFor} from "@testing-library/react";
import {render} from "../test/render";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AiCredentialStatus } from "@pepbits/ai/config";

const useSession = vi.hoisted(() => vi.fn());
vi.mock("@pepbits/platform", async original => ({...await original<typeof import("@pepbits/platform")>(), useSession}));
const fetchAiConfig = vi.hoisted(() => vi.fn());
const fetchAiUsage = vi.hoisted(() => vi.fn());
const saveAiConfig = vi.hoisted(() => vi.fn());
const setAiCredential = vi.hoisted(() => vi.fn());
const setAiScopedCredential = vi.hoisted(() => vi.fn());
const clearAiCredential = vi.hoisted(() => vi.fn());
const verifyAiCredential = vi.hoisted(() => vi.fn());


vi.mock("./provider", () => ({useAiHost:()=>({canManageAi:useSession().user?.role === "enterprise-admin",client:{
  fetchAiConfig, fetchAiUsage, saveAiConfig,
  setAiCredential, setAiScopedCredential, clearAiCredential, verifyAiCredential,
}})}));

const { AiAdministration } = await import("./administration.tsx");
const { config } = await import("./fixtures.test-support.ts");

/**
 * The administration surface, and the two rules its header states.
 *
 * IT NEVER SHOWS A CREDENTIAL. There is no state holding one after submit, no
 * field populated from the server, and nothing to reveal.
 *
 * THE DISABLED STATE IS NOT THE ENFORCEMENT POINT. The server refuses on the
 * session's role; the greying is a courtesy so a non-admin is not invited to
 * fill a form that will 403 — and the screen says so, because a UI implying it
 * were the gate would be the more dangerous of the two lies.
 */

const SECRET = "provider-key-do-not-log-4f2a";

const credential = (over: Partial<AiCredentialStatus> = {}): AiCredentialStatus => ({
  configured: true,
  hint: "…f2a1",
  fingerprint: "9c1d4e7b",
  setBy: "Prakash Mathew",
  setAt: "2026-01-02T09:00:00.000Z",
  rotatedAt: null,
  lastVerifiedAt: null,
  lastError: null,
  ...over,
} as AiCredentialStatus);

const usage = {
  tenantId: "t1",
  day: "2026-09-06",
  requestsLastMinute: 8,
  requestsPerMinute: 10,
  tokensUsedToday: 90_000,
  tokensPerDay: 100_000,
  limitsAreDefaults: false,
};

const mount = async (over: Parameters<typeof config>[0] = {}) => {
  fetchAiConfig.mockResolvedValue({ ok: true, status: 200, data: config({ credential: credential(), ...over }) });
  const view = render(<AiAdministration />);
  await waitFor(() => expect(screen.getByText("Provider credential")).toBeInTheDocument());
  return view;
};

beforeEach(() => {
  for (const fn of [fetchAiConfig, fetchAiUsage, saveAiConfig, setAiCredential, setAiScopedCredential, clearAiCredential, verifyAiCredential]) fn.mockReset();
  useSession.mockReturnValue({ status:"authenticated", user: { id: "u1", role: "enterprise-admin" } });
  fetchAiUsage.mockResolvedValue({ ok: true, status: 200, data: usage });
  for (const fn of [saveAiConfig, setAiCredential, clearAiCredential]) fn.mockResolvedValue({ ok: true, status: 204 });
  verifyAiCredential.mockResolvedValue({ ok: true, status: 200, data: credential({ lastVerifiedAt: "2026-09-06T00:00:00.000Z" }) });
});

describe("the credential", () => {
  test("is described by its status, never by its value", async () => {
    await mount();
    expect(screen.getByText("…f2a1")).toBeInTheDocument();
    expect(screen.getByText("9c1d4e7b")).toBeInTheDocument();
    expect(screen.getByText("Prakash Mathew")).toBeInTheDocument();
    expect(screen.getByText("configured")).toBeInTheDocument();
  });

  /* No field is populated from the server, and there is no reveal affordance —
     there would be nothing behind it. */
  test("the entry field starts empty and is a password field", async () => {
    await mount();
    const input = screen.getByLabelText(/Replace the key/) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.type).toBe("password");
    expect(screen.queryByRole("button", { name: /show|reveal/i })).toBeNull();
  });

  test("is submitted once and not kept in the page", async () => {
    await mount();
    const input = screen.getByLabelText(/Replace the key/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: SECRET } });
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(setAiCredential).toHaveBeenCalledWith(SECRET));
    /* Cleared whatever happened: a key left in the box is a key sitting in the
       DOM for no reason. */
    await waitFor(() => expect((screen.getByLabelText(/Replace the key/) as HTMLInputElement).value).toBe(""));
    expect(document.body.textContent).not.toContain(SECRET);
  });

  test("a rejected key is cleared too", async () => {
    setAiCredential.mockResolvedValue({ ok: false, status: 400, error: "The provider rejected that key." });
    await mount();
    fireEvent.change(screen.getByLabelText(/Replace the key/), { target: { value: SECRET } });
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(screen.getByText("The provider rejected that key.")).toBeInTheDocument());
    expect((screen.getByLabelText(/Replace the key/) as HTMLInputElement).value).toBe("");
    expect(document.body.textContent).not.toContain(SECRET);
  });

  test("cannot be submitted empty", async () => {
    await mount();
    expect(screen.getByRole("button", { name: "Replace" })).toBeDisabled();
  });

  test("says Set rather than Replace when there is none", async () => {
    await mount({ credential: credential({ configured: false, hint: null }) as never });
    expect(screen.getByRole("button", { name: "Set key" })).toBeInTheDocument();
    expect(screen.getByText("not set")).toBeInTheDocument();
  });

  /* Verify and Remove both reach the provider or the store, so neither is
     offered when there is nothing to reach for. */
  test("cannot be verified or removed when there is none", async () => {
    await mount({ credential: credential({ configured: false }) as never });
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });

  test("verifying asks the service and reports what it found", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(verifyAiCredential).toHaveBeenCalled());
    expect(await screen.findByText("The provider accepted the key.")).toBeInTheDocument();
  });

  test("a key that no longer works says so, in the service's own words", async () => {
    verifyAiCredential.mockResolvedValue({ ok: false, status: 401, error: "The provider rejected the stored key.", detail: "401 from api.example-provider.com" });
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("The provider rejected the stored key.")).toBeInTheDocument();
    expect(screen.getByText("401 from api.example-provider.com")).toBeInTheDocument();
  });

  test("removing says what the assistant falls back to", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(clearAiCredential).toHaveBeenCalled());
    expect(await screen.findByText(/falls back to its echo transport/)).toBeInTheDocument();
  });

  test("a stored key that last failed shows the error", async () => {
    await mount({ credential: credential({ lastError: "401 Unauthorized" }) as never });
    expect(screen.getByText("401 Unauthorized")).toBeInTheDocument();
  });

  test("last rotated and last verified read 'never' rather than blank", async () => {
    await mount();
    expect(screen.getAllByText("never")).toHaveLength(2);
  });
});

describe("who may write", () => {
  /* The greying is a courtesy. The screen says the refusal happens on the
     server, because a UI implying it were the gate would be the worse lie. */
  test("a non-admin is told the server decides, not this screen", async () => {
    useSession.mockReturnValue({ status:"authenticated", user: { id: "u2", role: "operations-manager" } });
    await mount();
    expect(screen.getByText(/Read only for this session/)).toBeInTheDocument();
    expect(screen.getByText(/the refusal happens on the server, not here/)).toBeInTheDocument();
    expect(screen.getByText("operations-manager")).toBeInTheDocument();
  });

  test("and every credential control is greyed for them", async () => {
    useSession.mockReturnValue({ status:"authenticated", user: { id: "u2", role: "operations-manager" } });
    await mount();
    expect(screen.getByLabelText(/Replace the key/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });

  test("an admin is not warned, and can write", async () => {
    await mount();
    expect(screen.queryByText(/Read only for this session/)).toBeNull();
    expect(screen.getByLabelText(/Replace the key/)).toBeEnabled();
  });

  test("an unknown role is named as unknown rather than assumed", async () => {
    useSession.mockReturnValue({ status:"authenticated", user: null });
    await mount();
    expect(screen.getByText("an unknown role")).toBeInTheDocument();
  });
});

describe("the budget meters", () => {
  test("show what has been spent against what is allowed", async () => {
    await mount();
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
    expect(screen.getByText("90,000 / 100,000")).toBeInTheDocument();
  });

  test("say which day the token budget belongs to, and that it is UTC", async () => {
    /* A budget that rolled at local midnight would change meaning with the
       machine's timezone. */
    await mount();
    expect(screen.getByText(/2026-09-06 UTC/)).toBeInTheDocument();
  });

  test("render nothing rather than zeroes when usage is unavailable", async () => {
    fetchAiUsage.mockResolvedValue({ ok: false, status: 503, error: "Usage is unavailable." });
    await mount();
    expect(screen.queryByText(/Requests this minute/)).toBeNull();
  });
});

describe("when the configuration cannot be read", () => {
  test("says why, in the service's own words, rather than rendering an empty form", async () => {
    fetchAiConfig.mockResolvedValue({ ok: false, status: 501, error: "No key vault.", detail: "The secret is plaintext JSON on disk." });
    render(<AiAdministration />);
    expect(await screen.findByText("No key vault.")).toBeInTheDocument();
    expect(screen.getByText("The secret is plaintext JSON on disk.")).toBeInTheDocument();
    expect(screen.queryByText("Provider credential")).toBeNull();
  });
});
