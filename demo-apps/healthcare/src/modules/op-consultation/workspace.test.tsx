import {readFileSync} from "node:fs";
import React from "react";
import {screen, fireEvent, waitFor, cleanup, within, } from "@testing-library/react";
import {render} from "../../test/render";
import { test, expect, vi, afterEach } from "vitest";
import {blankConsultation, type ConsultationView} from '../../domain/clinical-consultation';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import { OPConsultationWorkspace } from "./workspace";
const config = JSON.parse(readFileSync(process.cwd() + "/../../dummy-api/config/clinical-consultation/form.json", "utf8"));
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
import type {ClinicalTriageAdapter} from '../../adapters/clinical-triage';
afterEach(cleanup);
test("OP summary navigates fields; locked layout and review retain unsaved values", async () => {
  const patient = {
    id: "p",
    mrn: "DEMO",
    internalCode: "DEMO",
    version: 1,
    activity: [],
    values: { firstName: "Fictional", lastName: "Patient" },
    collections: {},
  } as ConsultationView["patient"];
  const view: ConsultationView = {
    patient,
    encounters: [],
    assessments: [],
    blank: {
      id: "new",
      patientId: "p",
      encounterId: "",
      version: 0,
      status: "draft",
      values: blankConsultation(),
      updatedAt: "",
      actor: "",
      history: [],
    },
    config: config as ConsultationView["config"],
    canWrite: true,
  };
  const adapter = { load: vi.fn().mockResolvedValue(view), save: vi.fn() };
  const props = {
    patientId: "p",
    scopeKey: "tenant-app-user",
    preferences: DEFAULT_PREFERENCES,
    adapter,
    patients: {
      search: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as ClinicalTemplateAdapter,
    triage: {
      load: vi.fn().mockResolvedValue({ assessments: [] }),
    } as unknown as ClinicalTriageAdapter,
  };
  const ui = render(<OPConsultationWorkspace {...props} />);
  await screen.findByRole("textbox", { name: /Chief complaint/ });
  fireEvent.click(screen.getByRole("button", { name: /Clinical assessment/ }));
  fireEvent.change(
    screen.getByRole("textbox", { name: /Clinical assessment/ }),
    { target: { value: "Authored OP assessment" } },
  );
  ui.rerender(
    <OPConsultationWorkspace
      {...props}
      preferencePolicy={{
        revision: 1,
        rules: { formNavigation: { locked: true, value: "tabs" } },
      }}
    />,
  );
  expect(ui.container.querySelector('[data-layout="tabs"]')).toBeTruthy();
  expect(
    screen.getByRole("textbox", { name: /Clinical assessment/ }),
  ).toHaveValue("Authored OP assessment");
  fireEvent.click(screen.getByRole("button", { name: "Review full note" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Authored OP assessment")).toBeTruthy();
  expect(adapter.save).not.toHaveBeenCalled();
});
