import React from "react";
import {describe, expect, it, vi} from "vitest";
import {act, fireEvent, screen, waitFor, within} from "@testing-library/react";
import {PainAssessmentForm, PainSection} from "./PainSection";
import {BodyMapPicker} from "./BodyMap";
import {painErrors, painPayload, painTotal, emptySite} from "./model";
import {findingsPort, FindingsHost, host, maps, nrs, renderFindings, sectionProps} from "../consult-records/test-fixtures";
import type {Codesets} from "../models/consult-records";
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});
const score = (value: string) => fireEvent.click(within(screen.getByRole("radiogroup", {name: "Numeric rating scale"})).getByRole("radio", {name: value}));

describe("pain assessments", () => {
  it("records a complete pain score and propagates the server alert", async () => {
    const port = findingsPort({recordPain: vi.fn(async () => ({alert: "Pain above goal"}))}), saved = vi.fn(), notify = vi.fn();
    renderFindings(<PainAssessmentForm patientId="P1" encounterId="E1" onSaved={saved}/>, port, notify);
    await screen.findByLabelText("Pain scale"); fireEvent.click(screen.getByRole("button", {name: "Save pain assessment"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Complete the pain scale"); expect(port.consult.recordPain).not.toHaveBeenCalled();
    score("8"); fireEvent.click(screen.getByRole("button", {name: "Add pain details and goal"})); fill("Acceptable pain goal", "3"); fill("Pain notes", "Synthetic assessment");
    fireEvent.click(screen.getByRole("button", {name: "Save pain assessment"}));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(port.consult.recordPain).toHaveBeenCalledWith("E1", expect.objectContaining({scale: "nrs", score: 8, items: {}, goal: 3, details: expect.objectContaining({sites: [], note: "Synthetic assessment"})}));
    expect(notify).toHaveBeenCalledWith("Saved. Pain above goal; the doctor has been notified.", {tone: "warning"});
  });
  it("supports keyboard map selection, per-site scores, and rejects an overall score below the worst site", async () => {
    const port = findingsPort(); renderFindings(<PainAssessmentForm patientId="P1" encounterId="E1" onSaved={() => {}}/>, port);
    await screen.findByLabelText("Pain scale"); score("4"); fireEvent.click(screen.getByRole("button", {name: "Where is the pain?"}));
    fireEvent.keyDown(screen.getByRole("checkbox", {name: "Right knee"}), {key: "Enter"});
    expect(screen.getByRole("checkbox", {name: "Right knee"})).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("checkbox", {name: "Left knee"}), {key: " "});
    fill("Score at Right Knee (ANTERIOR)", "8");
    fireEvent.click(screen.getByRole("button", {name: "Save pain assessment"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("lower than the worst site"); expect(port.consult.recordPain).not.toHaveBeenCalled();
    score("8"); fireEvent.click(screen.getByRole("button", {name: "Save pain assessment"}));
    await waitFor(() => expect(port.consult.recordPain).toHaveBeenCalled());
    const input = vi.mocked(port.consult.recordPain).mock.calls[0]![1];
    expect(input.details?.sites).toHaveLength(2); expect(input.details?.sites?.[0]).toMatchObject({part: "KNEE", side: "RIGHT", aspect: "ANTERIOR", mapId: "adult", regionId: "knee-r", score: 8});
  });
  it("keeps the score and goal when recording fails", async () => {
    const port = findingsPort({recordPain: vi.fn().mockRejectedValue(new Error("Pain service unavailable"))});
    renderFindings(<PainAssessmentForm encounterId="E1" onSaved={() => {}}/>, port);
    await screen.findByLabelText("Pain scale"); score("5"); fireEvent.click(screen.getByRole("button", {name: "Add pain details and goal"})); fill("Acceptable pain goal", "2"); fireEvent.click(screen.getByRole("button", {name: "Save pain assessment"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pain service unavailable"); expect(screen.getByLabelText("Acceptable pain goal")).toHaveValue(2); expect(within(screen.getByRole("radiogroup", {name: "Numeric rating scale"})).getByRole("radio", {name: "5"})).toHaveAttribute("aria-checked", "true");
  });
  it("does not leak codesets or maps across port instances", async () => {
    let resolve!: (codes: Codesets) => void;
    const first = findingsPort({loadCodesets: vi.fn(() => new Promise<Codesets>(r => {resolve = r;}))}), second = findingsPort({listPainScales: vi.fn(async () => [{...nrs, name: "Second tenant scale"}])});
    const ui = <PainAssessmentForm encounterId="E1" patientId="P1" onSaved={() => {}}/>; const view = renderFindings(ui, first);
    view.rerender(<FindingsHost port={second}>{ui}</FindingsHost>); await screen.findByRole("option", {name: "Second tenant scale"});
    await act(async () => resolve({"body-part": [{code: "OLD", display: "Old tenant body part"}]}));
    fireEvent.click(screen.getByRole("button", {name: "Where is the pain?"}));
    expect(screen.queryByRole("option", {name: "Old tenant body part"})).not.toBeInTheDocument(); expect(vi.mocked(first.consult.loadCodesets).mock.calls[0]![0]!.aborted).toBe(true);
  });
  it("loads pain history and leaves PRN reassessment navigation to the host", async () => {
    const port = findingsPort({loadPainHistory: vi.fn(async () => ({assessments: [{id: "PA1", encounterId: "E1", scale: "nrs", scaleName: "NRS", value: 8, min: 0, max: 10, band: "severe", normalised: 80, effectiveAt: "2026-10-28T08:00:00Z"}], analgesia: [], reassessments: [{administrationId: "MAR1", encounterId: "E1", medicine: "Synthetic analgesic", givenAt: "2026-10-28T08:00:00Z", dueAt: "2026-10-28T09:00:00Z", overdue: true}], suggested: {scale: "nrs", reason: "Self report"}}))});
    renderFindings(<PainSection {...sectionProps()} readOnly/>, port);
    fireEvent.click(await screen.findByRole("button", {name: "Record in Medication administration"}));
    expect(host.onNavigate).toHaveBeenCalledWith({kind: "mar", encounterId: "E1"}); expect(screen.queryByRole("button", {name: "Assess pain"})).not.toBeInTheDocument();
  });
});
it("observational scales require every item and save body sites without individual scores", () => {
  const scale = {...nrs, id: "observational", items: [{key: "face", label: "Face", options: [{score: 0, label: "Relaxed"}, {score: 2, label: "Grimace"}]}, {key: "activity", label: "Activity", options: [{score: 0, label: "Still"}, {score: 2, label: "Restless"}]}]};
  expect(painTotal(scale, {scale: scale.id, items: {face: 2}})).toBeUndefined();
  const input = {scale: scale.id, items: {face: 2, activity: 2}};
  expect(painTotal(scale, input)).toBe(4);
  const sites = [emptySite("KNEE", "RIGHT", "", {score: 8})];
  expect(painPayload(input, scale, sites, {}, "3").details?.sites?.[0]?.score).toBeNull(); expect(painErrors(scale, input, sites, "3")).toEqual([]);
});
