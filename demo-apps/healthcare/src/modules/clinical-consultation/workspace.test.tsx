import {readFileSync} from "node:fs";
import React from "react";
import {screen, fireEvent, waitFor, cleanup, } from "@testing-library/react";
import {render} from "../../test/render";
import { test, expect, vi, afterEach } from "vitest";
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {blankConsultation, type ConsultationView} from '../../domain/clinical-consultation';
import {createFormatters} from '@pepbits/i18n';
import { ClinicalDocumentEditor } from "../clinical-document/editor";
import { consultationDefinition } from "./workspace";
const config = JSON.parse(readFileSync(process.cwd() + "/../../dummy-api/config/clinical-consultation/form.json", "utf8"));
afterEach(cleanup);
const view: ConsultationView = {
  patient: {
    id: "p",
    mrn: "DEMO",
    values: {},
    collections: {},
  } as ConsultationView["patient"],
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
const props = () => ({
  initial: view,
  definition: consultationDefinition,
  adapter: { load: vi.fn().mockResolvedValue(view), save: vi.fn() },
  preferences: DEFAULT_PREFERENCES,
  format: createFormatters(DEFAULT_PREFERENCES),
  onDirty: vi.fn(),
  onBusy: vi.fn(),
});
test("completion requires explicit clinical fields and focuses the first missing field", () => {
  const p = props();
  render(<ClinicalDocumentEditor {...p} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Complete consultation" }),
  );
  expect(p.adapter.save).not.toHaveBeenCalled();
  expect(
    screen.getAllByText("Complete this field before finishing consultation.")
      .length,
  ).toBeGreaterThan(0);
  expect(
    screen.getByRole("textbox", { name: /Clinical assessment/ }),
  ).toHaveValue("");
});
test("failed save retains consultation input and retry identity; layout changes retain input", async () => {
  const p = props();
  p.adapter.save
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(async (input) => ({
      ...input.assessment,
      id: "CON-1",
      version: 1,
      updatedAt: "2026-09-09T12:00:00Z",
    }));
  const ui = render(<ClinicalDocumentEditor {...p} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Chief complaint/ }), {
    target: { value: "Fictional concern" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(p.adapter.save).toHaveBeenCalledTimes(1));
  fireEvent.click(await screen.findByRole("button", { name: /Retry/ }));
  await waitFor(() => expect(p.adapter.save).toHaveBeenCalledTimes(2));
  expect(p.adapter.save.mock.calls[1]![0]).toEqual(
    p.adapter.save.mock.calls[0]![0],
  );
  ui.rerender(
    <ClinicalDocumentEditor
      {...p}
      preferences={{ ...DEFAULT_PREFERENCES, formNavigation: "tabs" }}
    />,
  );
  expect(screen.getByRole("textbox", { name: /Chief complaint/ })).toHaveValue(
    "Fictional concern",
  );
});

test("expanded panels retain values and validation opens a hidden invalid vital", async () => {
  const p = props();
  render(<ClinicalDocumentEditor {...p} />);
  fireEvent.click(screen.getByRole("tab", { name: "Background" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Past medical history" }),
    { target: { value: "Recorded background" } },
  );
  fireEvent.click(screen.getByRole("tab", { name: "Vitals" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "SpO₂ (%)" }), {
    target: { value: "101" },
  });
  fireEvent.click(screen.getByRole("tab", { name: "Visit" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() =>
    expect(screen.getByRole("spinbutton", { name: "SpO₂ (%)" })).toHaveFocus(),
  );
  expect(p.adapter.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: /Background/ }));
  expect(
    screen.getByRole("textbox", { name: "Past medical history" }),
  ).toHaveValue("Recorded background");
});
