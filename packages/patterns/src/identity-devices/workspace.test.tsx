import {render,TestHost} from '../test';
import React from "react";
import {  screen, fireEvent, waitFor } from "@testing-library/react";
import { test, expect, vi } from "vitest";
import {  type IdentityLibrary } from "@pepbits/data/identity-devices";
import { IdentityDeviceWorkspace } from "./workspace";
const base: IdentityLibrary = {
  ...{"devices": [{"id": "demo-card", "method": "card", "transport": "demo", "title": "identity.card"}, {"id": "demo-eid", "method": "eid", "transport": "demo", "title": "identity.eid"}, {"id": "demo-passport", "method": "passport", "transport": "demo", "title": "identity.passport"}, {"id": "demo-fingerprint", "method": "fingerprint", "transport": "demo", "title": "identity.fingerprint"}, {"id": "demo-face", "method": "face", "transport": "demo", "title": "identity.face"}, {"id": "native-card", "method": "card", "transport": "native", "title": "identity.nativeCard"}, {"id": "native-eid", "method": "eid", "transport": "native", "title": "identity.nativeEid"}, {"id": "native-passport", "method": "passport", "transport": "native", "title": "identity.nativePassport"}, {"id": "native-fingerprint", "method": "fingerprint", "transport": "native", "title": "identity.nativeFingerprint"}, {"id": "native-face", "method": "face", "transport": "native", "title": "identity.nativeFace"}], "policy": {"version": 1, "biometricsEnabled": false, "lockedDevice": ""}, "scenarios": [{"id": "match", "title": "identity.matchScenario"}, {"id": "mismatch", "title": "identity.mismatchScenario"}, {"id": "expired", "title": "identity.expiredScenario"}]},
  subjects: [
    { id: "DEMO-P1", name: "Synthetic subject", birthDate: "1985-03-12" },
  ],
  attempts: [],
  defaultDevice: "demo-card",
  canManage: false,
};
test("biometrics disabled still allows separate manual review and never implies authentication", async () => {
  const command = vi.fn().mockResolvedValue({
    id: "manual",
    status: "manual-review",
    authenticated: false,
    subjectId: "DEMO-P1",
    expiresAt: "2026-09-10",
    createdAt: "2026-09-10",
  });
  render(
    <IdentityDeviceWorkspace
      mode="biometric"
      stationId="demo-station" scopeKey="u"
      adapter={{ library: async () => base, command }}
    />,
  );
  await screen.findByLabelText("Selected subject");
  fireEvent.change(screen.getByLabelText("Selected subject"), {
    target: { value: "DEMO-P1" },
  });
  expect(
    screen.getByRole("button", { name: "Start demo identity request" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Route to manual review" }),
  ).not.toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Route to manual review" }),
  );
  await waitFor(() => expect(command).toHaveBeenCalled());
  await waitFor(()=>{expect(command.mock.calls[0]![0]!).toMatchObject({
    action: "manual",
    subjectId: "DEMO-P1",
  });});
  expect(
    screen.getByText(
      "Demo results never authenticate a subject, grant access or update the subject record.",
    ),
  ).toBeVisible();
});
test("incompatible tenant reader lock is not overridden on passport page", async () => {
  render(
    <IdentityDeviceWorkspace
      mode="passport"
      stationId="demo-station" scopeKey="v"
      adapter={{
        library: async () => ({
          ...base,
          policy: { ...base.policy, lockedDevice: "demo-eid" },
        }),
        command: vi.fn(),
      }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Identity reader / method")).toHaveValue(
      "demo-eid",
    ),
  );
  expect(screen.getByLabelText("Identity reader / method")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Start demo identity request" }),
  ).toBeDisabled();
});
test("active card request keeps its actual device when another reader page opens", async () => {
  const pending = {
    id: "pending",
    subjectId: "DEMO-P1",
    deviceId: "demo-eid",
    stationId: "demo-station",
    status: "pending" as const,
    authenticated: false as const,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120000).toISOString(),
  };
  render(
    <IdentityDeviceWorkspace
      mode="passport"
      stationId="demo-station" scopeKey="cross-page"
      adapter={{
        library: async () => ({ ...base, attempts: [pending] }),
        command: vi.fn(),
      }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Identity reader / method")).toHaveValue(
      "demo-eid",
    ),
  );
  expect(
    screen.getByRole("button", { name: "Simulate reader result" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Cancel request" }),
  ).not.toBeDisabled();
});
