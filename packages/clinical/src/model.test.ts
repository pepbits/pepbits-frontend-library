import {describe, expect, it} from "vitest";
import {
  EMPTY_VITALS, OUTPATIENT_INTAKE, flaggedQuestions, intakePayload, intakeProblems, intakeProfileFor, measurementErrors,
  news2Inputs, questionsFor, vitalsErrors, vitalsPayload, bmiPreview, type IntakeState, type Vitals,
} from "./model";

const complete: Vitals = {...EMPTY_VITALS, sbp: "128", dbp: "82", hr: "76", rr: "16", temp: "36.8", spo2: "98", o2: "air", acvpu: "A"};

describe("vitals model (unchanged from the AllyVora workspace)", () => {
  it("accepts a complete set and asks for every missing measurement otherwise", () => {
    expect(vitalsErrors(complete, {})).toEqual([]);
    expect(vitalsErrors(EMPTY_VITALS, {})).toEqual([
      "Record heart rate or a reason it wasn't measured.", "Record respiratory rate or a reason it wasn't measured.",
      "Record temperature or a reason it wasn't measured.", "Record spo₂ or a reason it wasn't measured.",
      "Record blood pressure or a reason it wasn't measured.", "Say whether the patient is on room air or oxygen.", "Record level of consciousness (ACVPU).",
    ]);
  });
  it("rejects out-of-range values, one-sided and inverted blood pressure", () => {
    expect(measurementErrors({...complete, hr: "300"}).hr).toBe("Heart rate: enter a number from 20 to 250 /min.");
    expect(measurementErrors({...complete, dbp: ""}).bp).toBe("Blood pressure: enter both systolic and diastolic values.");
    expect(measurementErrors({...complete, sbp: "80", dbp: "90"}).bp).toBe("Blood pressure: systolic must be greater than diastolic. Check both values.");
  });
  it("drops unmeasured values and oxygen flow on room air from the payload", () => {
    const payload = vitalsPayload({...complete, o2Flow: "4"}, {bp: "refused"});
    expect(payload).toMatchObject({sbp: null, dbp: null, hr: 76, o2: "air", o2Flow: null, notMeasured: {bp: "refused"}});
    expect(vitalsErrors({...complete, sbp: "", dbp: ""}, {bp: "refused"})).toEqual([]);
    expect(measurementErrors(complete, {bp: "forgot"}).notMeasured).toBe("Choose a supported reason for each unmeasured vital.");
  });
  it("previews BMI and builds NEWS2 scale 1 inputs", () => {
    expect(bmiPreview({...complete, weight: "70", height: "175"})).toBe(22.9);
    expect(bmiPreview(complete)).toBeNull();
    expect(news2Inputs(complete, {})).toEqual({rr: 16, spo2: 98, air: "air", sbp: 128, hr: 76, acvpu: "A", temp: 36.8, scale: "1"});
  });
});

describe("screening model", () => {
  it("shows questions by age, sex and setting and flags answers that need action", () => {
    const keys = (ctx: Parameters<typeof questionsFor>[0]) => questionsFor(ctx).map(q => q.key);
    expect(keys({sex: "female", age: 30, emergency: false})).toEqual(["feverTravel", "respiratoryInfection", "pregnant", "safeHome"]);
    expect(keys({sex: "male", age: 70, emergency: true})).toEqual(["feverTravel", "respiratoryInfection", "fallRecent", "safeHome", "selfHarm"]);
    expect(flaggedQuestions({sex: "male", age: 40, emergency: false}, {safeHome: "no", feverTravel: "no"}).map(q => q.key)).toEqual(["safeHome"]);
  });
});

describe("intake model and profiles", () => {
  const state: IntakeState = {arrival: {mode: "walk-in", source: "relative", interpreter: "yes"}, complaint: {item: {code: "C1", system: "s", display: "Chest pain"}, words: "Tight"},
    vitals: complete, notMeasured: {}, screening: {safeHome: "yes", feverTravel: null}, allergyReview: "nka"};
  it("requires vitals and the allergy review for outpatient intake", () => {
    expect(intakeProblems(state, OUTPATIENT_INTAKE)).toEqual([]);
    expect(intakeProblems({...state, allergyReview: null}, OUTPATIENT_INTAKE)).toEqual(["Review the allergy list with the patient."]);
    expect(intakeProblems({...state, complaint: {item: null, words: ""}}, {...OUTPATIENT_INTAKE, requireComplaint: true})).toEqual(["Choose the presenting complaint."]);
  });
  it("sends the AllyVora intake payload", () => {
    expect(intakePayload(state, OUTPATIENT_INTAKE)).toMatchObject({mode: "op", complaint: {code: "C1", display: "Chest pain", patientWords: "Tight"},
      arrival: {mode: "walk-in", historySource: "relative", interpreter: true}, screening: {safeHome: "yes"}, allergyReview: "nka"});
  });
  it("has an outpatient profile and none for inpatients", () => {
    expect(intakeProfileFor("OP")).toBe(OUTPATIENT_INTAKE);
    expect(intakeProfileFor("IP")).toBeUndefined();
  });
});
