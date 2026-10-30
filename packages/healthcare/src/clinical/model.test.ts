import {describe, expect, it} from "vitest";
import {
  EMERGENCY_TRIAGE, EMPTY_ESI, EMPTY_TRIAGE, EMPTY_VITALS, OUTPATIENT_INTAKE, esiAsksB, esiAsksC, esiInputs, finalEsiLevel, withEsiAnswer, flaggedQuestions, intakePayload, intakeProblems, intakeProfileFor, measurementErrors,
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

const state: IntakeState = {arrival: {mode: "walk-in", source: "relative", interpreter: "yes"}, complaint: {item: {code: "C1", system: "s", display: "Chest pain"}, words: "Tight"},
  vitals: complete, notMeasured: {}, screening: {safeHome: "yes", feverTravel: null}, allergyReview: "nka", triage: EMPTY_TRIAGE};

describe("intake model and profiles", () => {
  it("requires vitals and the allergy review for outpatient intake", () => {
    expect(intakeProblems(state, OUTPATIENT_INTAKE)).toEqual([]);
    expect(intakeProblems({...state, allergyReview: null}, OUTPATIENT_INTAKE)).toEqual(["Review the allergy list with the patient."]);
    expect(intakeProblems({...state, complaint: {item: null, words: ""}}, {...OUTPATIENT_INTAKE, requireComplaint: true})).toEqual(["Choose the presenting complaint."]);
  });
  it("sends the AllyVora intake payload", () => {
    expect(intakePayload(state, OUTPATIENT_INTAKE)).toMatchObject({mode: "op", complaint: {code: "C1", display: "Chest pain", patientWords: "Tight"},
      arrival: {mode: "walk-in", historySource: "relative", interpreter: true}, screening: {safeHome: "yes"}, allergyReview: "nka"});
  });
  it("has outpatient and emergency profiles and none for inpatients", () => {
    expect(intakeProfileFor("OP")).toBe(OUTPATIENT_INTAKE);
    expect(intakeProfileFor("ER")).toBe(EMERGENCY_TRIAGE);
    expect(intakeProfileFor("IP")).toBeUndefined();
  });
});

describe("ESI triage model", () => {
  it("asks B after A is No and C after every B is No, clearing answers that no longer apply", () => {
    let d = withEsiAnswer(EMPTY_ESI, "lifeSaving", false);
    expect(esiAsksB(d)).toBe(true);
    expect(esiAsksC(d)).toBe(false);
    d = withEsiAnswer(withEsiAnswer(withEsiAnswer(d, "highRisk", false), "confusedLethargic", false), "severePain", false);
    d = withEsiAnswer(d, "resources", 2);
    expect(esiAsksC(d)).toBe(true);
    expect(withEsiAnswer(d, "highRisk", true)).toEqual({...d, highRisk: true, resources: null});
    expect(withEsiAnswer(d, "lifeSaving", true)).toEqual({...EMPTY_ESI, lifeSaving: true});
  });
  it("sends only answered decisions, age and measured danger-zone signs", () => {
    expect(esiInputs({...EMPTY_ESI, lifeSaving: false}, 40, {hr: 120, rr: null, spo2: null})).toEqual({lifeSaving: false, ageYears: 40, hr: 120});
  });
  it("saves the override when chosen and requires a reason for it", () => {
    expect(finalEsiLevel(3, {level: null, reason: ""})).toBe(3);
    expect(finalEsiLevel(3, {level: 2, reason: "Looks unwell"})).toBe(2);
    const triaged = {...state, triage: {...EMPTY_TRIAGE, override: {level: 2 as const, reason: ""}}};
    expect(intakeProblems({...state, triage: EMPTY_TRIAGE}, EMERGENCY_TRIAGE, null)).toEqual(["Complete the triage decision points."]);
    expect(intakeProblems(triaged, EMERGENCY_TRIAGE, 3)).toEqual(["Give a reason for changing the calculated triage level."]);
    expect(intakeProblems({...state, complaint: {item: null, words: ""}}, EMERGENCY_TRIAGE, 4)).toEqual(["Choose the presenting complaint."]);
  });
  it("sends the AllyVora triage payload", () => {
    const triage = {decisions: {...EMPTY_ESI, lifeSaving: false, highRisk: true}, override: {level: 1 as const, reason: "Airway concern"}, area: "Resuscitation"};
    expect(intakePayload({...state, triage}, EMERGENCY_TRIAGE)).toMatchObject({mode: "er",
      esi: {lifeSaving: false, highRisk: true, overrideLevel: 1, overrideReason: "Airway concern"}, disposition: {area: "Resuscitation"}});
    expect(intakePayload({...state, triage}, OUTPATIENT_INTAKE)).not.toHaveProperty("esi");
  });
});
