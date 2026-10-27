import React from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, screen, waitFor, within} from "@testing-library/react";
import {IntakeForm} from "./IntakeForm";
import {renderClinical} from "../test/host";
import {encounterDetail, fakePort} from "../test/fixtures";

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});
const choose = (group: string, option: string) => fireEvent.click(within(screen.getByRole("radiogroup", {name: group})).getByRole("radio", {name: option}));

describe("IntakeForm", () => {
  it("moves a waiting visit into intake and shows the patient", async () => {
    const port = fakePort();
    renderClinical(<IntakeForm encounterId="E1" onSaved={() => {}} onCancel={() => {}}/>, {port});
    expect(await screen.findByRole("heading", {name: "Test Patient"})).toBeInTheDocument();
    expect(port.setEncounterStatus).toHaveBeenCalledWith("E1", "intake");
    expect(screen.getByRole("region", {name: "Vital signs"})).toBeInTheDocument();
    expect(screen.getByRole("region", {name: "Screening"})).toBeInTheDocument();
  });

  it("lists what is missing instead of saving", async () => {
    const port = fakePort();
    renderClinical(<IntakeForm encounterId="E1" onSaved={() => {}} onCancel={() => {}}/>, {port});
    await screen.findByRole("heading", {name: "Test Patient"});
    fireEvent.click(screen.getByRole("button", {name: "Save and send to doctor"}));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Record heart rate or a reason it wasn't measured.");
    expect(alert).toHaveTextContent("Review the allergy list with the patient.");
    expect(port.saveIntake).not.toHaveBeenCalled();
  });

  it("saves a complete intake through the port and hands back to the host", async () => {
    const port = fakePort(), onSaved = vi.fn(), notify = vi.fn();
    renderClinical(<IntakeForm encounterId="E1" onSaved={onSaved} onCancel={() => {}}/>, {port, notify});
    await screen.findByRole("heading", {name: "Test Patient"});
    fill("Systolic", "128"); fill("Diastolic", "82"); fill("Heart rate", "76"); fill("Respiratory rate", "16"); fill("Temperature", "36.8"); fill("SpO₂", "98");
    choose("Air or oxygen", "Room air"); choose("ACVPU", "Alert"); choose("Allergy review outcome", "No known allergies");
    await waitFor(() => expect(port.calculateScore).toHaveBeenCalledWith("news2", expect.objectContaining({hr: 76, sbp: 128}), expect.anything()));
    fireEvent.click(screen.getByRole("button", {name: "Save and send to doctor"}));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(port.saveIntake).toHaveBeenCalledWith("E1", expect.objectContaining({mode: "op", allergyReview: "nka", vitals: expect.objectContaining({hr: 76, o2: "air", acvpu: "A"})}));
    expect(notify).toHaveBeenCalledWith("Intake saved. Test Patient is ready for the doctor.", {tone: "success"});
  });

  it("shows server problems and keeps the entered values", async () => {
    const port = fakePort({saveIntake: vi.fn(async () => { throw Object.assign(new Error("Invalid"), {problems: ["This visit is closed."]}); })});
    renderClinical(<IntakeForm encounterId="E1" onSaved={() => {}} onCancel={() => {}}/>, {port});
    await screen.findByRole("heading", {name: "Test Patient"});
    fill("Systolic", "128"); fill("Diastolic", "82"); fill("Heart rate", "76"); fill("Respiratory rate", "16"); fill("Temperature", "36.8"); fill("SpO₂", "98");
    choose("Air or oxygen", "Room air"); choose("ACVPU", "Alert"); choose("Allergy review outcome", "No known allergies");
    fireEvent.click(screen.getByRole("button", {name: "Save and send to doctor"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("This visit is closed.");
    expect(screen.getByLabelText("Heart rate")).toHaveValue(76);
  });

  it("refuses an inpatient admission and does not change its status", async () => {
    const port = fakePort({loadEncounter: vi.fn(async () => encounterDetail({class: "IP", status: "registered"}))});
    renderClinical(<IntakeForm encounterId="E1" onSaved={() => {}} onCancel={() => {}}/>, {port});
    expect(await screen.findByText(/Use inpatient observations/)).toBeInTheDocument();
    expect(port.setEncounterStatus).not.toHaveBeenCalled();
  });

  it("offers a retry when the visit cannot be loaded", async () => {
    const loadEncounter = vi.fn().mockRejectedValueOnce(new Error("Network down")).mockResolvedValue(encounterDetail({status: "intake"}));
    const port = fakePort({loadEncounter});
    renderClinical(<IntakeForm encounterId="E1" onSaved={() => {}} onCancel={() => {}}/>, {port});
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    // The test host has no message catalog, so the shared retry button shows its message key.
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button"));
    expect(await screen.findByRole("heading", {name: "Test Patient"})).toBeInTheDocument();
    expect(port.setEncounterStatus).not.toHaveBeenCalled();
  });
});
