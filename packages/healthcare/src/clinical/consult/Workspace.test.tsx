import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, screen, waitFor, within} from "@testing-library/react";
import {Textarea, Button} from "@pepbits/ui";
import {renderClinical} from "../test/host";
import {ConsultHostProvider, type ConsultHost} from "../context/consult-host";
import {ConsultSection} from "../layout/ConsultSection";
import {defaultConsultSections} from "./sections";
import {ConsultWorkspace} from "./Workspace";
import type {ConsultWorkspaceSection} from "./sections";
import {consultationDetail, consultationPort, deferred} from "./test-fixtures";
import type {SavedDraft} from "../models/consult-workflow";

const sections: ConsultWorkspaceSection[] = [{id: "assessment", title: "Assessment", render: context => <ConsultSection id={context.id!} title="Assessment">
  <Textarea label="Assessment text" value={context.draft.assessment} disabled={context.readOnly} onChange={e => context.onChange(n => {n.assessment = e.target.value;})}/>
  <Button onClick={() => void context.onRecordsChanged?.()}>Refresh records</Button>
  <Button onClick={() => context.onChange(n => {n.advice = "a cloned update";})}>Add advice</Button>
</ConsultSection>}];
function mount(options: {fake?: ReturnType<typeof consultationPort>; host?: Partial<ConsultHost>; permissions?: string[]; autosaveMs?: number; registry?: readonly ConsultWorkspaceSection[]} = {}) {
  const fake = options.fake ?? consultationPort();
  const host: ConsultHost = {onNavigate: vi.fn(), onDirtyChange: vi.fn(), onPatientOpened: vi.fn(), renderLink: (_destination, props) => <a href="#host-owned" aria-label={props["aria-label"]}>{props.children}</a>, ...options.host};
  const view = renderClinical(<ConsultHostProvider value={host}><ConsultWorkspace encounterId="E1" sections={options.registry ?? sections} autosaveMs={options.autosaveMs ?? 60000}/></ConsultHostProvider>, {port: fake.port, actor: {role: "doctor", permissions: options.permissions ?? ["patient.read", "note.write", "note.sign", "vitals.write", "allergy.verify", "assessment.perform", "rx.write", "order.write"]}});
  return {...fake, host, ...view};
}
afterEach(() => {cleanup(); vi.useRealTimers(); vi.unstubAllGlobals();});
describe("ConsultWorkspace with a synthetic consultation port", () => {
  it("loads, saves, signs at the latest version and becomes read-only", async () => {
    const {consult, host} = mount();
    const field = await screen.findByLabelText("Assessment text"); fireEvent.change(field, {target: {value: "Synthetic assessment"}});
    await waitFor(() => expect(host.onDirtyChange).toHaveBeenLastCalledWith(true));
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
    expect(screen.getByRole("button", {name: "Review and sign"})).toBeDisabled(); await waitFor(() => expect(host.onDirtyChange).toHaveBeenLastCalledWith(true));
    fake.getDetail().note!.content.assessment = "Latest from server";
    fireEvent.click(screen.getByRole("button", {name: "Discard local draft and reload"}));
    await waitFor(() => expect(screen.getByLabelText("Assessment text")).toHaveValue("Latest from server"));
    expect(screen.getByLabelText("Assessment text")).not.toBeDisabled(); expect(fake.consult.saveConsultNote).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(host.onDirtyChange).toHaveBeenLastCalledWith(false));
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

describe("assembled consultation with the full synthetic ConsultationDataPort", () => {
  it("loads real sections, edits and autosaves, blocks a missing diagnosis, then signs and adds an addendum", async () => {
    const fake = consultationPort(); fake.getDetail().note!.content.diagnoses = [];
    const {container} = mount({fake, registry: defaultConsultSections, autosaveMs: 50});
    const assessment = await screen.findByLabelText("Clinical assessment");
    expect([...container.querySelectorAll('[data-consult-section]')].map(node => node.getAttribute('data-consult-section'))).toEqual(defaultConsultSections.map(section => section.id));
    fireEvent.change(assessment, {target: {value: "Synthetic clinical assessment"}});
    await waitFor(() => expect(fake.consult.saveConsultNote).toHaveBeenCalledWith("E1", expect.objectContaining({assessment: "Synthetic clinical assessment"}), 4));
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    expect(screen.getByRole("button", {name: "Sign note"})).toBeDisabled();
    expect(screen.getAllByText("Add a primary diagnosis before signing.").length).toBeGreaterThan(0);
    expect(fake.consult.signConsultNote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
    fireEvent.change(screen.getByRole("combobox", {name: "Add diagnosis"}), {target: {value: "Synthetic"}});
    fireEvent.mouseDown(await screen.findByRole("option", {name: /Synthetic diagnosis/}));
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    await waitFor(() => expect(screen.getByRole("button", {name: "Sign note"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "Sign note"}));
    expect(await screen.findByText("Note signed. Orders recorded.")).toBeInTheDocument();
    const saved = vi.mocked(fake.consult.saveConsultNote).mock.results.at(-1)!;
    expect(fake.consult.signConsultNote).toHaveBeenCalledWith("E1", (await saved.value).version);
    fireEvent.click(screen.getByRole("button", {name: "Done"}));
    expect(screen.getByLabelText("Clinical assessment")).toBeDisabled();
    expect(screen.getByRole("button", {name: "Home"})).toBeDisabled();
    expect(screen.getByRole("button", {name: "New assessment"})).toBeEnabled();
    fireEvent.click(screen.getByRole("button", {name: "Add addendum"}));
    fireEvent.change(screen.getByLabelText(/Addendum text/), {target: {value: "Synthetic later result reviewed"}});
    fireEvent.click(screen.getByRole("button", {name: "Sign addendum"}));
    await waitFor(() => expect(screen.getByText("Synthetic later result reviewed", {selector: "article p"})).toBeInTheDocument());
    expect(fake.consult.addNoteAddendum).toHaveBeenCalledWith("E1", {reason: "additional-information", text: "Synthetic later result reviewed"});
    expect(screen.getByLabelText("Clinical assessment")).toHaveValue("Synthetic clinical assessment");
    expect(container.textContent).not.toContain("Unarranged consultation operation");
  });

  it("blocks unresolved high medication safety alerts and requires a reason even when needsReason is false", async () => {
    const fake = consultationPort({checkMedications: vi.fn(async () => ({lines: [{code: "RX1", allergy: [], alerts: [{kind: "interaction", severity: "high" as const, message: "Synthetic high interaction"}], needsReason: false}], unmapped: [], context: {}}))});
    fake.getDetail().note!.content.prescriptions = [{code: "RX1", display: "Synthetic medicine", dose: "10 mg", route: "oral", frequency: "once daily", days: 5, instructions: "", priority: "routine", flags: {}}];
    mount({fake, registry: defaultConsultSections});
    const reason = await screen.findByLabelText(/Reason to proceed with Synthetic medicine/);
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    expect(screen.getByRole("button", {name: "Sign note"})).toBeDisabled();
    expect(screen.getAllByText(/Synthetic medicine: document a reason to proceed/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", {name: "Sign note"}));
    expect(fake.consult.signConsultNote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
    fireEvent.change(reason, {target: {value: "Benefits assessed; monitoring arranged"}});
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    await waitFor(() => expect(screen.getByRole("button", {name: "Sign note"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "Sign note"}));
    await waitFor(() => expect(fake.consult.signConsultNote).toHaveBeenCalledTimes(1));
    expect(fake.consult.saveConsultNote).toHaveBeenCalledWith("E1", expect.objectContaining({prescriptions: [expect.objectContaining({overrideReason: "Benefits assessed; monitoring arranged"})]}), expect.any(Number));
  });

  it("blocks pending and failed order evaluation, then allows retry of the same current draft", async () => {
    const evaluation = deferred<{results: []; problems: string[]}>();
    const evaluate = vi.fn().mockImplementationOnce(() => evaluation.promise).mockResolvedValue({results: [], problems: []});
    const fake = consultationPort({evaluateOrderForms: evaluate});
    fake.getDetail().note!.content.labs = [{code: "LAB1", display: "Synthetic test", indication: "Synthetic diagnosis", priority: "routine"}];
    mount({fake, registry: defaultConsultSections});
    await screen.findByLabelText("Clinical assessment");
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    expect(screen.getByRole("button", {name: "Sign note"})).toBeDisabled();
    await act(async () => evaluation.resolve({results: [], problems: ["Synthetic order information is required"]}));
    expect(screen.getByRole("button", {name: "Sign note"})).toBeDisabled();
    expect(fake.consult.signConsultNote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
    fireEvent.click(screen.getByRole("button", {name: "Retry order evaluation"}));
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    await waitFor(() => expect(screen.getByRole("button", {name: "Sign note"})).toBeEnabled());
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it("keeps abnormal reviews blocking, acknowledges them one at a time and preserves the draft on refresh", async () => {
    const fake = consultationPort();
    const {review} = await import("../consult-records/test-fixtures");
    fake.getDetail().reviews = [review("abnormal-1", true), review("abnormal-2", true), review("routine-1"), review("routine-2")];
    vi.mocked(fake.consult.acknowledgeReviews).mockImplementation(async ids => {fake.getDetail().reviews = fake.getDetail().reviews.filter(task => !ids.includes(task.id));});
    mount({fake, registry: defaultConsultSections});
    fireEvent.change(await screen.findByLabelText("Clinical assessment"), {target: {value: "Retain local draft"}});
    fireEvent.click(screen.getByRole("button", {name: "Acknowledge all routine"}));
    await waitFor(() => expect(fake.consult.acknowledgeReviews).toHaveBeenLastCalledWith(["routine-1", "routine-2"]));
    await waitFor(() => expect(screen.getByRole("button", {name: "Review and sign"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    expect(screen.getByRole("button", {name: "Sign note"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
    for (const id of ["abnormal-1", "abnormal-2"]) {
      const row = screen.getByText(`Finding ${id}`).closest("li")!;
      fireEvent.click(row.querySelector("button")!);
      await waitFor(() => expect(screen.queryByText(`Finding ${id}`)).not.toBeInTheDocument());
      expect(fake.consult.acknowledgeReviews).toHaveBeenLastCalledWith([id]);
    }
    expect(screen.getByLabelText("Clinical assessment")).toHaveValue("Retain local draft");
    await waitFor(() => expect(screen.getByRole("button", {name: "Review and sign"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    expect(screen.getByRole("button", {name: "Sign note"})).toBeEnabled();
  });
});


describe("assembled readiness and navigation", () => {
  it("requires allergy review, visit vitals or a reason, and disposition before signing", async () => {
    const fake = consultationPort(), detail = fake.getDetail();
    detail.allergies.assessment.state = "not-assessed";
    detail.note!.content.vitalsNotTaken = ""; detail.note!.content.disposition = null; detail.note!.content.dischargeAt = null;
    vi.mocked(fake.consult.reviewAllergies).mockImplementation(async () => {detail.allergies.assessment.state = "nka"; return detail.allergies;});
    mount({fake, registry: defaultConsultSections});
    await screen.findByLabelText("Clinical assessment");
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    expect(screen.getByRole("button", {name: "Sign note"})).toBeDisabled();
    for (const problem of ["Review allergies before signing.", "Record vitals or document why they were not taken.", "Choose a disposition before signing.", "Record the clinical discharge time before signing."])
      expect(screen.getAllByText(problem).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
    fireEvent.change(screen.getByLabelText("Reason vitals were not taken"), {target: {value: "Telephone visit"}});
    fireEvent.click(screen.getByRole("button", {name: "Home"}));
    fireEvent.click(screen.getByRole("radio", {name: "No known allergies"}));
    await waitFor(() => expect(fake.consult.reviewAllergies).toHaveBeenCalledWith("P1", "nka"));
    await waitFor(() => expect(screen.getByRole("button", {name: "Review and sign"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "Review and sign"}));
    expect(screen.getByRole("button", {name: "Sign note"})).toBeEnabled();
  });

  it("connects reproductive and care-gap banner flags to instance-scoped section navigation and scroll spy", async () => {
    let intersect!: IntersectionObserverCallback;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {intersect = callback;}
      observe = vi.fn(); disconnect = vi.fn();
    });
    const programme: import("../models/consult-workflow").Programme = {id: "C1", version: 1, name: "Synthetic care review", category: "screening", intervalMonths: 12, mode: "full", eligible: true, status: "overdue", dueOn: "2026-01-01", neverDone: true, lastDone: null, inProgress: null, decision: null, actions: [], eligibility: []};
    const fake = consultationPort({loadCareProgrammes: vi.fn(async () => ({programmes: [programme], visit: null, evaluatedAt: "2026-10-28"}))});
    fake.getDetail().patient.sex = "female";
    fake.getDetail().reproductiveStatus = {version: 1, pregnancy: "pregnant", verification: "unconfirmed"};
    const {container} = mount({fake, registry: defaultConsultSections, host: {stickyOffset: "120px"}});
    expect(await screen.findByText("Pregnant (unconfirmed)")).toBeInTheDocument();
    const gapLink = await screen.findByRole("link", {name: /1 due/});
    const gapSection = document.getElementById(gapLink.getAttribute("href")!.slice(1))!;
    expect(gapSection).toHaveTextContent("Synthetic care review");
    const assessment = container.querySelector('[data-consult-section="assessment"] section')!;
    const scroll = vi.fn(); assessment.scrollIntoView = scroll;
    const rail = screen.getByRole("navigation", {name: "Note sections"});
    const item = within(rail).getByRole("button", {name: "Assessment and diagnoses · Complete"});
    fireEvent.click(item);
    expect(scroll).toHaveBeenCalledWith({block: "start", behavior: "instant"});
    expect(assessment).toHaveStyle({scrollMarginTop: "120px"});
    act(() => intersect([{target: gapSection, isIntersecting: true, boundingClientRect: new DOMRect(0, 140, 100, 100), intersectionRect: new DOMRect(0, 140, 100, 100), rootBounds: null, time: 0, intersectionRatio: 1}], {} as IntersectionObserver));
    expect(within(rail).getByRole("button", {name: "Care gaps · Started"})).toHaveAttribute("aria-current", "location");
  });
});
