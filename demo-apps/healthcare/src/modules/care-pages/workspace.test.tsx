import React from "react";
import {screen, fireEvent, waitFor} from "@testing-library/react";
import {render} from "../../test/render";
import { test, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
import {type CareView, type CareRecord} from '../../domain/care-pages';
import { CareWorkspace } from "./workspace";
const definitions = JSON.parse(
  readFileSync(
    process.cwd() + "/../../mock-api/config/care-pages/pages.json",
    "utf8",
  ),
);
const record: CareRecord = {
  id: "demo-r",
  version: 1,
  patient: {
    id: "p",
    name: "Demo patient",
    dob: "1990-02-12",
    sex: "Female",
    mobile: "",
  },
  values: {},
  status: "draft",
  step: 1,
  bedId: "",
  orders: [],
  events: [],
  notes: [],
  updatedAt: "2026-09-10T12:00:00Z",
};
const view: CareView = {
  definition: definitions[2],
  patients: [record.patient],
  beds: [],
  records: [record],
  record,
};
test("failed saves keep notes and retry the identical operation; selectors cannot discard dirty inputs", async () => {
  const command = vi
    .fn()
    .mockResolvedValueOnce(view)
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce({
      ...view,
      record: { ...record, version: 2, values: { f0_0_0: "Retain this note" } },
    });
  render(
    <CareWorkspace
      pageId="consultation-entry-design"
      scopeKey="a"
      preferences={DEFAULT_PREFERENCES}
      adapter={{ command }}
    />,
  );
  const field = await screen.findByLabelText(/Chief Complaint/i);
  fireEvent.change(field, { target: { value: "Retain this note" } });
  expect(screen.getByLabelText("Restore saved record")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("button", { name: "Retry" });
  expect(field).toHaveValue("Retain this note");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(command).toHaveBeenCalledTimes(3));
  expect(command.mock.calls[1]![0]).toEqual(command.mock.calls[2]![0]);
});
test("effective locked density applies and signed documents are read-only", async () => {
  const signed = { ...view, record: { ...record, status: "signed" as const } };
  const { container } = render(
    <CareWorkspace
      pageId="consultation-entry-design"
      scopeKey="a"
      preferences={{ ...DEFAULT_PREFERENCES, density: "spacious" }}
      preferencePolicy={
        {
          version: 1,
          rules: { density: { locked: true, value: "compact" } },
        } as never
      }
      adapter={{ command: async () => signed }}
    />,
  );
  expect(await screen.findByLabelText(/Chief Complaint/i)).toBeDisabled();
  expect(container.querySelector("[data-care-page]")).toHaveAttribute(
    "data-density",
    "compact",
  );
  expect(screen.getByRole("button", { name: "Add addendum" })).toBeEnabled();
});
test('multiple emergency pathways reveal independent fields and preserve values when hidden',async()=>{
 const emergency={...view,definition:definitions[0],record:{...record,step:2,status:'active' as const}};
 render(<CareWorkspace pageId="emergency-registration" scopeKey="multi" preferences={DEFAULT_PREFERENCES} adapter={{command:async()=>emergency}}/>);
 const trauma=await screen.findByRole('button',{name:'Trauma'});fireEvent.click(trauma);const mechanism=screen.getByLabelText('Mechanism');fireEvent.change(mechanism,{target:{value:'Fall'}});fireEvent.click(screen.getByRole('button',{name:'Pediatric'}));expect(screen.getByLabelText('Accompanying adult')).toBeVisible();expect(mechanism).toHaveValue('Fall');fireEvent.click(trauma);expect(screen.queryByLabelText('Mechanism')).not.toBeInTheDocument();fireEvent.click(trauma);expect(screen.getByLabelText('Mechanism')).toHaveValue('Fall');
});
