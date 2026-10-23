import React, { StrictMode } from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import {createTestDocument} from "@pepbits/patterns/testing";
import {render,TestHost} from "../test/render";
import type {PageDefinition} from "../types";
import { DynamicRecordForm } from "./dynamic-record-form";
import { RecordAdapterProvider } from "../records/use-record-editor";
import { RecordRejected } from "@pepbits/data";
import type { RecordAdapter } from "@pepbits/data";
const { toast, schema } = vi.hoisted(() => ({ toast: vi.fn(), schema: { singular: "Item", sections: [{ id: "details", title: "Details", fields: [{ id: "name", label: "Name", type: "text", required: true, defaultValue: "Record A" }] }] } }));
const page = { id: "items", title: "Items", entity: "item", kind: "worklist" } as PageDefinition;
const adapter = { list: vi.fn().mockResolvedValue([]), create: vi.fn(), load: vi.fn(), save: vi.fn(), draft: vi.fn(), discard: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  adapter.load.mockResolvedValue({ record: null, draft: null, draftVersion: 0 });
  adapter.save.mockImplementation(async (_key, values) => ({ record: { values, version: 1, savedAt: new Date().toISOString() }, draft: null, draftVersion: 1 }));
  adapter.draft.mockImplementation(async (_key, values, baseVersion, version) => ({ values, baseVersion, version: version + 1, savedAt: new Date().toISOString() }));
  adapter.discard.mockResolvedValue(undefined);
});
const form = (id = "A") => <RecordAdapterProvider value={{adapter:adapter as RecordAdapter,identity:"t:u",applicationId:"test",sessionAvailable:true}}><DynamicRecordForm schema={schema as any} page={page} target={{ pageId: page.id, mode: "edit", recordId: id }} /></RecordAdapterProvider>;
async function ready() { await waitFor(() => expect(screen.getByRole("textbox", { name: /Name/ })).toBeEnabled()); }
test("StrictMode loads safely and reports only acknowledged saves", async () => {
  render(<TestHost screenHost={{can:()=>true,notify:toast}}><StrictMode>{form()}</StrictMode></TestHost>); await ready();
  fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), { target: { value: "Edited" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining("Changes saved"),{tone:"success"}));
  expect(adapter.save).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Saved", { exact: true })).toBeVisible();
});
test("failed save keeps edits and exposes retry", async () => {
  adapter.save.mockRejectedValueOnce(new Error("Service unavailable"));
  render(<TestHost screenHost={{can:()=>true}}>{form()}</TestHost>); await ready();
  fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), { target: { value: "Keep me" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the service");
  expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("Keep me");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.getByText("Saved", { exact: true })).toBeVisible());
});
test("recovery requires a choice before editing", async () => {
  adapter.load.mockResolvedValue({ record: null, draft: { values: { name: "Recovered" }, version: 1, baseVersion: 0, savedAt: new Date().toISOString() }, draftVersion: 1 });
  const doc=createTestDocument('A');
  render(<TestHost screenHost={{document:doc.document,can:()=>true}}>{form()}</TestHost>);
  const restore = await screen.findByRole("button", { name: "Restore draft" });
  expect(doc.close()).toBe(false);
  fireEvent.click(restore);
  expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("Recovered");
  act(() => { doc.close(true); });
});
test("suspension retains edits and explicit discard reloads the baseline", async () => {
  const doc=createTestDocument('A');
  const tree=(visible:boolean)=><TestHost screenHost={{document:doc.document,can:()=>true}}>{visible&&form()}</TestHost>;
  const { rerender } = render(tree(true)); await ready();
  fireEvent.change(screen.getByRole("textbox", { name: /Name/ }), { target: { value: "Retained" } });
  expect(doc.metadata().dirty).toBe(true);
  rerender(tree(false)); rerender(tree(true)); await ready();
  expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("Retained");
  expect(JSON.stringify(doc.metadata())).not.toContain("Retained");
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("Record A"));
  act(() => { doc.close(); });
});
test("Alt+S saves only the focused split pane", async () => {
  const a=createTestDocument('A',false),b=createTestDocument('B',true);
  render(<><TestHost screenHost={{document:a.document,can:()=>true}}>{form('A')}</TestHost><TestHost screenHost={{document:b.document,can:()=>true}}>{form('B')}</TestHost></>);
  await waitFor(() => expect(screen.getAllByRole("textbox", { name: /Name/ }).every(input => !(input as HTMLInputElement).disabled)).toBe(true));
  fireEvent.keyDown(window, { key: "s", altKey: true });
  await waitFor(() => expect(adapter.save).toHaveBeenCalledTimes(1));
  expect(adapter.save.mock.calls[0]![0]).toContain("B");
  act(() => { a.close(true);b.close(true); });
});

test("server field errors attach to the input and allow correction", async () => {
  adapter.save.mockRejectedValueOnce(new RecordRejected("Check the highlighted fields", {name:"This name already exists"}));
  render(<TestHost screenHost={{can:()=>true}}>{form()}</TestHost>); await ready();
  fireEvent.click(screen.getByRole("button", {name:"Save"}));
  expect(await screen.findByText("This name already exists")).toBeVisible();
  expect(screen.getByRole("textbox",{name:/Name/})).toHaveAttribute("aria-invalid","true");
  fireEvent.change(screen.getByRole("textbox",{name:/Name/}),{target:{value:"Unique"}});
  fireEvent.click(screen.getByRole("button",{name:"Save"}));
  await waitFor(()=>expect(screen.getByText("Saved",{exact:true})).toBeVisible());
});

test('permission failure keeps edits and does not offer a mutation retry',async()=>{
 const {RecordRequestFailure}=await import('@pepbits/data');adapter.save.mockRejectedValueOnce(new RecordRequestFailure(403,'trace-form'));render(<TestHost screenHost={{can:()=>true}}>{form()}</TestHost>);await ready();
 fireEvent.change(screen.getByRole('textbox',{name:/Name/}),{target:{value:'Retain denied edits'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));expect(await screen.findByRole('alert')).toHaveTextContent('Access not permitted');expect(screen.queryByRole('button',{name:'Retry'})).toBeNull();expect(screen.getByRole('textbox',{name:/Name/})).toHaveValue('Retain denied edits');
});
