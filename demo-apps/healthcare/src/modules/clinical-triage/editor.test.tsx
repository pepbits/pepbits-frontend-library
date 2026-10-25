import {readFileSync} from "node:fs";
import React from "react";
import {screen, fireEvent, waitFor, within, cleanup, } from "@testing-library/react";
import {render} from "../../test/render";
import { test, expect, vi, afterEach } from "vitest";
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {createFormatters} from '@pepbits/i18n';
import {type TriageView, type TriageAssessment} from '../../domain/clinical-triage';
import { ClinicalTriageEditor } from "./editor";
import { ClinicalTriageWorkspace } from "./workspace";
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
const config = JSON.parse(readFileSync(process.cwd() + "/../../mock-api/config/clinical-triage/form.json", "utf8"));
const fixtures = JSON.parse(readFileSync(process.cwd() + "/../../mock-api/config/clinical-templates/patients.json", "utf8"));
afterEach(cleanup);
const record: TriageAssessment = {
  id: "new",
  patientId: fixtures[0].id,
  encounterId: "",
  version: 0,
  status: "draft",
  values: {
    complaint: "",
    onset: "",
    priority: "",
    allergyStatus: "",
    allergies: "",
    precautions: "",
    destination: "",
    handoff: "",
    missingReason: "",
    measuredAt: "2026-09-09T12:00:00Z",
    vitals: {
      systolic: "",
      diastolic: "",
      pulse: "",
      respiratoryRate: "",
      oxygenSaturation: "",
      temperature: "",
      pain: "",
      weight: "",
    },
  },
  actor: "",
  updatedAt: "",
  history: [],
};
const view = {
  patient: fixtures[0],
  encounters: [],
  assessments: [],
  blank: record,
  config,
  canWrite: true,
} as TriageView;
const props = (save = vi.fn()) => ({
  initial: view,
  adapter: { load: vi.fn().mockResolvedValue(view), save },
  preferences: DEFAULT_PREFERENCES,
  format: createFormatters(DEFAULT_PREFERENCES),
  onDirty: vi.fn(),
  onBusy: vi.fn(),
});
test("blank readings and unanswered safety choices; completion focuses required complaint", () => {
  render(<ClinicalTriageEditor {...props()} />);
  fireEvent.click(screen.getByRole("tab", { name: /Vital signs$/ }));
  expect(screen.getByRole("spinbutton", { name: "Pulse (/min)" })).toHaveValue(
    null,
  );
  fireEvent.click(screen.getByRole("tab", { name: /Complaint & safety$/ }));
  expect(
    within(
      screen.getByRole("radiogroup", { name: "Clinician-assigned priority" }),
    )
      .getAllByRole("radio")
      .every((r) => r.getAttribute("aria-checked") === "false"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Complete triage" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getAllByText("Complete this field before finishing triage.").length,
  ).toBeGreaterThan(0);
});
test("recoverable failure retains input and retry uses exactly the same request", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Network failed"))
    .mockImplementation(async (input) => ({
      ...input.assessment,
      id: "TRI-1",
      version: 1,
      updatedAt: "2026-09-09T12:01:00Z",
    }));
  render(<ClinicalTriageEditor {...props(save)} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Chief complaint/ }), {
    target: { value: "Fictional concern" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("textbox", { name: /Chief complaint/ })).toHaveValue(
    "Fictional concern",
  );
  fireEvent.click(await screen.findByRole("button", { name: /Retry/ }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]![0]).toEqual(save.mock.calls[0]![0]);
});
test("managed layouts change without clearing edits; completed assessments stay read only", async () => {
  const adapter = props().adapter,
    patients = {
      search: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as ClinicalTemplateAdapter;
  const all = {
    adapter,
    patients,
    patientId: record.patientId,
    scopeKey: "tenant-app-user",
    preferences: DEFAULT_PREFERENCES,
  };
  const rendered = render(<ClinicalTriageWorkspace {...all} />);
  fireEvent.change(
    await screen.findByRole("textbox", { name: /Chief complaint/ }),
    { target: { value: "Keep my draft" } },
  );
  rendered.rerender(
    <ClinicalTriageWorkspace
      {...all}
      preferencePolicy={{
        revision: 1,
        rules: {
          formNavigation: { locked: true, value: "tabs" },
          density: { locked: true, value: "compact" },
        },
      }}
    />,
  );
  expect(rendered.container.querySelector('[data-layout="tabs"]')).toBeTruthy();
  expect(screen.getByRole("textbox", { name: /Chief complaint/ })).toHaveValue(
    "Keep my draft",
  );
  cleanup();
  render(
    <ClinicalTriageEditor
      {...props()}
      initial={{
        ...view,
        assessments: [
          { ...record, id: "done", status: "completed", version: 2 },
        ],
      }}
    />,
  );
  expect(
    screen.getByRole("textbox", { name: /Chief complaint/ }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Complete triage" }),
  ).toBeDisabled();
});
