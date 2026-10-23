import {readFileSync} from "node:fs";
import React from "react";
import {screen, fireEvent, waitFor, cleanup, within, } from "@testing-library/react";
import {render} from "../../test/render";
import { test, expect, vi, afterEach } from "vitest";
import {blankComprehensive, type ComprehensiveValues, type ComprehensiveConfiguration} from '../../domain/comprehensive-consultation';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {type ClinicalDocumentView} from '../../domain/clinical-document';
import { ComprehensiveConsultationWorkspace } from "./workspace";
const config = JSON.parse(readFileSync(process.cwd() + "/../../dummy-api/config/comprehensive-consultation/form.json", "utf8"));
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
import type {ClinicalTriageAdapter} from '../../adapters/clinical-triage';
type ConsultationView = ClinicalDocumentView<
  ComprehensiveValues,
  ComprehensiveConfiguration
>;
afterEach(cleanup);
test("specialty edits survive context and tenant-locked layout changes; preview never saves", async () => {
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
      values: blankComprehensive(),
      updatedAt: "",
      actor: "",
      history: [],
    },
    config: { ...config, services: [] } as ConsultationView["config"],
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
  const ui = render(<ComprehensiveConsultationWorkspace {...props} />);
  await screen.findByRole("combobox", { name: "Specialty template" });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Specialty template" }),
    { target: { value: "cardiology" } },
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Cardiac history and findings" }),
    { target: { value: "Retained specialty assessment" } },
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Specialty template" }),
    { target: { value: "general" } },
  );
  ui.rerender(
    <ComprehensiveConsultationWorkspace
      {...props}
      preferencePolicy={{
        revision: 1,
        rules: { formNavigation: { locked: true, value: "tabs" } },
      }}
    />,
  );
  expect(ui.container.querySelector('[data-layout="tabs"]')).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Review consultation" }));
  expect(
    within(await screen.findByRole("dialog")).getByText(
      "Retained specialty assessment",
    ),
  ).toBeTruthy();
  expect(adapter.save).not.toHaveBeenCalled();
});
