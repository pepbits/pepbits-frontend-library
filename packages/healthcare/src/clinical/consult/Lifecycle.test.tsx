import React, {useState} from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, screen, waitFor} from "@testing-library/react";
import {renderClinical} from "../test/host";
import {emptyNote} from "../models/consult-note";
import type {CareTeamData, ExtractionResult, Proposal} from "../models/consult-workflow";
import {consultationDetail, consultationPort, deferred} from "./test-fixtures";
import {EndVisitButton, NoteAddenda} from "./EncounterEnd";
import {CareTeam} from "./CareTeam";
import {AiTray, applyNoteProposal} from "./AiTray";
import {ClinicalDischarge} from "./ClinicalDischarge";

const actor = {role: "doctor", permissions: ["note.write", "note.sign"]};
afterEach(cleanup);
describe("consultation lifecycle workflows", () => {
  it("records only outcome-specific fields using the encounter version", async () => {
    const endEncounter = vi.fn(async () => {}), ended = vi.fn();
    const fake = consultationPort({listEndOutcomes: vi.fn(async () => [{code: "left-against-advice", label: "Left against advice"}]), endEncounter});
    renderClinical(<EndVisitButton encounterId="E1" version={9} onEnded={ended}/>, {port: fake.port, actor});
    fireEvent.click(screen.getByRole("button", {name: "End visit"}));
    await screen.findByRole("option", {name: "Left against advice"});
    fireEvent.change(screen.getByLabelText("How did the visit end?"), {target: {value: "left-against-advice"}});
    fireEvent.change(screen.getByLabelText("Reason", {exact: false}), {target: {value: "Patient chose to leave"}});
    fireEvent.click(screen.getByLabelText("The risks of leaving, and how to come back, were explained to the patient."));
    fireEvent.change(screen.getByLabelText("Did the patient have capacity to make this decision?"), {target: {value: "yes"}});
    fireEvent.change(screen.getByLabelText("Follow-up advice given"), {target: {value: "Return for review"}});
    fireEvent.click(screen.getByRole("button", {name: "Record"}));
    await waitFor(() => expect(ended).toHaveBeenCalledOnce());
    expect(endEncounter).toHaveBeenCalledExactlyOnceWith("E1", {outcome: "left-against-advice", version: 9, reason: "Patient chose to leave", risksExplained: true, capacity: true, formSigned: false, followUpAdvice: "Return for review"});
  });
  it("retains failed addendum text and prevents duplicate sign requests", async () => {
    const request = deferred<void>(), add = vi.fn(() => request.promise), added = vi.fn();
    const {port} = consultationPort({addNoteAddendum: add});
    renderClinical(<NoteAddenda encounterId="E1" addenda={[]} onAdded={added}/>, {port, actor});
    fireEvent.click(screen.getByRole("button", {name: "Add addendum"}));
    fireEvent.change(screen.getByLabelText("Addendum text", {exact: false}), {target: {value: "Additional synthetic information"}});
    const button = screen.getByRole("button", {name: "Sign addendum"}); fireEvent.click(button); fireEvent.click(button);
    expect(add).toHaveBeenCalledTimes(1); await act(async () => request.reject(new Error("Unable to save addendum")));
    expect(screen.getByLabelText("Addendum text", {exact: false})).toHaveValue("Additional synthetic information");
    expect(screen.getByText("Unable to save addendum")).toBeInTheDocument(); expect(added).not.toHaveBeenCalled();
  });
  it("requires a receiver synthesis and uses server handover capabilities", async () => {
    const pending: NonNullable<CareTeamData["pending"]> = {id: "H1", status: "requested", toUserId: "D2", toName: "Test Receiver", fromName: "Test Sender", requestedByName: "Test Sender", requestedAt: "2026-10-28T10:00:00Z", reason: "End of shift", ipass: {illnessSeverity: "stable", summary: "Synthetic summary", actions: "Review results", contingency: "Call if worse"}};
    const data: CareTeamData = {encounterId: "E1", class: "OP", responsible: null, team: [], history: [], pending, handovers: [], can: {handover: false, reassign: false, addMember: false, respond: true, cancel: false}, staff: [], roles: []};
    const accept = vi.fn(async () => ({...data, pending: null}));
    const {port} = consultationPort({loadCareTeam: vi.fn(async () => data), acceptHandover: accept});
    renderClinical(<CareTeam encounterId="E1"/>, {port, actor});
    const button = await screen.findByRole("button", {name: "Accept responsibility"}); expect(button).toBeDisabled();
    expect(screen.queryByRole("button", {name: "Reassign"})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Synthesis by receiver", {exact: false}), {target: {value: "I will review the results and monitor symptoms."}});
    fireEvent.click(button); await waitFor(() => expect(accept).toHaveBeenCalledExactlyOnceWith("E1", "H1", "I will review the results and monitor symptoms."));
  });
  it("sends I-PASS fields with their source names", async () => {
    const data: CareTeamData = {encounterId: "E1", class: "OP", responsible: null, team: [], history: [], pending: null, handovers: [], can: {handover: true, reassign: false, addMember: false, respond: false, cancel: false}, staff: [{id: "D2", name: "Receiver", role: "doctor"}], roles: []};
    const handover = vi.fn(async () => data), {port} = consultationPort({loadCareTeam: vi.fn(async () => data), requestHandover: handover});
    renderClinical(<CareTeam encounterId="E1"/>, {port, actor}); fireEvent.click(await screen.findByRole("button", {name: "Hand over"}));
    fireEvent.change(screen.getByLabelText("Hand over to"), {target: {value: "D2"}});
    for (const [label, value] of [["Reason", "End of shift"], ["P · Patient summary", "Synthetic patient summary"], ["A · Action list", "Review results"], ["S · Situation awareness and contingency", "Call if worse"]]) fireEvent.change(screen.getByLabelText(label!, {exact: false}), {target: {value}});
    fireEvent.click(screen.getByRole("button", {name: "Send handover"}));
    await waitFor(() => expect(handover).toHaveBeenCalledExactlyOnceWith("E1", {toUserId: "D2", reason: "End of shift", ipass: {illnessSeverity: "stable", summary: "Synthetic patient summary", actions: "Review results", contingency: "Call if worse"}}));
  });
  it("leaves extracted suggestions out of the note until explicitly accepted", async () => {
    const proposal: Proposal = {id: "S1", field: "severity", section: "hpi", label: "Severity", value: 6, display: "6/10", confidence: "high", evidence: "Patient reports six"};
    const extraction: ExtractionResult = {proposals: [proposal], sentText: "Reports six", redactions: 1, provider: "Synthetic AI"};
    const {port} = consultationPort({extractSuggestions: vi.fn(async () => extraction)});
    function Harness() {
      const [draft, setDraft] = useState(emptyNote);
      return <><output aria-label="Recorded severity">{draft.hpi.severity ?? "unset"}</output><output aria-label="Accepted suggestions">{draft.aiAccepted.length}</output><AiTray detail={consultationDetail()} draft={draft} readOnly={false} onChange={update => setDraft(previous => {const next = structuredClone(previous); update(next); return next;})}/></>;
    }
    renderClinical(<Harness/>, {port, actor}); fireEvent.change(screen.getByLabelText("Dictation or free text"), {target: {value: "Pain six out of ten"}});
    fireEvent.click(screen.getByRole("button", {name: "Suggest fields"})); await screen.findByText("6/10");
    expect(screen.getByLabelText("Recorded severity")).toHaveTextContent("unset"); fireEvent.click(screen.getByRole("button", {name: "Accept"}));
    await waitFor(() => expect(screen.getByLabelText("Recorded severity")).toHaveTextContent("6")); expect(screen.getByLabelText("Accepted suggestions")).toHaveTextContent("1");
    expect(screen.queryByRole("button", {name: "Accept"})).not.toBeInTheDocument();
  });
  it("rejects malformed suggestions without altering note contents", () => {
    const note = emptyNote(), proposal: Proposal = {id: "bad", field: "complaint", section: "complaint", label: "Complaint", display: "Bad", value: {code: 123}, confidence: "low", evidence: ""};
    expect(() => applyNoteProposal(note, proposal)).toThrow("Unsupported"); expect(note).toEqual(emptyNote());
    expect(() => applyNoteProposal(note, {...proposal, field: "ros.__proto__.polluted", value: "absent"})).toThrow("Unsupported");
  });
  it("corrects discharge with the current version and retains the server audit trail", async () => {
    const detail = consultationDetail(); detail.encounter.clinicalDischargeAt = "2026-10-28T10:00:00Z";
    const write = vi.fn(async (_id, input) => ({...detail.encounter, version: 4, clinicalDischargeAt: input.at, clinicalDischargeChanges: [{from: "2026-10-28T10:00:00Z", to: input.at, reason: input.reason, byName: "Test Doctor", at: "2026-10-28T11:00:00Z"}]}));
    const {port} = consultationPort({recordClinicalDischarge: write}), changed = vi.fn();
    renderClinical(<ClinicalDischarge encounter={detail.encounter} onRecordsChanged={changed}/>, {port, actor}); fireEvent.click(screen.getByRole("button", {name: "Correct"}));
    fireEvent.change(screen.getByLabelText("Correct time"), {target: {value: "2026-10-28T10:15"}});
    fireEvent.change(screen.getByLabelText("Reason", {exact: false}), {target: {value: "Corrected departure time"}});
    fireEvent.click(screen.getByRole("button", {name: "Save correction"})); await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(write).toHaveBeenCalledWith("E1", {at: new Date("2026-10-28T10:15").toISOString(), reason: "Corrected departure time", expectedVersion: 3});
    expect(screen.getByText(/Test Doctor/)).toBeInTheDocument();
  });
});
