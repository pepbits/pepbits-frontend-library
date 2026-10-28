import React from "react";
import {describe, expect, it, vi} from "vitest";
import {act, fireEvent, screen, waitFor} from "@testing-library/react";
import {RecordVitals} from "./RecordVitals";
import {ObservationCorrectionForm, VisitReadings} from "./Corrections";
import {Trends} from "./Trends";
import {FALLBACK_PARAMETERS, type VitalParameterCatalogue} from "../models/consult-records";
import {consultation, findingsPort, FindingsHost, renderFindings, sectionProps} from "../consult-records/test-fixtures";
import {LOINC, type Observation} from "../types";
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});
const complete = () => {fill("Systolic", "128"); fill("Diastolic", "82"); fill("Heart rate", "76"); fill("Respiratory rate", "16"); fill("Body temperature", "36.8"); fill("Oxygen saturation", "98"); fill("Breathing", "air"); fill("Consciousness (ACVPU)", "A");};
const reading: Observation = {id: "O1", encounterId: "E1", code: LOINC.bp, display: "Blood pressure", value: 120, value2: 80, version: 6, effectiveAt: "2026-10-28T08:00:00Z", authorId: "N1"};

describe("RecordVitals", () => {
  it("records configured additional measurements, custom ranges, and unmeasured reasons without copying previous readings", async () => {
    const parameters = [...FALLBACK_PARAMETERS.map(p => p.key === "hr" ? {...p, max: 120} : p), {...FALLBACK_PARAMETERS[1]!, key: "pefr", code: "PEFR", display: "Peak flow", label: "Peak flow", unit: "L/min", unitDisplay: "L/min", min: 1, max: 900}];
    const port = findingsPort({loadVitalParameters: vi.fn(async () => ({items: parameters, correctionGraceSeconds: 60, maxBackdateHours: 4}))}), changed = vi.fn();
    renderFindings(<RecordVitals encounterId="E1" latest={{[LOINC.hr]: {...reading, code: LOINC.hr, value: 99}}} onRecordsChanged={changed}/>, port);
    await screen.findByLabelText("Peak flow"); expect(screen.getByLabelText("Heart rate")).toHaveValue(null);
    complete(); fill("Heart rate", "150"); fill("Peak flow", "450"); fireEvent.click(screen.getByRole("button", {name: "Save vitals"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("120"); expect(port.consult.recordVitals).not.toHaveBeenCalled();
    fill("Reason not measured: Heart rate", "refused"); expect(screen.getByLabelText("Heart rate")).toHaveValue(null);
    fireEvent.click(screen.getByRole("button", {name: "Save vitals"})); await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(port.consult.recordVitals).toHaveBeenCalledWith("E1", expect.objectContaining({sbp: 128, dbp: 82, hr: null, pefr: 450, notMeasured: {hr: "refused"}, o2: "air", acvpu: "A"}));
  });
  it("keeps measurements after a rejected write and rejects future measurement times", async () => {
    const port = findingsPort({recordVitals: vi.fn().mockRejectedValue(new Error("Visit changed"))}); renderFindings(<RecordVitals encounterId="E1"/>, port);
    await screen.findByLabelText("Heart rate"); complete(); fill("Measured at", "2099-01-01T10:00"); fireEvent.click(screen.getByRole("button", {name: "Save vitals"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot be in the future"); expect(port.consult.recordVitals).not.toHaveBeenCalled();
    fill("Measured at", ""); fireEvent.click(screen.getByRole("button", {name: "Save vitals"})); expect(await screen.findByRole("alert")).toHaveTextContent("Visit changed"); expect(screen.getByLabelText("Heart rate")).toHaveValue(76);
  });
  it("fences parameter loads on host replacement and clears the previous host's draft", async () => {
    let resolve!: (data: VitalParameterCatalogue) => void;
    const first = findingsPort(), second = findingsPort({loadVitalParameters: vi.fn(() => new Promise<VitalParameterCatalogue>(r => {resolve = r;}))});
    const ui = <RecordVitals encounterId="E1"/>; const view = renderFindings(ui, first);
    await screen.findByLabelText("Heart rate"); fill("Heart rate", "88");
    view.rerender(<FindingsHost port={second}>{ui}</FindingsHost>);
    expect(screen.queryByLabelText("Heart rate")).not.toBeInTheDocument();
    await act(async () => resolve({items: FALLBACK_PARAMETERS, correctionGraceSeconds: 0, maxBackdateHours: 1}));
    expect(await screen.findByLabelText("Heart rate")).toHaveValue(null);
  });
});
describe("observation corrections", () => {
  it("requires a reason and sends both pressure values with the original version", async () => {
    const port = findingsPort(), changed = vi.fn(); renderFindings(<ObservationCorrectionForm observation={reading} onRecordsChanged={changed}/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Correct"})); fill("Systolic", "130"); fill("Diastolic", "85");
    expect(screen.getByRole("button", {name: "Save correction"})).toBeDisabled(); fill("Reason", "Transcription error"); fireEvent.click(screen.getByRole("button", {name: "Save correction"}));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(port.consult.correctObservation).toHaveBeenCalledWith("O1", {version: 6, reason: "Transcription error", value: 130, value2: 85});
  });
  it("withdraws an absent reading without replacing its measurement", async () => {
    const port = findingsPort(); renderFindings(<ObservationCorrectionForm observation={{...reading, code: "absent:hr", absentReason: "refused", value: undefined, value2: undefined}}/>, port);
    expect(screen.queryByRole("button", {name: "Correct"})).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", {name: "Entered in error"})); fill("Reason", "Wrong patient record"); fireEvent.click(screen.getByRole("button", {name: "Mark entered in error"}));
    await waitFor(() => expect(port.consult.withdrawObservation).toHaveBeenCalledWith("O1", {version: 6, reason: "Wrong patient record"})); expect(port.consult.correctObservation).not.toHaveBeenCalled();
  });
  it("applies the configured grace period only to the recorder's own entry", async () => {
    const port = findingsPort(); renderFindings(<ObservationCorrectionForm observation={{...reading, enteredAt: new Date().toISOString()}} mine graceSeconds={60}/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Correct"})); fill("Systolic", "125"); fireEvent.click(screen.getByRole("button", {name: "Save correction"}));
    await waitFor(() => expect(port.consult.correctObservation).toHaveBeenCalledWith("O1", {version: 6, reason: "", value: 125, value2: 80}));
  });
  it("keeps a correction on conflict and blocks closed-visit changes", async () => {
    const port = findingsPort({correctObservation: vi.fn().mockRejectedValue(Object.assign(new Error("Stale observation version"), {status: 409}))});
    const view = renderFindings(<ObservationCorrectionForm observation={reading}/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Correct"})); fill("Systolic", "129"); fill("Reason", "Corrected transcription"); fireEvent.click(screen.getByRole("button", {name: "Save correction"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Stale observation version"); expect(screen.getByLabelText("Systolic")).toHaveValue(129);
    const detail = consultation(); detail.encounter.status = "signed"; detail.observations.history = [reading];
    view.rerender(<FindingsHost port={port}><VisitReadings detail={detail}/></FindingsHost>);
    expect(screen.queryByRole("button", {name: "Correct"})).not.toBeInTheDocument();
  });
});
it("trends exclude withdrawn readings and show dates with the configured formatter", () => {
  renderFindings(<Trends observations={[reading, {...reading, id: "O2", value: 240, status: "entered-in-error"}]} parameters={[FALLBACK_PARAMETERS[0]!]}/>);
  expect(screen.getByText(/120\/80/)).toBeInTheDocument(); expect(screen.queryByText(/240/)).not.toBeInTheDocument();
});

it("never shows the previous port's NEWS2 result after host replacement", async () => {
  const {useNews2} = await import("./News2Panel");
  const {EMPTY_VITALS} = await import("./model");
  function Preview() {const {news} = useNews2(EMPTY_VITALS, {}, FALLBACK_PARAMETERS); return <output aria-label="Preview score">{news?.total ?? "Waiting"}</output>;}
  const first = findingsPort({calculateScore: vi.fn(async () => ({status: "complete" as const, total: 8, interpretation: "First host", components: [], missing: []}))}), second = findingsPort({calculateScore: vi.fn(async () => ({status: "complete" as const, total: 2, interpretation: "Second host", components: [], missing: []}))});
  const view = renderFindings(<Preview/>, first);
  await waitFor(() => expect(screen.getByLabelText("Preview score")).toHaveTextContent("8"));
  view.rerender(<FindingsHost port={second}><Preview/></FindingsHost>);
  expect(screen.getByLabelText("Preview score")).toHaveTextContent("Waiting");
  await waitFor(() => expect(screen.getByLabelText("Preview score")).toHaveTextContent("2"));
});

it("shows configured current vitals, corrected status, withdrawn values, and saved NEWS2 in the review", async () => {
  const {ReviewSection} = await import("../consult-records/ReviewSection");
  const detail = consultation(); detail.observations.latest = {[LOINC.bp]: {...reading, status: "corrected"}}; detail.observations.history = [reading]; detail.observations.enteredInError = [{...reading, id: "OLD-HR", code: LOINC.hr, value: 210, status: "entered-in-error"}];
  detail.scores = [{id: "NEWS1", methodId: "news2", total: 5, band: "Medium", calculatedAt: "2026-10-28T08:00:00Z"}];
  renderFindings(<ReviewSection {...sectionProps(detail)}/>);
  const summary = screen.getByRole("group", {name: "Vital signs summary"});
  expect(summary).toHaveTextContent("Corrected"); expect(summary).toHaveTextContent("120/80"); expect(summary).toHaveTextContent("Entered in error"); expect(summary).not.toHaveTextContent("210"); expect(summary).toHaveTextContent("Medium");
  expect(screen.getByRole("button", {name: "Repeat vitals"})).toBeInTheDocument();
});

it("retains a correction's original version across a background record refresh", async () => {
  const port = findingsPort({correctObservation: vi.fn().mockRejectedValue(new Error("Observation changed elsewhere"))});
  const view = renderFindings(<ObservationCorrectionForm observation={reading}/>, port);
  fireEvent.click(screen.getByRole("button", {name: "Correct"})); fill("Systolic", "125"); fill("Reason", "Corrected transcription");
  view.rerender(<FindingsHost port={port}><ObservationCorrectionForm observation={{...reading, version: 7, value: 135}}/></FindingsHost>);
  fireEvent.click(screen.getByRole("button", {name: "Save correction"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Observation changed elsewhere");
  expect(port.consult.correctObservation).toHaveBeenCalledWith("O1", {version: 6, reason: "Corrected transcription", value: 125, value2: 80});
  expect(screen.getByLabelText("Systolic")).toHaveValue(125);
});
