import { LocalizationProvider, type Localization } from "@pepbits/ops-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReferenceSchoolModule } from "./index";
import { createFakeBackend, fakeHost, FakeHttpError, type FakeBackend, type FakeBackendOptions } from "./test-support/fake-host.test-support";

afterEach(() => vi.restoreAllMocks());

/* A fictional German catalog keyed by the source English messages, as the root catalogs are. */
const GERMAN: Record<string, string> = {
  "Profile saved": "Profil gespeichert",
  "Save changes": "Änderungen speichern",
  "“{value0}” added to the catalogue": "„{value0}“ zum Katalog hinzugefügt",
  "Message not sent — {value0}": "Nachricht nicht gesendet — {value0}",
};
const localization = (catalog: Record<string, string>): Localization => ({
  language: "de", direction: "ltr", dateTime: String,
  t: (m, values) => (catalog[m] ?? m).replace(/\{(\w+)\}/g, (x, k) => (values?.[k] === undefined ? x : String(values[k]))),
});

async function settle(backend: FakeBackend) {
  await waitFor(() => expect(screen.queryByText("Opening your portal")).toBeNull());
  for (let i = 0; i < 8; i++) { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); if (backend.pending === 0) break; }
}
function mount(path: string, roles: string[], catalog: Record<string, string>, backendOptions: FakeBackendOptions = {}) {
  const backend = createFakeBackend(backendOptions);
  const host = fakeHost(backend, { roles });
  const tree = (c: Record<string, string>): ReactNode => <LocalizationProvider value={localization(c)}><ReferenceSchoolModule path={path} host={host} /></LocalizationProvider>;
  const view = render(<>{tree(catalog)}</>);
  return { backend, relocalize: (c: Record<string, string>) => view.rerender(<>{tree(c)}</>) };
}

describe("localized toasts", () => {
  test("a static success toast is translated at render and follows a language change while shown", async () => {
    const { backend, relocalize } = mount("/settings", ["teacher"], GERMAN);
    await settle(backend);
    fireEvent.click(await screen.findByRole("button", { name: "Änderungen speichern" }));
    expect(await screen.findByText("Profil gespeichert")).toBeInTheDocument();
    relocalize({});
    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(screen.queryByText("Profil gespeichert")).toBeNull();
  });

  test("a dynamic toast is one translated message that keeps the authored title exactly", async () => {
    const { backend } = mount("/library", ["librarian"], GERMAN);
    await settle(backend);
    fireEvent.click(screen.getByRole("button", { name: "Add book" }));
    const d = within(await screen.findByRole("dialog", { name: "Add book to catalogue" }));
    fireEvent.change(d.getByLabelText(/^Title/), { target: { value: "Save changes" } });
    fireEvent.change(d.getByLabelText(/^Author/), { target: { value: "A. Author" } });
    fireEvent.change(d.getByLabelText(/^ISBN/), { target: { value: "978-0-00-000000-1" } });
    fireEvent.click(d.getByRole("button", { name: "Add book" }));
    // The authored title matches a UI message on purpose: it must not be translated inside the sentence.
    expect(await screen.findByText("„Save changes“ zum Katalog hinzugefügt")).toBeInTheDocument();
    const body = backend.creates.find((c) => c.resource === "books")!.body;
    expect(body.title).toBe("Save changes");
  });

  test("server error text stays verbatim, alone or inside a translated message, and the draft is kept", async () => {
    const { backend } = mount("/messages", ["teacher"], GERMAN, {
      intercept: (r) => (r.method === "PATCH" && r.path.startsWith("/threads/") ? new FakeHttpError(503, "Profile saved: relay 42 offline") : undefined),
    });
    await settle(backend);
    const box = screen.getByPlaceholderText(/Write a message/);
    fireEvent.change(box, { target: { value: "Bitte Formular mitbringen" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Nachricht nicht gesendet — Profile saved: relay 42 offline")).toBeInTheDocument();
    expect(box).toHaveValue("Bitte Formular mitbringen");
  });

  test("an unknown server error on its own renders verbatim", async () => {
    const { backend } = mount("/settings", ["teacher"], GERMAN, {
      intercept: (r) => (r.method === "PATCH" && r.path === "/settings" ? new FakeHttpError(500, "Profilspeicher nicht erreichbar (E42)") : undefined),
    });
    await settle(backend);
    fireEvent.click(await screen.findByRole("button", { name: "Änderungen speichern" }));
    expect(await screen.findByText("Profilspeicher nicht erreichbar (E42)")).toBeInTheDocument();
  });
});
