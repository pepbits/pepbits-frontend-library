import React from "react";
import {describe, expect, it, vi} from "vitest";
import {act, fireEvent, screen, waitFor, within} from "@testing-library/react";
import {AllergyForm, EditAllergy} from "./AllergyForm";
import {AllergyStatusChange} from "./AllergyActions";
import {AllergySection} from "./AllergySection";
import {allergy, consultation, findingsPort, FindingsHost, masters, renderFindings, sectionProps} from "../consult-records/test-fixtures";
import type {AllergyMasterData} from "../models/consult-records";
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});

describe("consultation allergy lifecycle", () => {
  it("loads masters, batches allergens, and enforces serious and exclusive reactions", async () => {
    const port = findingsPort(), done = vi.fn();
    renderFindings(<AllergyForm patientId="P1" onDone={done} onCancel={() => {}}/>, port);
    await screen.findByLabelText("Allergen");
    fill("Allergen", "Synthetic A"); fireEvent.click(screen.getByRole("button", {name: "Add allergen to batch"}));
    fill("Allergen", "Synthetic B"); fireEvent.click(screen.getByRole("button", {name: "Anaphylaxis"}));
    expect(screen.getByLabelText("Future risk")).toBeDisabled();
    expect(screen.getByLabelText("Future risk")).toHaveValue("high");
    fireEvent.click(screen.getByRole("button", {name: "Reaction not known"}));
    expect(screen.getByRole("button", {name: "Anaphylaxis"})).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Other reaction or description")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", {name: "Anaphylaxis"}));
    fireEvent.click(screen.getByRole("button", {name: "Add allergies as unconfirmed"}));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(port.consult.addAllergies).toHaveBeenCalledWith("P1", expect.objectContaining({items: [{substance: "Synthetic A", allergenCode: "", group: "medication"}, {substance: "Synthetic B", allergenCode: "", group: "medication"}], reactions: ["anaphylaxis"], criticality: "high"}));
    expect(port.consult.addAllergy).not.toHaveBeenCalled();
  });
  it("retains an allergy draft and shows server validation failures", async () => {
    const port = findingsPort({addAllergy: vi.fn().mockRejectedValue(Object.assign(new Error("Conflict"), {status: 409, problems: ["Allergen already exists."]}))});
    renderFindings(<AllergyForm patientId="P1" onDone={() => {}} onCancel={() => {}}/>, port);
    await screen.findByLabelText("Allergen"); fill("Allergen", "Synthetic medicine");
    fireEvent.click(screen.getByRole("button", {name: "Add as unconfirmed"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Allergen already exists.");
    expect(screen.getByLabelText("Allergen")).toHaveValue("Synthetic medicine");
  });
  it("sends only changed fields with the original version and paired reaction values", async () => {
    const port = findingsPort();
    renderFindings(<EditAllergy patientId="P1" allergy={allergy} onDone={() => {}} onCancel={() => {}}/>, port);
    await screen.findByLabelText("Allergen"); fill("Other reaction or description", "New description");
    expect(screen.getByRole("button", {name: "Save changes"})).toBeDisabled(); fill("Reason", "Corrected history");
    fireEvent.click(screen.getByRole("button", {name: "Save changes"}));
    await waitFor(() => expect(port.consult.updateAllergy).toHaveBeenCalledWith("P1", "A1", {version: 7, reason: "Corrected history", reactions: ["rash"], reactionOther: "New description"}));
  });
  it.each(["resolved", "reactivate", "refuted", "entered-in-error", "inactive"] as const)("preserves version and reason for %s", async action => {
    const port = findingsPort(), entry = action === "reactivate" ? {...allergy, clinicalStatus: "inactive", verification: "refuted"} : allergy;
    renderFindings(<AllergyStatusChange patientId="P1" allergy={entry} action={action} onDone={() => {}} onCancel={() => {}}/>, port);
    fill("Reason", "Clinical evidence recorded");
    if (action === "resolved") {await screen.findByRole("option", {name: "Supervised challenge"}); fill("How was resolution established?", "challenge");}
    const labels = {resolved: "Mark resolved", reactivate: "Reactivate", refuted: "Refute", "entered-in-error": "Entered in error", inactive: "Mark inactive"};
    fireEvent.click(screen.getByRole("button", {name: labels[action]}));
    await waitFor(() => expect(port.consult.updateAllergy).toHaveBeenCalled());
    const patch = {resolved: {clinicalStatus: "resolved", resolution: "challenge"}, reactivate: {clinicalStatus: "active", verification: "unconfirmed"}, refuted: {verification: "refuted"}, "entered-in-error": {verification: "entered-in-error"}, inactive: {clinicalStatus: "inactive"}}[action];
    expect(port.consult.updateAllergy).toHaveBeenCalledWith("P1", "A1", {...patch, version: 7, reason: "Clinical evidence recorded"});
  });
  it("verifies and reviews through the consultation port, without changing the note", async () => {
    const detail = consultation(); detail.allergies.entries = [allergy]; const props = sectionProps(detail), port = findingsPort();
    renderFindings(<AllergySection {...props}/>, port);
    fireEvent.click(screen.getByRole("button", {name: "Confirm allergy"}));
    await waitFor(() => expect(port.consult.verifyAllergy).toHaveBeenCalledWith("P1", "A1", {verification: "confirmed", version: 7}));
    await waitFor(() => expect(screen.getByRole("radio", {name: "Reviewed, no change"})).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", {name: "Reviewed, no change"}));
    await waitFor(() => expect(port.consult.reviewAllergies).toHaveBeenCalledWith("P1", "reviewed-no-change"));
    expect(props.onChange).not.toHaveBeenCalled(); expect(props.onRecordsChanged).toHaveBeenCalledTimes(2);
  });
  it("aborts obsolete masters and cannot display one port's results in another", async () => {
    let resolve!: (data: AllergyMasterData) => void;
    const first = findingsPort({loadAllergyMasters: vi.fn(() => new Promise<AllergyMasterData>(r => {resolve = r;}))});
    const second = findingsPort({loadAllergyMasters: vi.fn(async () => ({...masters, categories: [{code: "food", display: "Second tenant food"}]}))});
    const ui = <AllergyForm patientId="P1" onDone={() => {}} onCancel={() => {}}/>;
    const view = renderFindings(ui, first);
    view.rerender(<FindingsHost port={second}>{ui}</FindingsHost>);
    await screen.findByRole("option", {name: "Second tenant food"});
    await act(async () => resolve(masters));
    expect(screen.queryByRole("option", {name: "Medicine"})).not.toBeInTheDocument();
    expect(vi.mocked(first.consult.loadAllergyMasters).mock.calls[0]![0]!.aborted).toBe(true);
  });
  it("read-only sections expose audit history without mutation controls", () => {
    const detail = consultation(); detail.allergies.entries = [{...allergy, history: [{at: "2026-10-28T09:00:00Z", actorName: "Synthetic clinician", actorId: "D1", action: "corrected", before: {reaction: "rash"}, after: {reaction: "hives"}, reason: "Patient clarified"}]}];
    renderFindings(<AllergySection {...sectionProps(detail)} readOnly/>);
    expect(screen.queryByRole("button", {name: "Confirm allergy"})).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Add allergy"})).toBeDisabled();
    fireEvent.click(screen.getByText("Allergy history"));
    expect(screen.getByText("Patient clarified", {exact: false})).toBeInTheDocument();
  });
});

it("ignores a completed write after changing patients and clears the old patient's draft", async () => {
  let resolve!: (block: import("../types").AllergyBlock) => void;
  const port = findingsPort({addAllergy: vi.fn(() => new Promise<import("../types").AllergyBlock>(r => {resolve = r;}))}), done = vi.fn();
  const view = renderFindings(<AllergyForm patientId="P1" onDone={done} onCancel={() => {}}/>, port);
  await screen.findByLabelText("Allergen"); fill("Allergen", "Old patient allergy"); fireEvent.click(screen.getByRole("button", {name: "Add as unconfirmed"}));
  view.rerender(<FindingsHost port={port}><AllergyForm patientId="P2" onDone={done} onCancel={() => {}}/></FindingsHost>);
  expect(await screen.findByLabelText("Allergen")).toHaveValue("");
  await act(async () => resolve({assessment: {state: "has-entries"}, entries: [allergy]}));
  expect(done).not.toHaveBeenCalled();
});
