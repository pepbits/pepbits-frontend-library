import React, {useState} from "react";
import {act, fireEvent, screen, waitFor, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {consultPort, Controlled, deferred, detail, renderOwned} from "../consult-note/test/fixtures";
import type {ScoreDef, ScoreResult} from "../types";
import type {ScoreAutofill} from "../models/consult-records";
import {ScoreCalculator} from "./ScoreCalculator";
import {ScoresSection} from "./ScoresSection";
const def: ScoreDef = {id: "synthetic", short: "Test score", name: "Synthetic score", category: "test", version: "1", purpose: "Synthetic", citation: "Test only", licence: "Synthetic", inputs: [{key: "hr", label: "Pulse", kind: "number", autofill: "hr"}, {key: "creatinine", label: "Creatinine", kind: "number", autofill: "creatinine"}, {key: "stale", label: "Older lab", kind: "number", autofill: "stale"}]};
const result: ScoreResult = {status: "complete", total: 4, band: "Test band", interpretation: "Synthetic result", components: [], missing: []};
const autofill: ScoreAutofill = {hr: {value: 75, source: "vital", at: "2026-10-28T10:00:00Z", label: "Pulse"}, creatinine: {value: 1.2, source: "lab", at: "2026-10-27T10:00:00Z", label: "Creatinine", unit: "mg/dL", original: "106 µmol/L", status: "final"}, stale: {value: 99, source: "lab", at: "2020-01-01", label: "Old", stale: true, windowHours: 24}};
describe("clinical scores", () => {
  it("fills confirmed diagnosis flags only, explains provisional diagnoses and preserves manual No answers", async () => {
    const flags: ScoreDef = {...def, inputs: ["confirmed", "provisional", "missing", "manual"].map(key => ({key, label: key, kind: "flag", autofill: key}))};
    const pending = deferred<ScoreAutofill>(), consult = consultPort({loadScoreAutofill: vi.fn().mockReturnValue(pending.promise), calculateScore: vi.fn().mockResolvedValue(result), saveScore: vi.fn().mockResolvedValue({id: "s1", total: 4})});
    renderOwned(<ScoreCalculator def={flags} patientId="P1" encounterId="E1"/>, consult);
    const group = (name: string) => within(screen.getByRole("radiogroup", {name}));
    fireEvent.click(group("manual").getByRole("radio", {name: "No"}));
    await act(async () => pending.resolve({
      confirmed: {source: "condition", value: true, at: null, label: "Synthetic confirmed condition", where: "problem list", status: "resolved"},
      provisional: {source: "condition", value: true, at: null, label: "Synthetic provisional condition", unconfirmed: true, verification: "provisional", where: "encounter"},
      manual: {source: "condition", value: true, at: null, label: "Synthetic manual condition"},
    }));
    expect(consult.loadScoreAutofill).toHaveBeenCalledWith("P1", "E1", expect.any(AbortSignal));
    expect(group("confirmed").getByRole("radio", {name: "Yes"})).toBeChecked();
    expect(group("manual").getByRole("radio", {name: "No"})).toBeChecked();
    for (const key of ["provisional", "missing"]) for (const radio of group(key).getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(screen.getByText("Diagnosis: Synthetic confirmed condition · problem list · resolved")).toBeInTheDocument();
    expect(screen.getByText("Provisional diagnosis on the encounter: Synthetic provisional condition. Not used; confirm it or answer yourself")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", {name: "Save to record"})).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", {name: "Save to record"}));
    await waitFor(() => expect(consult.saveScore).toHaveBeenCalledWith("synthetic", {patientId: "P1", encounterId: "E1", inputs: {confirmed: true, manual: false}}));
    fireEvent.click(group("confirmed").getByRole("radio", {name: "No"}));
    expect(screen.getByText("Changed by you · record value Yes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Refill from record"}));
    await waitFor(() => expect(consult.loadScoreAutofill).toHaveBeenCalledTimes(2));
    expect(group("confirmed").getByRole("radio", {name: "No"})).toBeChecked();
  });
  it("reloads diagnosis autofill for a new encounter and ignores the previous encounter's response", async () => {
    const flags: ScoreDef = {...def, inputs: [{key: "condition", label: "Condition", kind: "flag", autofill: "condition"}]};
    const old = deferred<ScoreAutofill>(), load = vi.fn((_patient: string, encounter?: string, _signal?: AbortSignal) => encounter === "E1" ? old.promise : Promise.resolve<ScoreAutofill>({}));
    function Switch() {const [encounter, setEncounter] = useState("E1"); return <><button onClick={() => setEncounter("E2")}>Switch encounter</button><ScoreCalculator def={flags} patientId="P1" encounterId={encounter}/></>;}
    renderOwned(<Switch/>, consultPort({loadScoreAutofill: load, calculateScore: vi.fn().mockResolvedValue(result)}));
    await waitFor(() => expect(load).toHaveBeenCalledWith("P1", "E1", expect.any(AbortSignal)));
    const signal = load.mock.calls[0]![2]!;
    fireEvent.click(screen.getByText("Switch encounter"));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith("P1", "E2", expect.any(AbortSignal)));
    expect(signal.aborted).toBe(true);
    await act(async () => old.resolve({condition: {source: "condition", value: true, at: null, label: "Old diagnosis"}}));
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(screen.queryByText(/Old diagnosis/)).not.toBeInTheDocument();
  });
  it("autofills vitals and recent lab results, excludes stale data and saves exact inputs", async () => {
    const consult = consultPort({loadScoreAutofill: vi.fn().mockResolvedValue(autofill), calculateScore: vi.fn().mockResolvedValue(result), saveScore: vi.fn().mockResolvedValue({id: "s1", total: 4, band: "Test band"})}), saved = vi.fn();
    renderOwned(<ScoreCalculator def={def} patientId="P1" encounterId="E1" onSaved={saved}/>, consult);
    await waitFor(() => expect(screen.getByLabelText("Pulse")).toHaveValue(75)); expect(screen.getByLabelText("Creatinine")).toHaveValue(1.2); expect(screen.getByLabelText("Older lab")).toHaveValue(null); expect(screen.getByText(/hours; not used/)).toBeInTheDocument(); expect(screen.getByText(/reported as 106/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", {name: "Save to record"})).not.toBeDisabled()); fireEvent.click(screen.getByRole("button", {name: "Save to record"}));
    await waitFor(() => expect(consult.saveScore).toHaveBeenCalledWith("synthetic", {patientId: "P1", encounterId: "E1", inputs: {hr: 75, creatinine: 1.2}})); expect(saved).toHaveBeenCalledWith({id: "s1", total: 4, band: "Test band"});
  });
  it("does not overwrite a manually entered input when autofill resolves late", async () => {
    const pending = deferred<ScoreAutofill>(); renderOwned(<ScoreCalculator def={def} patientId="P1"/>, consultPort({loadScoreAutofill: vi.fn().mockReturnValue(pending.promise), calculateScore: vi.fn().mockResolvedValue(result)}));
    fireEvent.change(screen.getByLabelText("Pulse"), {target: {value: "88"}}); await act(async () => pending.resolve(autofill)); expect(screen.getByLabelText("Pulse")).toHaveValue(88); expect(screen.getByLabelText("Creatinine")).toHaveValue(1.2);
  });
  it("disables saving until the current inputs have a complete preview and preserves failed saves", async () => {
    const next = deferred<ScoreResult>(), calculate = vi.fn().mockResolvedValueOnce(result).mockReturnValue(next.promise), save = vi.fn().mockRejectedValue(new Error("Score write failed"));
    renderOwned(<ScoreCalculator def={{...def, inputs: [{key: "value", kind: "number", label: "Value"}]}} patientId="P1"/>, consultPort({calculateScore: calculate, saveScore: save}));
    await waitFor(() => expect(screen.getByRole("button", {name: "Save to record"})).not.toBeDisabled()); fireEvent.change(screen.getByLabelText("Value"), {target: {value: "6"}}); expect(screen.getByRole("button", {name: "Save to record"})).toBeDisabled();
    await waitFor(() => expect(calculate).toHaveBeenCalledWith("synthetic", {value: 6}, expect.any(AbortSignal))); await act(async () => next.resolve(result));
    fireEvent.click(screen.getByRole("button", {name: "Save to record"})); expect(await screen.findByRole("alert")).toHaveTextContent("Score write failed"); expect(screen.getByLabelText("Value")).toHaveValue(6);
  });
  it("clears inputs on patient replacement and ignores old autofill", async () => {
    const old = deferred<ScoreAutofill>(), load = vi.fn((patient: string) => patient === "P1" ? old.promise : Promise.resolve<ScoreAutofill>({}));
    function Switch() {const [patient, setPatient] = useState("P1"); return <><button onClick={() => setPatient("P2")}>Switch</button><ScoreCalculator def={def} patientId={patient}/></>;}
    renderOwned(<Switch/>, consultPort({loadScoreAutofill: load, calculateScore: vi.fn().mockResolvedValue(result)})); fireEvent.change(screen.getByLabelText("Pulse"), {target: {value: "80"}}); fireEvent.click(screen.getByText("Switch"));
    await act(async () => old.resolve(autofill)); expect(screen.getByLabelText("Pulse")).toHaveValue(null);
  });
  it("shows signed assessment snapshots and score history without editing the note", async () => {
    const data = detail(); data.note = {id: "n1", status: "final", version: 1, content: {}, updatedAt: "2026-10-28", assessments: [{id: "a1", toolId: "t1", status: "final", label: "Signed tool", number: "A001", revision: 2, result: "4", band: "Test", signedByName: "Synthetic clinician"}]}; data.scores = [{id: "s1", methodId: "synthetic", total: 4, band: "Test band", calculatedAt: "2026-10-28"}];
    const consult = consultPort({listScoreDefinitions: vi.fn().mockResolvedValue([def])}); renderOwned(<Controlled component={ScoresSection} data={data} readOnly/>, consult);
    expect(screen.getByRole("link", {name: "Signed tool"})).toHaveAttribute("data-kind", "assessment"); fireEvent.click(screen.getByRole("button", {name: "Score history"})); await screen.findByText(/Test score · 4/); expect(screen.queryByLabelText("Clinical score")).not.toBeInTheDocument();
  });
});
