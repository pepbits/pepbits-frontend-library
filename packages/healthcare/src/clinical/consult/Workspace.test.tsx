import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, screen, waitFor} from "@testing-library/react";
import {Textarea, Button} from "@pepbits/ui";
import {renderClinical} from "../test/host";
import {ConsultHostProvider, type ConsultHost} from "../context/consult-host";
import {ConsultSection} from "../layout/ConsultSection";
import {ConsultWorkspace} from "./Workspace";
import type {ConsultWorkspaceSection} from "./sections";
import {consultationDetail, consultationPort, deferred} from "./test-fixtures";
import type {SavedDraft} from "../models/consult-workflow";

const sections: ConsultWorkspaceSection[] = [{id: "assessment", title: "Assessment", render: context => <ConsultSection id={context.id!} title="Assessment">
  <Textarea label="Assessment text" value={context.draft.assessment} disabled={context.readOnly} onChange={e => context.onChange(n => {n.assessment = e.target.value;})}/>
  <Button onClick={() => void context.onRecordsChanged?.()}>Refresh records</Button>
  <Button onClick={() => context.onChange(n => {n.advice = "a cloned update";})}>Add advice</Button>
</ConsultSection>}];
function mount(options: {fake?: ReturnType<typeof consultationPort>; host?: Partial<ConsultHost>; permissions?: string[]; autosaveMs?: number; registry?: ConsultWorkspaceSection[]} = {}) {
  const fake = options.fake ?? consultationPort();
  const host: ConsultHost = {onNavigate: vi.fn(), onDirtyChange: vi.fn(), onPatientOpened: vi.fn(), renderLink: (_destination, props) => <a href="#host-owned" aria-label={props["aria-label"]}>{props.children}</a>, ...options.host};
  const view = renderClinical(<ConsultHostProvider value={host}><ConsultWorkspace encounterId="E1" sections={options.registry ?? sections} autosaveMs={options.autosaveMs ?? 60000}/></ConsultHostProvider>, {port: fake.port, actor: {role: "doctor", permissions: options.permissions ?? ["note.write", "note.sign", "vitals.write"]}});
  return {...fake, host, ...view};
}
afterEach(() => {cleanup(); vi.useRealTimers();});
describe("ConsultWorkspace with a synthetic consultation port", () => {
  it("loads, saves, signs at the latest version and becomes read-only", async () => {
    const {consult, host} = mount();
    const field = await screen.findByLabelText("Assessment text"); fireEvent.change(field, {target: {value: "Synthetic assessment"}});
    expect(host.onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", {name: "Save draft"}));
    await waitFor(() => expect(consult.saveConsultNote).toHaveBeenCalledWith("E1", expect.objectContaining({assessment: "Synthetic assessment"}), 4));
    await waitFor(() => expect(host.onDirtyChange).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    fireEvent.click(screen.getByRole("button", {name: "Sign note"}));
    await waitFor(() => expect(consult.signConsultNote).toHaveBeenCalledExactlyOnceWith("E1", 6));
    expect(await screen.findByText("Note signed. Orders recorded.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Done"}));
    expect(screen.getByLabelText("Assessment text")).toBeDisabled();
    expect(host.onPatientOpened).toHaveBeenCalledWith(expect.objectContaining({id: "P1"}));
    expect(consult.loadConsultation).toHaveBeenCalledTimes(2);
  });
  it("freezes edits during save-before-sign and waits for the saved version", async () => {
    const write = deferred<SavedDraft>(), fake = consultationPort({saveConsultNote: vi.fn(() => write.promise)});
    mount({fake}); const field = await screen.findByLabelText("Assessment text"); fireEvent.change(field, {target: {value: "Latest"}});
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"})); fireEvent.click(screen.getByRole("button", {name: "Sign note"}));
    await waitFor(() => expect(fake.consult.saveConsultNote).toHaveBeenCalledTimes(1));
    expect(field).toBeDisabled(); expect(fake.consult.signConsultNote).not.toHaveBeenCalled();
    await act(async () => {write.resolve({version: 19, updatedAt: "2026-10-28T10:02:00Z"});});
    expect(fake.consult.signConsultNote).toHaveBeenCalledExactlyOnceWith("E1", 19);
  });
  it("retains conflict edits, blocks retries and discards only through explicit reload", async () => {
    const fake = consultationPort({saveConsultNote: vi.fn().mockRejectedValue(Object.assign(new Error("Version conflict"), {status: 409, problems: ["Another clinician saved this note"]}))});
    const {host} = mount({fake}); const field = await screen.findByLabelText("Assessment text"); fireEvent.change(field, {target: {value: "Preserve my draft"}});
    fireEvent.click(screen.getByRole("button", {name: "Save draft"}));
    expect(await screen.findByText("Another clinician saved this note")).toBeInTheDocument();
    expect(field).toHaveValue("Preserve my draft"); expect(field).toBeDisabled();
    expect(screen.getByRole("button", {name: "Review and sign"})).toBeDisabled(); expect(host.onDirtyChange).toHaveBeenLastCalledWith(true);
    fake.getDetail().note!.content.assessment = "Latest from server";
    fireEvent.click(screen.getByRole("button", {name: "Discard local draft and reload"}));
    await waitFor(() => expect(screen.getByLabelText("Assessment text")).toHaveValue("Latest from server"));
    expect(screen.getByLabelText("Assessment text")).not.toBeDisabled(); expect(fake.consult.saveConsultNote).toHaveBeenCalledTimes(1);
    expect(host.onDirtyChange).toHaveBeenLastCalledWith(false);
  });
  it("refreshes server records without replacing an unsaved note", async () => {
    const {getDetail, consult} = mount(); const field = await screen.findByLabelText("Assessment text");
    fireEvent.change(field, {target: {value: "Local unsaved text"}}); getDetail().note!.content.assessment = "Server text";
    fireEvent.click(screen.getByRole("button", {name: "Refresh records"})); await waitFor(() => expect(consult.loadConsultation).toHaveBeenCalledTimes(2));
    expect(field).toHaveValue("Local unsaved text"); expect(consult.saveConsultNote).not.toHaveBeenCalled();
  });
  it("autosaves an edit made during an in-flight autosave", async () => {
    const first = deferred<SavedDraft>();
    const fake = consultationPort({saveConsultNote: vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValueOnce({version: 6, updatedAt: "2026-10-28T10:00:00Z"})});
    mount({fake, autosaveMs: 1200}); const field = await screen.findByLabelText("Assessment text"); vi.useFakeTimers();
    fireEvent.change(field, {target: {value: "First"}}); await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(fake.consult.saveConsultNote).toHaveBeenCalledTimes(1); fireEvent.change(field, {target: {value: "Second"}});
    await act(async () => {first.resolve({version: 5, updatedAt: "2026-10-28T10:00:00Z"});});
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(fake.consult.saveConsultNote).toHaveBeenLastCalledWith("E1", expect.objectContaining({assessment: "Second"}), 5);
  });
  it("prevents controlled callbacks and writes without note.write permission", async () => {
    const {consult} = mount({permissions: ["note.sign"]}); const field = await screen.findByLabelText("Assessment text");
    expect(field).toBeDisabled(); fireEvent.click(screen.getByRole("button", {name: "Add advice"}));
    expect(screen.getByRole("button", {name: "Save draft"})).toBeDisabled(); expect(screen.getByRole("button", {name: "Review and sign"})).toBeDisabled();
    expect(consult.saveConsultNote).not.toHaveBeenCalled();
  });
  it("uses the administration host slot and reports its busy state", async () => {
    const {host} = mount({host: {initialTab: "administer", renderAdministration: props => <Button onClick={() => props.onBusyChange(true)}>Begin administration</Button>}});
    fireEvent.click(await screen.findByRole("button", {name: "Begin administration"}));
    expect(host.onDirtyChange).toHaveBeenLastCalledWith(true); expect(screen.getByRole("button", {name: "Consultation"})).toBeDisabled();
  });
  it("renders explicit unavailable states and routes the chart link through the host", async () => {
    const renderLink = vi.fn((_destination, props) => <a href="#chart-host">{props.children}</a>);
    mount({host: {renderLink}}); await screen.findByLabelText("Assessment text");
    expect(screen.getByText("Telehealth unavailable")).toBeInTheDocument();
    expect(renderLink).toHaveBeenCalledWith({kind: "patient-chart", patientId: "P1"}, expect.objectContaining({newTab: true}));
    fireEvent.click(screen.getByRole("button", {name: "Administer"}));
    expect(screen.getByText(/Medication administration unavailable/)).toBeInTheDocument();
  });
  it("redirects inpatient encounters only through semantic host navigation", async () => {
    const detail = consultationDetail(); detail.encounter.class = "IP";
    const {host} = mount({fake: consultationPort({loadConsultation: vi.fn(async () => detail)})});
    await waitFor(() => expect(host.onNavigate).toHaveBeenCalledWith({kind: "inpatient", encounterId: "E1"}, {replace: true}));
    expect(screen.queryByLabelText("Assessment text")).not.toBeInTheDocument();
  });
  it("provides load recovery and aborts obsolete reads on unmount", async () => {
    const read = deferred<ReturnType<typeof consultationDetail>>();
    const load = vi.fn().mockRejectedValueOnce(new Error("Temporarily unavailable")).mockImplementationOnce(() => read.promise);
    const {unmount} = mount({fake: consultationPort({loadConsultation: load})});
    expect(await screen.findByText("Temporarily unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: /try.again|retry/i})); await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    const signal = load.mock.calls[1]![1] as AbortSignal; unmount(); expect(signal.aborted).toBe(true);
    await act(async () => {read.resolve(consultationDetail());});
  });
  it("passes review and allergy actions with their frozen versions and preserves local edits", async () => {
    const detail = consultationDetail(); detail.allergies.entries = [{id: "A1", substance: "Test substance", category: "medication", clinicalStatus: "active", verification: "unconfirmed", version: 8}];
    const fake = consultationPort({loadConsultation: vi.fn(async () => structuredClone(detail))});
    mount({fake, registry: [{id: "review", title: "Review", render: ctx => <div><Button onClick={() => void ctx.acknowledgeReviews([{id: "R1"} as typeof detail.reviews[number]])}>Acknowledge</Button><Button onClick={() => void ctx.verifyAllergy("A1", "confirmed")}>Verify</Button></div>}]});
    fireEvent.click(await screen.findByRole("button", {name: "Acknowledge"})); await waitFor(() => expect(fake.consult.loadConsultation).toHaveBeenCalledTimes(2));
    expect(fake.consult.acknowledgeReviews).toHaveBeenCalledWith(["R1"]);
    fireEvent.click(screen.getByRole("button", {name: "Verify"})); await waitFor(() => expect(fake.consult.verifyAllergy).toHaveBeenCalledWith("P1", "A1", {verification: "confirmed", version: 8}));
  });
});
