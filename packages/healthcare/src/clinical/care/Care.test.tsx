import React from "react";
import {fireEvent, screen, waitFor, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {consultPort, Controlled, detail, renderOwned} from "../consult-note/test/fixtures";
import {CareGapsSection, DecisionDrawer} from "./CareGaps";
import {CareProgrammesPanel} from "./CareProgrammesPanel";
import {emptyNote} from "../models/consult-note";
import type {Programme} from "../models/consult-workflow";
const programme: Programme = {id: "p1", version: 1, name: "Synthetic screening", category: "test", intervalMonths: 12, mode: "full", eligible: true, status: "due", dueOn: "2026-01-01", neverDone: true, lastDone: null, inProgress: null, decision: null, actions: [{type: "lab", code: "test-lab", display: "Synthetic lab"}], eligibility: []};
const programmes = (rows = [programme]) => ({programmes: rows, visit: null, evaluatedAt: "2026-10-28"});
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, {exact: false}), {target: {value}});
describe("care gaps and programmes", () => {
  it("adds and removes a care action through the controlled draft", async () => {
    const changed = vi.fn(), initial = emptyNote(); renderOwned(<Controlled component={CareGapsSection} initial={initial} changed={changed}/>, consultPort({loadCareProgrammes: vi.fn().mockResolvedValue(programmes())}));
    fireEvent.click(await screen.findByRole("button", {name: "Order Synthetic lab"})); expect(changed.mock.lastCall![0].labs).toEqual([{code: "test-lab", display: "Synthetic lab", priority: "", indication: "Screening: Synthetic screening"}]); expect(initial.labs).toEqual([]);
    fireEvent.click(screen.getByRole("button", {name: "Remove from this visit"})); expect(changed.mock.lastCall![0].labs).toEqual([]);
  });
  it("does not duplicate existing orders or overwrite a different referral", async () => {
    const initial = emptyNote(); initial.labs = [{code: "test-lab", display: "Synthetic lab", priority: "", indication: "Existing"}]; initial.referral = {specialty: "existing", urgency: "routine", question: "Existing referral"}; const changed = vi.fn();
    renderOwned(<Controlled component={CareGapsSection} initial={initial} changed={changed}/>, consultPort({loadCareProgrammes: vi.fn().mockResolvedValue(programmes([programme, {...programme, id: "p2", name: "Referral review", actions: [{type: "referral", code: "different", display: "Refer elsewhere"}]}]))}));
    await screen.findByText("Added to this visit"); expect(screen.queryByRole("button", {name: "Order Synthetic lab"})).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", {name: "Refer elsewhere"})); expect(await screen.findByRole("alert")).toHaveTextContent("This note already refers to existing"); expect(changed).not.toHaveBeenCalled();
  });
  it("records done-elsewhere decisions with required date/reason and refreshes records", async () => {
    const consult = consultPort({loadCareProgrammes: vi.fn().mockResolvedValue(programmes()), recordCareDecision: vi.fn().mockResolvedValue(undefined)}), done = vi.fn();
    renderOwned(<DecisionDrawer programme={programme} patientId="P1" encounterId="E1" onClose={() => {}} onDone={done}/>, consult);
    expect(screen.getByRole("button", {name: "Save decision"})).toBeDisabled(); fill("Date it was done", "2026-01-01"); fill("Where, and the result", "Test facility, normal"); fireEvent.click(screen.getByRole("button", {name: "Save decision"}));
    await waitFor(() => expect(done).toHaveBeenCalled()); expect(consult.recordCareDecision).toHaveBeenCalledWith("P1", {programmeId: "p1", outcome: "done-elsewhere", reason: "Test facility, normal", encounterId: "E1", performedOn: "2026-01-01"});
  });
  it("requires a deferral date and preserves a failed decision", async () => {
    const consult = consultPort({recordCareDecision: vi.fn().mockRejectedValue(new Error("Decision write failed"))}); renderOwned(<DecisionDrawer programme={programme} patientId="P1" onClose={() => {}} onDone={() => {}}/>, consult);
    fill("Decision", "deferred"); fill("Reason", "Review after recovery"); expect(screen.getByRole("button", {name: "Save decision"})).toBeDisabled(); fill("Defer until", "2099-01-01"); fireEvent.click(screen.getByRole("button", {name: "Save decision"})); expect(await screen.findByRole("alert")).toHaveTextContent("Decision write failed"); expect(screen.getByLabelText("Reason")).toHaveValue("Review after recovery");
  });
  it("withdraws a decision and renders decision/recall history", async () => {
    const decision = {id: "d1", programmeId: "p1", outcome: "declined" as const, reason: "Patient declined", recordedAt: "2026-01-01", recordedByName: "Test doctor"};
    const consult = consultPort({loadCareProgrammes: vi.fn().mockResolvedValue(programmes([{...programme, decision}])), withdrawCareDecision: vi.fn().mockResolvedValue(undefined), listCareDecisions: vi.fn().mockResolvedValue([decision]), listRecallContacts: vi.fn().mockResolvedValue([{id: "c1", programmeId: "p1", method: "phone", result: "contacted", note: "Synthetic recall", contactedAt: "2026-02-01", contactedByName: "Test nurse"}])}), changed = vi.fn();
    renderOwned(<CareProgrammesPanel patientId="P1" onRecordsChanged={changed}/>, consult); fireEvent.click(await screen.findByRole("button", {name: "Withdraw"})); fill("Why withdraw it", "Decision corrected"); fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", {name: "Withdraw"}));
    await waitFor(() => expect(consult.withdrawCareDecision).toHaveBeenCalledWith("d1", {reason: "Decision corrected", encounterId: undefined})); await waitFor(() => expect(changed).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", {name: "History"})); await screen.findByText(/Synthetic recall/); expect(consult.listCareDecisions).toHaveBeenCalledWith("P1", expect.any(AbortSignal)); expect(consult.listRecallContacts).toHaveBeenCalledWith("P1", expect.any(AbortSignal));
  });
  it("launches care assessments through the host with stable retry identity", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue({assessment: {id: "assessment-1"}}), navigate = vi.fn();
    renderOwned(<Controlled component={CareGapsSection}/>, consultPort({loadCareProgrammes: vi.fn().mockResolvedValue(programmes([{...programme, actions: [{type: "assessment", code: "tool-1", display: "Test assessment"}]}])), createAssessment: create}), {host: {onNavigate: navigate}});
    fireEvent.click(await screen.findByRole("button", {name: "Start Test assessment"})); await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", {name: "Start Test assessment"}));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({kind: "assessment", assessmentId: "assessment-1"})); expect(create.mock.calls[1]![0]).toEqual(create.mock.calls[0]![0]);
  });
  it("uses signed snapshots rather than current care statuses and respects read-only", async () => {
    const data = detail(); data.note = {id: "n1", version: 1, status: "final", content: {}, updatedAt: "2026-10-28", careGaps: [{...programme, name: "At signing", status: "up-to-date"}]};
    renderOwned(<Controlled component={CareGapsSection} data={data} readOnly/>, consultPort({loadCareProgrammes: vi.fn().mockResolvedValue(programmes())}));
    await screen.findByText("At signing"); expect(screen.queryByText("Synthetic screening")).not.toBeInTheDocument(); expect(screen.queryByRole("button", {name: "Record decision"})).not.toBeInTheDocument();
  });
  it("does not render or read hidden patient care without patient.read", () => {
    const consult = consultPort(); renderOwned(<CareProgrammesPanel patientId="P1"/>, consult, {permissions: []}); expect(consult.loadCareProgrammes).not.toHaveBeenCalled(); expect(screen.queryByRole("region", {name: "Care programmes"})).not.toBeInTheDocument();
  });
});
