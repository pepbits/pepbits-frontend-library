import {readFileSync} from "node:fs";
import React from "react";
import {screen, fireEvent, waitFor, within, cleanup, } from "@testing-library/react";
import {render} from "../../test/render";
import { test, expect, vi, afterEach } from "vitest";
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {type ClinicBillingView} from '../../domain/clinic-billing';
import type {ClinicBillingAdapter} from '../../adapters/clinic-billing';
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
import { BillingClinicWorkspace } from "./workspace";
const fixtures = JSON.parse(readFileSync(process.cwd() + "/../../dummy-api/config/clinical-templates/patients.json", "utf8"));
afterEach(cleanup);
const view: ClinicBillingView = {
  patient: fixtures[0],
  context: [],
  state: {
    patientId: fixtures[0].id,
    version: 1,
    orders: [],
    invoices: [],
    payments: [],
    history: [],
  },
  services: [
    {
      id: "consultation",
      label: "template.clinic.service.consultation",
      category: "consultation",
      price: 10000,
      taxBps: 0,
      coverageBps: 8000,
    },
  ],
  currency: "AED",
  canWrite: true,
};
const patients = {
  search: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
} as unknown as ClinicalTemplateAdapter;
const props = (adapter: ClinicBillingAdapter) => ({
  adapter,
  patients,
  scopeKey: "tenant-app-user",
  patientId: view.patient.id,
  preferences: DEFAULT_PREFERENCES,
});
test("managed layouts update without losing input; failed requests retry the exact operation", async () => {
  const mutate = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network failed"))
      .mockResolvedValue({ ...view, state: { ...view.state, version: 2 } }),
    adapter = { load: vi.fn().mockResolvedValue(view), mutate };
  const rendered = render(<BillingClinicWorkspace {...props(adapter)} />);
  await screen.findByRole("textbox", { name: "Ordering doctor" });
  fireEvent.change(screen.getByRole("textbox", { name: "Ordering doctor" }), {
    target: { value: "Doctor Example" },
  });
  rendered.rerender(
    <BillingClinicWorkspace
      {...props(adapter)}
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
  expect(screen.getByRole("textbox", { name: "Ordering doctor" })).toHaveValue(
    "Doctor Example",
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Service / item" }), {
    target: { value: "consultation" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add service order" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }),
  );
  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("textbox", { name: "Ordering doctor" })).toHaveValue(
    "Doctor Example",
  );
  expect(
    screen.getByRole("textbox", { name: "Ordering doctor" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
  expect(mutate.mock.calls[0]![0]).toEqual(mutate.mock.calls[1]![0]);
});
test("read-only API access disables financial writes", async () => {
  const adapter = {
    load: vi.fn().mockResolvedValue({ ...view, canWrite: false }),
    mutate: vi.fn(),
  };
  render(<BillingClinicWorkspace {...props(adapter)} />);
  await screen.findByRole("textbox", { name: "Ordering doctor" });
  expect(
    screen.getByRole("textbox", { name: "Ordering doctor" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Add service order" }),
  ).toBeDisabled();
  expect(adapter.mutate).not.toHaveBeenCalled();
});

test("cashier money and exports retain cents when general number preferences use whole units", async () => {
  const { createClinicFormatters } = await import("./format");
  const format = createClinicFormatters(
    { ...DEFAULT_PREFERENCES, decimalPlaces: 0, currencyCode: "USD" },
    "AED",
  );
  expect(format.money(76.5)).toContain("76.50");
  expect(
    format.cell({ type: "money" }, 76.5),
  ).toContain("76.50");
  expect(format.money(76.5)).toContain("AED");
  expect(format.number(1)).toBe("1");
});

test("bill correction retains input and operation identity on failure; read-only view can return", async () => {
  const billed: ClinicBillingView = {
    ...view,
    state: {
      ...view.state,
      orders: [
        {
          id: "o",
          invoiceId: "i",
          label: "template.clinic.service.consultation",
          detail: "",
          doctor: "Demo",
          date: "2026-09-10",
          serviceId: "consultation",
          quantity: 1,
          status: "billed",
        },
      ],
      invoices: [
        {
          id: "i",
          at: "2026-09-10",
          actor: "Demo",
          status: "issued",
          discountBps: 0,
          total: 10000,
          insurance: 0,
          patient: 10000,
          insuranceId: "",
          authorization: "",
          note: "Original",
          lines: [
            {
              orderId: "o",
              label: "template.clinic.service.consultation",
              quantity: 1,
              price: 10000,
              net: 10000,
              tax: 0,
              insurance: 0,
              patient: 10000,
            },
          ],
        },
      ],
    },
  };
  const mutate = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Network failed"))
    .mockImplementation(async (c) => ({
      ...billed,
      state: {
        ...billed.state,
        version: 2,
        invoices: [{ ...billed.state.invoices[0], note: c.note }],
      },
    }));
  render(
    <BillingClinicWorkspace
      {...props({ load: vi.fn().mockResolvedValue(billed), mutate })}
    />,
  );
  fireEvent.click(await screen.findByRole("tab", { name: /Invoices & payments$/ }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Edit bill" }),
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Billing notes" }),
    { target: { value: "Keep this correction" } },
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: /Reason for correction/ }),
    { target: { value: "Demo correction" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save bill changes" }),
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Confirm",
    }),
  );
  await screen.findByRole("button", { name: /Retry/ });
  expect(
    screen.getByRole("textbox", { name: "Billing notes" }),
  ).toHaveValue("Keep this correction");
  fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
  expect(mutate.mock.calls[0]![0]).toEqual(mutate.mock.calls[1]![0]);
  await screen.findByRole("heading", {
    name: "View bill",
    level: 2,
  });
  cleanup();
  render(
    <BillingClinicWorkspace
      {...props({
        load: vi.fn().mockResolvedValue({ ...billed, canWrite: false }),
        mutate,
      })}
    />,
  );
  fireEvent.click(await screen.findByRole("tab", { name: /Invoices & payments$/ }));
  fireEvent.click(
    await screen.findByRole("button", { name: "View bill" }),
  );
  expect(
    screen.getByRole("button", { name: "Edit bill" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Back to billing" }),
  ).not.toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Back to billing" }),
  );
  expect(
    await screen.findByRole("button", { name: "View bill" }),
  ).toBeInTheDocument();
});

test("external patient navigation loads only its patient and resets when the target changes", async () => {
  const load = vi.fn(async (id: string) => ({ ...view, patient: { ...view.patient, id }, state: { ...view.state, patientId: id } }));
  const search = vi.fn();
  const props = { adapter: { load, mutate: vi.fn() } as ClinicBillingAdapter, patients: { search } as unknown as ClinicalTemplateAdapter, scopeKey: "tenant/app/user", preferences: DEFAULT_PREFERENCES, patientSelection: "external" as const };
  const ui = render(<BillingClinicWorkspace {...props} patientId="first" />);
  await waitFor(() => expect(load).toHaveBeenCalledWith("first"));
  expect(screen.queryByRole("combobox", { name: "Select patient" })).toBeNull();
  expect(search).not.toHaveBeenCalled();
  ui.rerender(<BillingClinicWorkspace {...props} patientId="second" />);
  await waitFor(() => expect(load).toHaveBeenCalledWith("second"));
  ui.rerender(<BillingClinicWorkspace {...props} />);
  expect(screen.getByText("Search and select a patient to begin billing.")).toBeTruthy();
});
