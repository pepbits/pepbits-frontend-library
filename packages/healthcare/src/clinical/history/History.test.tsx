import React, {useState} from "react";
import {act, fireEvent, screen, waitFor, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {consultPort, deferred, renderOwned} from "../consult-note/test/fixtures";
import {SurgicalHistory, EditMedicine} from "./PatientHistory";
import {MedicationHistory} from "./MedicationHistory";
import {InvestigationHistory} from "./InvestigationHistory";
import type {MedHistoryResponse} from "../models/consult-records";
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(text => text.replace(/\s*\*$/, "") === label), {target: {value}});
const choose = (group: string, option: string) => fireEvent.click(within(screen.getByRole("radiogroup", {name: group})).getByRole("radio", {name: option}));
const medData = (name = "Synthetic medicine"): MedHistoryResponse => ({scope: "organisation", facility: "Test clinic", externalSource: {connected: false, note: "External feed unavailable"}, groups: [{key: "g1", display: name, external: true, past: true, latestAt: "2026-10-01", events: [{at: "2026-10-01", action: "past", text: "Completed course", meta: {pastId: "h1"}}]}]});
describe("patient and longitudinal histories", () => {
  it("marks a procedure entered in error with its version and reason, preserving failed corrections", async () => {
    const update = vi.fn().mockRejectedValueOnce(new Error("Procedure changed; reload before correcting.")).mockResolvedValue(undefined), changed = vi.fn();
    const consult = consultPort({listProcedureHistory: vi.fn().mockResolvedValue([{id: "proc1", procedure: "Synthetic procedure", verification: "confirmed", source: "patient", recordedAt: "2026-10-01", version: 7}]), updateProcedureHistory: update});
    renderOwned(<SurgicalHistory patientId="P1" canEdit onRecordsChanged={changed}/>, consult);
    fireEvent.click(await screen.findByRole("button", {name: "Edit"}));
    expect(screen.getByRole("option", {name: "Entered in error (recorded by mistake)"})).toHaveValue("entered-in-error");
    fill("Verification", "entered-in-error");
    expect(screen.getByRole("button", {name: "Save correction"})).toBeDisabled();
    fill("Reason", "Duplicate record"); fireEvent.click(screen.getByRole("button", {name: "Save correction"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Procedure changed");
    expect(screen.getByLabelText("Verification")).toHaveValue("entered-in-error"); expect(changed).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("P1", "proc1", {version: 7, reason: "Duplicate record", verification: "entered-in-error"});
    fireEvent.click(screen.getByRole("button", {name: "Save correction"}));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  });
  it("adds and confirms procedures with the recorded version", async () => {
    const consult = consultPort({listProcedureHistory: vi.fn().mockResolvedValue([{id: "proc1", procedure: "Synthetic procedure", verification: "unconfirmed", source: "patient", recordedAt: "2026-10-01", version: 7}]), updateProcedureHistory: vi.fn().mockResolvedValue(undefined), addProcedureHistory: vi.fn().mockResolvedValue(undefined)}), changed = vi.fn();
    renderOwned(<SurgicalHistory patientId="P1" canAdd canEdit onRecordsChanged={changed}/>, consult);
    fireEvent.click(await screen.findByRole("button", {name: "Confirm"})); await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(consult.updateProcedureHistory).toHaveBeenCalledWith("P1", "proc1", {version: 7, verification: "confirmed"});
    fireEvent.click(screen.getByRole("button", {name: "Add procedure"})); fill("Operation or procedure", "Another procedure"); fill("When", "2020"); fireEvent.click(screen.getAllByRole("button", {name: "Add procedure"}).at(-1)!);
    await waitFor(() => expect(consult.addProcedureHistory).toHaveBeenCalledWith("P1", {procedure: "Another procedure", performed: "2020", note: ""}));
  });
  it("requires a correction reason and preserves medicine edits after a conflict", async () => {
    const update = vi.fn().mockRejectedValueOnce(Object.assign(new Error("Conflict"), {status: 409, problems: ["Medicine changed. Reload before correcting."]})).mockResolvedValue(undefined), done = vi.fn();
    renderOwned(<EditMedicine patientId="P1" med={{id: "m1", display: "Synthetic medicine", dose: "1 mg", status: "taking", source: "patient", version: 3}} onDone={done} onCancel={() => {}}/>, consultPort({updateReportedMedication: update}));
    fill("Dose and how often", "2 mg"); expect(screen.getByRole("button", {name: "Save correction"})).toBeDisabled(); fill("Reason", "Corrected from box"); fireEvent.click(screen.getByRole("button", {name: "Save correction"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Medicine changed."); expect(screen.getByLabelText("Dose and how often")).toHaveValue("2 mg"); expect(done).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("P1", "m1", {version: 3, reason: "Corrected from box", dose: "2 mg"});
    fireEvent.click(screen.getByRole("button", {name: "Save correction"})); await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  });
  it("loads scopes, filters current medicines and withdraws a history entry with a reason", async () => {
    const consult = consultPort({loadMedicationHistory: vi.fn().mockResolvedValue(medData()), withdrawMedicationHistory: vi.fn().mockResolvedValue(undefined)}), changed = vi.fn();
    renderOwned(<MedicationHistory patientId="P1" encounterId="E1" onClose={() => {}} onRecordsChanged={changed}/>, consult);
    await screen.findByText("Synthetic medicine"); choose("Show medication history from", "Other facilities");
    await waitFor(() => expect(consult.loadMedicationHistory).toHaveBeenLastCalledWith("P1", {scope: "external", encounterId: "E1"}, expect.any(AbortSignal)));
    await screen.findByText("External feed unavailable"); fireEvent.click(screen.getByRole("checkbox", {name: "Current only"})); expect(screen.queryByText("Synthetic medicine")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", {name: "Current only"})); fireEvent.click(screen.getByRole("button", {name: "Entered in error"})); fill("Why is this entry wrong? (required)", "Duplicate record"); fireEvent.click(screen.getByRole("button", {name: "Mark entered in error"}));
    await waitFor(() => expect(consult.withdrawMedicationHistory).toHaveBeenCalledWith("P1", "h1", "Duplicate record")); await waitFor(() => expect(changed).toHaveBeenCalled());
  });
  it("adds a still-taken medicine to the current list", async () => {
    const consult = consultPort({loadMedicationHistory: vi.fn().mockResolvedValue(medData()), addReportedMedication: vi.fn().mockResolvedValue([]), addMedicationHistory: vi.fn()}), added = vi.fn();
    renderOwned(<MedicationHistory patientId="P1" encounterId="E1" onClose={() => {}} onAdded={added}/>, consult);
    await screen.findByText("Synthetic medicine"); fireEvent.click(screen.getByRole("button", {name: "Add to history"})); fireEvent.click(screen.getByRole("button", {name: "Not in the formulary? Type the name"})); fill("Medicine", "Synthetic OTC"); choose("Now", "Still taking"); choose("Prescribed or obtained", "Over the counter"); fill("Dose and how often", "Once daily");
    fireEvent.click(screen.getByRole("button", {name: "Add to current list"})); await waitFor(() => expect(added).toHaveBeenCalled());
    expect(consult.addReportedMedication).toHaveBeenCalledWith("P1", {drugCode: undefined, display: "Synthetic OTC", dose: "Once daily", status: "taking", encounterId: "E1", externalFacility: undefined}); expect(consult.addMedicationHistory).not.toHaveBeenCalled();
  });
  it("records completed courses with dates, source, and default completion reason", async () => {
    const consult = consultPort({loadMedicationHistory: vi.fn().mockResolvedValue(medData()), addMedicationHistory: vi.fn().mockResolvedValue(undefined)});
    renderOwned(<MedicationHistory patientId="P1" encounterId="E1" onClose={() => {}}/>, consult);
    await screen.findByText("Synthetic medicine"); fireEvent.click(screen.getByRole("button", {name: "Add to history"})); fireEvent.click(screen.getByRole("button", {name: "Not in the formulary? Type the name"})); fill("Medicine", "Synthetic course"); fill("Started (month)", "2025-01"); fill("Finished (month)", "2025-02"); fireEvent.click(screen.getAllByRole("button", {name: "Add to history"}).at(-1)!);
    await waitFor(() => expect(consult.addMedicationHistory).toHaveBeenCalledWith("P1", expect.objectContaining({display: "Synthetic course", status: "completed", origin: "organisation", started: "2025-01", stopped: "2025-02", source: "patient", stopReason: "completed-course", encounterId: "E1"})));
  });
  it("aborts old patient reads and ignores a late response", async () => {
    const old = deferred<MedHistoryResponse>(), load = vi.fn((id: string, _query: unknown, _signal?: AbortSignal) => id === "P1" ? old.promise : Promise.resolve(medData("New patient's medicine")));
    function Switch() {const [patient, setPatient] = useState("P1"); return <><button onClick={() => setPatient("P2")}>Switch</button><MedicationHistory patientId={patient} encounterId="E1" onClose={() => {}}/></>;}
    renderOwned(<Switch/>, consultPort({loadMedicationHistory: load})); await waitFor(() => expect(load).toHaveBeenCalled()); const signal = load.mock.calls[0]![2]!;
    fireEvent.click(screen.getByText("Switch")); await screen.findByText("New patient's medicine"); expect(signal.aborted).toBe(true);
    await act(async () => old.resolve(medData("Old patient's medicine"))); expect(screen.queryByText("Old patient's medicine")).not.toBeInTheDocument();
  });
  it("offers load recovery without claiming an empty history", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("History unavailable")).mockResolvedValue(medData()); renderOwned(<MedicationHistory patientId="P1" encounterId="E1" onClose={() => {}}/>, consultPort({loadMedicationHistory: load}));
    const alert = await screen.findByRole("alert"); expect(alert).toHaveTextContent("History unavailable"); fireEvent.click(within(alert).getByRole("button")); await screen.findByText("Synthetic medicine");
  });
  it("adds an outside lab result and switches to the external scope", async () => {
    const consult = consultPort({loadInvestigationHistory: vi.fn().mockResolvedValue({groups: [], externalSource: {connected: false, note: "Unavailable"}}), addExternalResult: vi.fn().mockResolvedValue(undefined)}), changed = vi.fn();
    renderOwned(<InvestigationHistory patientId="P1" encounterId="E1" kind="lab" onClose={() => {}} onRecordsChanged={changed}/>, consult);
    fireEvent.click(screen.getByRole("button", {name: "Add outside result"})); fill("Test", "Synthetic HbA1c"); fill("Date", "2026-01-01"); fill("Facility", "__other"); fill("Facility: name", "Test laboratory"); fill("Result", "8.1"); fill("Unit", "%"); fill("Flag", "abnormal"); fireEvent.click(screen.getByRole("button", {name: "Add result"}));
    await waitFor(() => expect(consult.addExternalResult).toHaveBeenCalledWith("P1", expect.objectContaining({kind: "lab", test: "Synthetic HbA1c", performed: "2026-01-01", facility: "Test laboratory", value: "8.1", unit: "%", flag: "abnormal", encounterId: "E1"})));
    await waitFor(() => expect(consult.loadInvestigationHistory).toHaveBeenLastCalledWith("P1", {kind: "lab", scope: "external", encounterId: "E1"}, expect.any(AbortSignal))); expect(changed).toHaveBeenCalled();
  });
  it("adds an outside procedure through procedure history", async () => {
    const consult = consultPort({loadInvestigationHistory: vi.fn().mockResolvedValue({groups: [], externalSource: {connected: true, note: ""}}), addProcedureHistory: vi.fn().mockResolvedValue(undefined)});
    renderOwned(<InvestigationHistory patientId="P1" encounterId="E1" kind="procedure" onClose={() => {}}/>, consult);
    fireEvent.click(screen.getByRole("button", {name: "Add past procedure"})); fill("Procedure", "Synthetic surgery"); fill("When (year, month or date)", "2019"); choose("Where", "Another facility"); fill("Facility", "__other"); fill("Facility: name", "Test hospital"); fireEvent.click(screen.getByRole("button", {name: "Add procedure"}));
    await waitFor(() => expect(consult.addProcedureHistory).toHaveBeenCalledWith("P1", {procedure: "Synthetic surgery", performed: "2019", note: "", facility: "Test hospital"}));
  });
  it("read-only histories expose no write actions", async () => {
    renderOwned(<MedicationHistory patientId="P1" encounterId="E1" onClose={() => {}} readOnly/>, consultPort({loadMedicationHistory: vi.fn().mockResolvedValue(medData())})); await screen.findByText("Synthetic medicine"); expect(screen.queryByRole("button", {name: "Add to history"})).not.toBeInTheDocument(); expect(screen.queryByRole("button", {name: "Entered in error"})).not.toBeInTheDocument();
  });
});
