import React from "react";
import {describe, expect, it, vi} from "vitest";
import {fireEvent, screen, waitFor, within} from "@testing-library/react";
import {ComplaintSection, HpiSection, RosSection, ExamSection, HistorySection, AssessmentSection} from "./index";
import {Controlled, consultPort, renderOwned} from "./test/fixtures";
import {emptyNote, EXAM_SYSTEMS, ROS_SYSTEMS} from "../models/consult-note";
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});
const choose = (group: string, option: string) => fireEvent.click(within(screen.getByRole("radiogroup", {name: group})).getByRole("radio", {name: option}));
describe("controlled consultation note sections", () => {
  it("keeps complaint duration and patient words, and promotes the remaining primary without mutating the incoming note", () => {
    const initial = emptyNote(), changed = vi.fn(); initial.complaints = [{code: "a", display: "Cough", primary: true}, {code: "b", display: "Fever", primary: false}];
    renderOwned(<Controlled component={ComplaintSection} initial={initial} changed={changed}/>);
    fireEvent.change(screen.getAllByLabelText("Duration value")[0]!, {target: {value: "3"}});
    fireEvent.change(screen.getAllByLabelText("Duration unit")[0]!, {target: {value: "week"}});
    fireEvent.change(screen.getAllByLabelText("Patient’s words")[0]!, {target: {value: "At night"}});
    expect(changed.mock.lastCall![0].complaints[0]).toMatchObject({duration: {value: 3, unit: "week"}, patientWords: "At night"});
    fireEvent.click(screen.getByRole("button", {name: "Remove Cough"}));
    expect(changed.mock.lastCall![0].complaints).toEqual([{code: "b", display: "Fever", primary: true}]);
    expect(initial.complaints).toHaveLength(2); expect(initial.complaints[0]!.duration).toBeUndefined();
  });
  it("adds a complaint through the supplied catalogue port", async () => {
    const changed = vi.fn(), searchCatalog = vi.fn().mockResolvedValue([{code: "c", system: "test", display: "Cough"}]);
    renderOwned(<Controlled component={ComplaintSection} changed={changed}/>, consultPort(), {basePort: {searchCatalog}});
    fireEvent.change(screen.getByRole("combobox"), {target: {value: "cou"}}); await screen.findByRole("option"); fireEvent.keyDown(screen.getByRole("combobox"), {key: "Enter"});
    expect(changed.mock.lastCall![0].complaints).toEqual([{code: "c", display: "Cough", primary: true}]);
    expect(searchCatalog).toHaveBeenCalledWith("complaints", "cou", expect.any(AbortSignal), expect.anything());
  });
  it("records structured HPI and toggles patient-rated severity", () => {
    const changed = vi.fn(); renderOwned(<Controlled component={HpiSection} changed={changed}/>);
    fill("Onset", "Three days"); fill("Narrative", "Synthetic history"); fireEvent.click(screen.getByRole("button", {name: "4"}));
    expect(changed.mock.lastCall![0].hpi).toMatchObject({onset: "Three days", narrative: "Synthetic history", severity: 4});
    fireEvent.click(screen.getByRole("button", {name: "4"})); expect(changed.mock.lastCall![0].hpi.severity).toBeNull();
  });
  it("preserves positive ROS findings when marking asked/absent, and supports clearing", () => {
    const changed = vi.fn(), s = ROS_SYSTEMS[0]!, symptom = s.symptoms[0]!; renderOwned(<Controlled component={RosSection} changed={changed}/>);
    choose(symptom, "Present"); fireEvent.click(within(screen.getByRole("region", {name: s.label})).getByRole("button", {name: "Asked, all absent"}));
    expect(changed.mock.lastCall![0].ros[s.id][symptom]).toBe("present"); expect(changed.mock.lastCall![0].ros[s.id][s.symptoms[1]!]).toBe("absent");
    fireEvent.click(screen.getByRole("button", {name: `Clear ${symptom}`})); expect(changed.mock.lastCall![0].ros[s.id][symptom]).toBeUndefined();
  });
  it("distinguishes not-examined from normal and retains abnormal findings", () => {
    const changed = vi.fn(), s = EXAM_SYSTEMS[0]!; renderOwned(<Controlled component={ExamSection} changed={changed}/>);
    choose(s.label, "Not examined"); expect(changed.mock.lastCall![0].exam[s.id].state).toBe("not-examined");
    choose(s.label, "Abnormal"); fireEvent.click(screen.getByRole("button", {name: s.findings[0]!})); fill(`${s.label} finding`, "Synthetic finding");
    choose(s.label, "Normal"); expect(changed.mock.lastCall![0].exam[s.id]).toMatchObject({state: "normal", findings: [s.findings[0]], note: "Synthetic finding"});
  });
  it("keeps social/family values controlled and loads surgical history through the port", async () => {
    const changed = vi.fn(), consult = consultPort(); renderOwned(<Controlled component={HistorySection} changed={changed}/>, consult);
    await waitFor(() => expect(consult.listProcedureHistory).toHaveBeenCalledWith("P1", expect.any(AbortSignal)));
    choose("Smoking", "Former"); fill("Living situation", "family"); fill("Relevant family history", "Synthetic family history"); fill("Occupation", "__other"); fill("Occupation, other", "Welder");
    expect(changed.mock.lastCall![0].history).toMatchObject({smoking: "former", living: "family", family: "Synthetic family history", occupation: "Welder"});
  });
  it("keeps ICD claim codes separate, ranks diagnoses and excludes differentials from problem-list selection", async () => {
    const changed = vi.fn(), initial = emptyNote(); initial.diagnoses = [{code: "a", display: "First", primary: true, verification: "confirmed"}, {code: "b", display: "Second", primary: false, verification: "provisional"}];
    const searchCatalog = vi.fn().mockResolvedValue([{system: "synthetic", code: "c", display: "Third", meta: {icd10cm: "TEST-1"}}]);
    renderOwned(<Controlled component={AssessmentSection} initial={initial} changed={changed}/>, consultPort(), {basePort: {searchCatalog}});
    fill("Clinical assessment", "Synthesis"); fireEvent.click(screen.getByRole("button", {name: "Make primary"}));
    expect(changed.mock.lastCall![0].diagnoses.map((d: {primary: boolean}) => d.primary)).toEqual([false, true]);
    choose("Verification: Second", "Differential"); expect(screen.getAllByRole("checkbox")[1]).toBeDisabled();
    fireEvent.click(screen.getByRole("button", {name: "Remove Second"}));
    expect(changed.mock.lastCall![0].diagnoses[0].primary).toBe(true);
    fireEvent.change(screen.getByRole("combobox"), {target: {value: "third"}}); await screen.findByRole("option"); fireEvent.keyDown(screen.getByRole("combobox"), {key: "Enter"});
    expect(changed.mock.lastCall![0].diagnoses[1]).toMatchObject({code: "c", icd10: "TEST-1", verification: "provisional"});
  });
  it.each([ComplaintSection, HpiSection, RosSection, ExamSection, HistorySection, AssessmentSection])("disables editing for %s when read-only", async component => {
    const changed = vi.fn(), initial = emptyNote(); initial.complaints = [{code: "c", display: "Cough", primary: true}];
    renderOwned(<Controlled component={component} initial={initial} readOnly changed={changed}/>);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    for (const control of document.querySelectorAll("input, textarea, select, button")) expect(control).toBeDisabled();
    expect(changed).not.toHaveBeenCalled();
  });
});
