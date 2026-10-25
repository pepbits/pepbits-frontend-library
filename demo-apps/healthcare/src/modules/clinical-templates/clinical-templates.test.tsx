import {readFileSync} from "node:fs";
import React from "react";
import {screen, fireEvent, waitFor, within, } from "@testing-library/react";
import {render} from "../../test/render";
import { test, expect, vi } from "vitest";
const metadataFixture = JSON.parse(readFileSync(process.cwd() + "/../../mock-api/config/clinical-templates/metadata.json", "utf8"));
const patientFixtures = JSON.parse(readFileSync(process.cwd() + "/../../mock-api/config/clinical-templates/patients.json", "utf8"));
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {createFormatters} from '@pepbits/i18n';
import {type PatientMetadata, type PatientRecord} from '../../domain/clinical-templates';
import {ClinicalRequestFailure, createClinicalTemplateAdapter, type ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
import { PatientRecordTemplate } from "./patient-record";
import { ClinicalPatientWorkspace } from "./workspace";
const metadata = { ...metadataFixture, canWrite: true } as PatientMetadata;
const fixture = patientFixtures[0] as PatientRecord;
function adapter(): ClinicalTemplateAdapter {
  return {
    eligibility: vi.fn(),
    metadata: vi.fn().mockResolvedValue(metadata),
    load: vi.fn().mockResolvedValue(structuredClone(fixture)),
    newRecord: vi.fn().mockResolvedValue(structuredClone(fixture)),
    save: vi.fn().mockImplementation(async (r) => ({
      ...r.record,
      version: r.expectedVersion + 1,
    })),
    search: vi
      .fn()
      .mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 20 }),
    savedSearches: vi.fn().mockResolvedValue([]),
    saveSearch: vi.fn(),
    deleteSearch: vi.fn(),
    exportRows: vi.fn(),
    overview: vi.fn().mockResolvedValue({
      patient: fixture,
      rows: [],
      loadedAt: new Date().toISOString(),
    }),
    schedule: vi.fn(),
  };
}
function page(a: ClinicalTemplateAdapter, canWrite = true) {
  return (
    <PatientRecordTemplate
      adapter={a}
      metadata={{ ...metadata, canWrite }}
      patientId={fixture.id}
      mode="edit"
      preferences={DEFAULT_PREFERENCES}
      format={createFormatters(DEFAULT_PREFERENCES)}
      onOpen={vi.fn()}
    />
  );
}
test("patient form preserves edits through section changes and retries with the same operation", async () => {
  const a = adapter();
  a.save = vi
    .fn()
    .mockRejectedValueOnce(new ClinicalRequestFailure(503))
    .mockImplementation(async (r) => ({ ...r.record, version: 2 }));
  render(page(a));
  fireEvent.click(await screen.findByRole("tab", { name: /Personal/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "First name" }), {
    target: { value: "Retained" },
  });
  fireEvent.click(screen.getByRole("tab", { name: /Contact/ }));
  fireEvent.click(screen.getByRole("tab", { name: /Personal/ }));
  expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue(
    "Retained",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Confirm",
    }),
  );
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Patient record saved.");
  expect(vi.mocked(a.save).mock.calls[0]![0]).toEqual(
    vi.mocked(a.save).mock.calls[1]![0],
  );
});
test("read-only metadata blocks saves and form inputs", async () => {
  render(page(adapter(), false));
  fireEvent.click(await screen.findByRole("tab", { name: /Personal/ }));
  expect(screen.getByRole("textbox", { name: "First name" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});
test("scope remounts cannot retain another user patient edits", async () => {
  const a = adapter(),
    props = {
      adapter: a,
      initialPage: {
        view: "record" as const,
        patientId: fixture.id,
        mode: "edit" as const,
      },
    };
  const r = render(
    <ClinicalPatientWorkspace {...props} scopeKey="tenant/app/user1" />,
  );
  fireEvent.click(await screen.findByRole("tab", { name: /Personal/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "First name" }), {
    target: { value: "Private draft" },
  });
  r.rerender(
    <ClinicalPatientWorkspace {...props} scopeKey="tenant/app/user2" />,
  );
  fireEvent.click(await screen.findByRole("tab", { name: /Personal/ }));
  expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue(
    "Alex",
  );
});
test("late patient load cannot replace a newly selected record", async () => {
  const a = adapter();
  let resolve!: (p: PatientRecord) => void;
  vi.mocked(a.load)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue({
      ...fixture,
      id: "PT-0002",
      values: { ...fixture.values, firstName: "Second" },
    });
  const r = render(page(a));
  r.rerender(
    <PatientRecordTemplate
      adapter={a}
      metadata={metadata}
      patientId="PT-0002"
      mode="edit"
      preferences={DEFAULT_PREFERENCES}
      format={createFormatters(DEFAULT_PREFERENCES)}
      onOpen={vi.fn()}
    />,
  );
  await screen.findByRole("heading", { name: "Second Morgan" });
  resolve(fixture);
  await waitFor(() =>
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument(),
  );
});
test("HTTP adapter sends product context and retains structured validation failures", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ fieldErrors: { email: "template.validation.email" } }),
        { status: 422 },
      ),
    );
  const a = createClinicalTemplateAdapter(request, "tenant-app");
  await expect(
    a.save({
      record: fixture,
      expectedVersion: 1,
      operationId: "same-operation",
    }),
  ).rejects.toMatchObject({
    status: 422,
    fieldErrors: { email: "template.validation.email" },
  });
  expect(request.mock.calls[0]![0]).toBe("/clinical-templates");
  expect(request.mock.calls[0]![1].headers["X-Product-Id"]).toBe("tenant-app");
  expect(JSON.parse(request.mock.calls[0]![1].body).operationId).toBe(
    "same-operation",
  );
});

test("New patient resets a saved record in a reused new-record tab", async () => {
  const a = adapter(),
    initial = { ...structuredClone(fixture), id: "new", mrn: "", version: 0 };
  const empty = {
    ...initial,
    values: { ...initial.values, firstName: "", lastName: "" },
  };
  a.newRecord = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(empty);
  a.save = vi.fn().mockImplementation(async (r) => ({
    ...r.record,
    id: "PT-created",
    mrn: "DEMO-created",
    version: 1,
  }));
  render(React.cloneElement(page(a), { patientId: undefined, mode: "new" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Create patient" }),
  );
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Create patient",
    }),
  );
  await screen.findByText("Patient record saved.");
  fireEvent.click(screen.getByRole("button", { name: "New" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue(""),
  );
  expect(
    screen.queryByRole("heading", { name: "Alex Morgan" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create patient" })).toBeEnabled();
});

test("empty contact editors do not create rows until edited and retain focus while typing", async () => {
  const a = adapter();
  a.load = vi.fn().mockResolvedValue({
    ...structuredClone(fixture),
    collections: { ...fixture.collections, contacts: [] },
  });
  render(page(a));
  const phone = await screen.findByRole("textbox", { name: "Phone" });
  phone.focus();
  fireEvent.change(phone, { target: { value: "5550011" } });
  expect(screen.getByRole("textbox", { name: "Phone" })).toBe(phone);
  expect(phone).toHaveFocus();
  fireEvent.change(screen.getByRole("combobox", { name: "Country code" }), {
    target: { value: "+971" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Confirm",
    }),
  );
  await screen.findByText("Patient record saved.");
  const sent = vi.mocked(a.save).mock.calls[0]![0].record.collections.contacts;
  expect(sent).toHaveLength(1);
  expect(sent![0]).toMatchObject({
    contactType: "mobile",
    countryCode: "+971",
    value: "5550011",
  });
});
