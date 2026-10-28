import React from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, screen, waitFor, within} from "@testing-library/react";
import {IntakeForm} from "./IntakeForm";
import {EMERGENCY_TRIAGE} from "../context/profiles";
import {renderClinical} from "../test/host";
import {encounterDetail, fakePort} from "../test/fixtures";

const fill = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});
const choose = (group: string, option: string) => fireEvent.click(within(screen.getByRole("radiogroup", {name: group})).getByRole("radio", {name: option}));
const erPort = (overrides: Parameters<typeof fakePort>[0] = {}) => fakePort({
  loadEncounter: vi.fn(async () => encounterDetail({class: "ER", status: "waiting-triage", department: "Emergency", reason: "Chest pain"})),
  searchCatalog: vi.fn(async () => [{code: "29857009", system: "http://snomed.info/sct", display: "Chest pain"}]),
  saveIntake: vi.fn(async () => ({news2: {status: "complete" as const, total: 3, interpretation: "", components: [], missing: []}, esi: {finalLevel: 1}})),
  ...overrides,
});
const openTriage = async (port = erPort(), extra: {onSaved?: () => void; notify?: () => void} = {}) => {
  renderClinical(<IntakeForm encounterId="E1" profile={EMERGENCY_TRIAGE} onSaved={extra.onSaved ?? (() => {})} onCancel={() => {}}/>, {port, notify: extra.notify});
  await screen.findByRole("heading", {name: "Test Patient"});
  return port;
};

describe("IntakeForm with the emergency triage profile", () => {
  it("keeps the visit waiting for triage and adds arrival mode and ESI", async () => {
    const port = await openTriage();
    expect(port.setEncounterStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("radiogroup", {name: "Arrived by"})).toBeInTheDocument();
    expect(screen.getByRole("region", {name: "Emergency Severity Index"})).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", {name: "Thoughts of harming themselves"})).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", {name: "High-risk situation?"})).not.toBeInTheDocument();
  });

  it("requires the complaint and a triage level", async () => {
    const port = await openTriage();
    fireEvent.click(screen.getByRole("button", {name: "Save triage"}));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Choose the presenting complaint.");
    expect(alert).toHaveTextContent("Complete the triage decision points.");
    expect(port.saveIntake).not.toHaveBeenCalled();
  });

  it("walks the decision points to a danger-zone level and saves an override with its reason", async () => {
    const onSaved = vi.fn(), notify = vi.fn();
    const port = await openTriage(erPort(), {onSaved, notify});
    const search = screen.getByRole("combobox", {name: "Presenting complaint"});
    fireEvent.change(search, {target: {value: "chest"}});
    await screen.findByRole("option", {name: /Chest pain/});
    fireEvent.keyDown(search, {key: "ArrowDown"}); fireEvent.keyDown(search, {key: "Enter"});
    choose("Arrived by", "Ambulance");
    fill("Systolic", "100"); fill("Diastolic", "60"); fill("Heart rate", "128"); fill("Respiratory rate", "24"); fill("Temperature", "37.9"); fill("SpO₂", "95");
    choose("Air or oxygen", "Room air"); choose("ACVPU", "Alert"); choose("Allergy review outcome", "No known allergies");
    choose("Needs an immediate life-saving intervention?", "No");
    choose("High-risk situation?", "No"); choose("New confusion, lethargy or disorientation?", "No"); choose("Severe pain or distress (7/10 or more)?", "No");
    choose("Resources", "Two or more");
    expect(await screen.findByRole("img", {name: "ESI level 2"})).toBeInTheDocument();
    expect(screen.getByText("Danger-zone vital signs: consider ESI 2.")).toBeInTheDocument();
    expect(port.previewEsi).toHaveBeenLastCalledWith({lifeSaving: false, highRisk: false, confusedLethargic: false, severePain: false, resources: 2, ageYears: 40, hr: 128, rr: 24, spo2: 95}, expect.anything());

    fireEvent.change(screen.getByLabelText("Change level (optional)"), {target: {value: "1"}});
    fireEvent.click(screen.getByRole("button", {name: "Save triage"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Give a reason for changing the calculated triage level.");
    fill(/Reason for change/, "Deteriorating in the waiting room");
    fireEvent.change(screen.getByLabelText("Send to area"), {target: {value: "Resuscitation"}});
    fireEvent.click(screen.getByRole("button", {name: "Save triage"}));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(port.saveIntake).toHaveBeenCalledWith("E1", expect.objectContaining({
      mode: "er", complaint: {code: "29857009", display: "Chest pain", patientWords: undefined}, arrival: {mode: "ambulance", historySource: "patient", interpreter: false},
      esi: {lifeSaving: false, highRisk: false, confusedLethargic: false, severePain: false, resources: 2, overrideLevel: 1, overrideReason: "Deteriorating in the waiting room"},
      disposition: {area: "Resuscitation"},
    }));
    expect(notify).toHaveBeenCalledWith("Triage saved: ESI 1. Doctor review task created.", {tone: "success"});
  });

  it("shows ESI 1 for a life-saving intervention and hides the later questions", async () => {
    await openTriage();
    choose("Needs an immediate life-saving intervention?", "No");
    choose("High-risk situation?", "Yes"); choose("New confusion, lethargy or disorientation?", "No"); choose("Severe pain or distress (7/10 or more)?", "No");
    expect(await screen.findByRole("img", {name: "ESI level 2"})).toBeInTheDocument();
    choose("Needs an immediate life-saving intervention?", "Yes");
    expect(screen.queryByRole("radiogroup", {name: "High-risk situation?"})).not.toBeInTheDocument();
    expect(await screen.findByRole("img", {name: "ESI level 1"})).toBeInTheDocument();
  });

  it("refuses an outpatient visit", async () => {
    renderClinical(<IntakeForm encounterId="E1" profile={EMERGENCY_TRIAGE} onSaved={() => {}} onCancel={() => {}}/>, {port: fakePort()});
    expect(await screen.findByText("This visit uses a different form")).toBeInTheDocument();
  });
});
