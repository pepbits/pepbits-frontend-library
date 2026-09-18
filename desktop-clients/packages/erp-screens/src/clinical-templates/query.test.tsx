import React from "react";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { test, expect, vi } from "vitest";
import metadataFixture from "../../../../../dummy-api/config/clinical-templates/metadata.json";
import patientFixtures from "../../../../../dummy-api/config/clinical-templates/patients.json";
import {
  DEFAULT_PREFERENCES,
  createFormatters,
  type PatientMetadata,
  type PatientRecord,
  type PatientSummary,
} from "@pepbits/erp-config";
import {
  ClinicalRequestFailure,
  type ClinicalTemplateAdapter,
} from "@pepbits/erp-data";
import { PatientQueryTemplate } from "./patient-query";
import {exportRows} from "../worklist/export-rows";
import type {ClinicalPageProps} from "./shared";
vi.mock("../worklist/export-rows",()=>({exportRows:vi.fn()}));
import { querySignature } from "./query-model";
const fixture = patientFixtures[0] as PatientRecord;
const row: PatientSummary = {
  id: fixture.id,
  mrn: fixture.mrn,
  internalCode: fixture.internalCode,
  name: "Alex Morgan",
  birthDate: String(fixture.values.birthDate),
  gender: "male",
  mobile: String(fixture.values.mobile),
  email: String(fixture.values.email),
  nationality: "uae",
  status: "active",
  registeredAt: fixture.activity[0].at,
  version: 1,
};
function setup(overrides:Partial<ClinicalPageProps> = {}) {
  const adapter = {
    search: vi
      .fn()
      .mockResolvedValue({ rows: [row], total: 1, page: 1, pageSize: 20 }),
    exportRows: vi.fn().mockResolvedValue({rows:[row]}),
    savedSearches: vi.fn().mockResolvedValue([]),
    load: vi.fn().mockResolvedValue(fixture),
    saveSearch: vi.fn().mockResolvedValue([]),
  } as unknown as ClinicalTemplateAdapter;
  const onOpen = vi.fn();
  render(
    <PatientQueryTemplate
      adapter={adapter}
      metadata={{ ...metadataFixture, canWrite: true } as PatientMetadata}
      preferences={DEFAULT_PREFERENCES}
      format={createFormatters(DEFAULT_PREFERENCES)}
      onOpen={onOpen}
      {...overrides}
    />,
  );
  return { adapter, onOpen };
}
test("query waits for criteria and preserves filters after a failed search", async () => {
  const { adapter } = setup();
  vi.mocked(adapter.search)
    .mockRejectedValueOnce(new ClinicalRequestFailure(503))
    .mockResolvedValue({ rows: [row], total: 1, page: 1, pageSize: 20 });
  expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
  expect(adapter.search).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("First name", { exact: true }), {
    target: { value: " Alex " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("First name", { exact: true })).toHaveValue(
    "Alex",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("button", { name: "Alex Morgan" });
  expect(vi.mocked(adapter.search).mock.calls[0][0]).toMatchObject({
    firstName: "Alex",
    page: 1,
  });
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(
    screen.getByRole("heading", { name: "Search the patient registry" }),
  ).toBeInTheDocument();
  expect(adapter.search).toHaveBeenCalledTimes(2);
});
test("inline details belong to the selected row and record actions use navigation", async () => {
  const { onOpen } = setup({preferences:{...DEFAULT_PREFERENCES,previewMode:"inline"}});
  fireEvent.change(screen.getByLabelText("First name", { exact: true }), {
    target: { value: "Alex" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByRole("button", { name: "Alex Morgan" });
  fireEvent.click(screen.getByRole("button", { name: "Alex Morgan" }));
  await screen.findByRole("heading", { name: "Alex Morgan" });
  const detail = document.querySelector("[data-query-detail]")!;
  expect(detail.closest("tr")).not.toBeNull();
  fireEvent.click(
    within(detail as HTMLElement).getByRole("button", {
      name: "Edit",
    }),
  );
  expect(onOpen).toHaveBeenCalledWith({
    view: "record",
    patientId: fixture.id,
    mode: "edit",
  });
});
test("recent search signatures ignore case, whitespace and unattached country codes", () => {
  expect(querySignature({ firstName: " Alex ", mobileCode: "+971" })).toBe(
    querySignature({ firstName: "alex" }),
  );
  expect(querySignature({ mobile: "123", mobileCode: "+971" })).not.toBe(
    querySignature({ mobile: "123", mobileCode: "+91" }),
  );
});

test("failed preset saves show their error in the dialog and preserve its name", async () => {
  const { adapter } = setup();
  vi.mocked(adapter.saveSearch)
    .mockRejectedValueOnce(new ClinicalRequestFailure(503))
    .mockResolvedValue([]);
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Alex" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save preset" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Search name"), {
    target: { value: "My search" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save search" }));
  await within(dialog).findByRole("alert");
  expect(within(dialog).getByLabelText("Search name")).toHaveValue("My search");
  fireEvent.click(within(dialog).getByRole("button", { name: "Save search" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(adapter.saveSearch).toHaveBeenCalledTimes(2);
});


test("query has no presentation selectors and honors locked page size", async () => {
  setup({preferencePolicy:{revision:1,rules:{resultView:{locked:true,value:'table'},previewMode:{locked:true,value:'left-drawer'},pageSize:{locked:true,value:10}}}});
  fireEvent.change(screen.getByLabelText('First name',{exact:true}),{target:{value:'Alex'}});
  fireEvent.click(screen.getByRole('button',{name:'Search'}));await screen.findByRole('button',{name:'Alex Morgan'});
  expect(screen.queryByRole('tab',{name:'Cards'})).not.toBeInTheDocument();
  expect(screen.queryByRole('tab',{name:'Inline'})).not.toBeInTheDocument();
  expect(screen.getByRole('combobox',{name:'Rows per page'})).toBeDisabled();
});
test("disabled query shortcuts do not focus search or open help", async () => {
  const rects=vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  try {
    setup({preferences:{...DEFAULT_PREFERENCES,keyboardShortcuts:false}});
    fireEvent.keyDown(window,{key:'/'});expect(screen.getByLabelText('First name',{exact:true})).not.toHaveFocus();
    fireEvent.keyDown(window,{key:'?'});expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {rects.mockRestore();}
});
test("query export uses the selected file format", async () => {
  setup({preferences:{...DEFAULT_PREFERENCES,exportFormat:'xlsx'}});
  fireEvent.change(screen.getByLabelText('First name',{exact:true}),{target:{value:'Alex'}});
  fireEvent.click(screen.getByRole('button',{name:'Search'}));await screen.findByRole('button',{name:'Alex Morgan'});
  fireEvent.click(screen.getByRole('button',{name:'Export'}));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Export'}));
  await waitFor(()=>expect(exportRows).toHaveBeenCalledWith(expect.any(Array),expect.any(Array),expect.any(Object),'xlsx','clinical-demo-patients'));
});

test("production capability limits preserve layout without invoking unavailable workflows",async()=>{
 const {adapter}=setup({metadata:{...metadataFixture,canWrite:true,queryCapabilities:{presets:false,export:false,care:false,overview:false,sort:false}} as PatientMetadata});
 vi.mocked(adapter.search).mockResolvedValue({rows:[{...row,editable:false}],total:1,page:1,pageSize:20,hasMore:true});
 expect(adapter.savedSearches).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText("First name",{exact:true}),{target:{value:"Alex"}});
 fireEvent.click(screen.getByRole("button",{name:"Search"}));await screen.findByRole("button",{name:"Alex Morgan"});
 expect(screen.getByText("Patients on this page: 1")).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Next page"})).toBeEnabled();
 expect(screen.getByRole("button",{name:"Previous page"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Export"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Edit"})).toBeDisabled();
 expect(adapter.load).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Next page"}));
 await waitFor(()=>expect(adapter.search).toHaveBeenLastCalledWith(expect.objectContaining({page:2}),expect.any(Object)));
});

test("infinite results use twenty-record requests, preserve loaded rows and retain a keyboard load action",async()=>{
 const {adapter}=setup({metadata:{...metadataFixture,canWrite:true,queryCapabilities:{infiniteScroll:true}} as PatientMetadata,preferences:{...DEFAULT_PREFERENCES,pageSize:50}});
 vi.mocked(adapter.search).mockResolvedValueOnce({rows:[row],total:1,page:1,pageSize:20,hasMore:true}).mockResolvedValueOnce({rows:[{...row,id:'another',name:'Another Patient'}],total:2,page:2,pageSize:20,hasMore:false});
 fireEvent.change(screen.getByLabelText("First name",{exact:true}),{target:{value:"Alex"}});
 fireEvent.click(screen.getByRole("button",{name:"Search"}));await screen.findByRole("button",{name:"Alex Morgan"});
 expect(vi.mocked(adapter.search).mock.calls[0][0].pageSize).toBe(20);
 expect(screen.queryByRole("button",{name:"Next page"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Load more patients"}));
 await screen.findByRole("button",{name:"Another Patient"});
 expect(screen.getByRole("button",{name:"Alex Morgan"})).toBeInTheDocument();
 expect(screen.getByText("Patients loaded: 2")).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Load more patients"})).not.toBeInTheDocument();
});
test("additional criteria are supplied by metadata and unadvertised fields are hidden",async()=>{
 const {adapter}=setup({metadata:{...metadataFixture,canWrite:true,searchFields:['q','email','bloodGroup','birthDateFrom'],searchOptions:{bloodGroup:[{value:'9',label:'Synthetic blood group'}]}} as PatientMetadata});
 expect(screen.queryByLabelText("First name",{exact:true})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'More filters'}));
 fireEvent.change(screen.getByLabelText('Email',{exact:true}),{target:{value:'synthetic@example.invalid'}});
 fireEvent.change(screen.getByLabelText('Blood group',{exact:true}),{target:{value:'9'}});
 fireEvent.click(screen.getByRole('button',{name:'Search'}));
 await waitFor(()=>expect(adapter.search).toHaveBeenCalledWith(expect.objectContaining({email:'synthetic@example.invalid',bloodGroup:'9'}),expect.any(Object)));
 expect(screen.queryByLabelText('Insurance member number')).not.toBeInTheDocument();
});
test("reaching the result sentinel requests the next cursor page",async()=>{
 let callback!: IntersectionObserverCallback;
 const disconnect=vi.fn();
 vi.stubGlobal('IntersectionObserver',class {
   constructor(next:IntersectionObserverCallback){callback=next;}
   observe(){} disconnect(){disconnect();}
 });
 try {
   const {adapter}=setup({metadata:{...metadataFixture,canWrite:true,queryCapabilities:{infiniteScroll:true}} as PatientMetadata});
   vi.mocked(adapter.search).mockResolvedValueOnce({rows:[row],total:1,page:1,pageSize:20,hasMore:true}).mockResolvedValueOnce({rows:[{...row,id:'scroll',name:'Scrolled Patient'}],total:2,page:2,pageSize:20,hasMore:false});
   fireEvent.change(screen.getByLabelText('First name',{exact:true}),{target:{value:'Alex'}});
   fireEvent.click(screen.getByRole('button',{name:'Search'}));
   await screen.findByRole('button',{name:'Load more patients'});
   act(() => callback([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver));
   await screen.findByRole('button',{name:'Scrolled Patient'});
   expect(vi.mocked(adapter.search).mock.calls[1][0]).toMatchObject({page:2,pageSize:20});
   expect(disconnect).toHaveBeenCalled();
 } finally {vi.unstubAllGlobals();}
});
