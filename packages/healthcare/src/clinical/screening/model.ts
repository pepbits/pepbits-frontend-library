/* Intake screening questions and the actions a flagged answer calls for, from the AllyVora
   clinical workspace (components/clinical/IntakeForm.tsx). */

export type ScreeningAnswer = "yes" | "no" | "unknown" | "declined";
export interface ScreeningContext { sex: string; age: number; emergency: boolean }
export interface ScreeningQuestion { key: string; label: string; show: (ctx: ScreeningContext) => boolean; flagOn?: ScreeningAnswer; action: string }

export const SCREENING_QUESTIONS: ScreeningQuestion[] = [
  {key: "feverTravel", label: "Fever with travel abroad in the last 14 days", show: () => true, flagOn: "yes", action: "Apply isolation precautions and inform infection control."},
  {key: "respiratoryInfection", label: "New cough or breathing symptoms with fever", show: () => true, flagOn: "yes", action: "Apply isolation precautions and inform infection control."},
  {key: "pregnant", label: "Could the patient be pregnant?", show: c => c.sex === "female" && c.age >= 12 && c.age <= 55, flagOn: "yes", action: "Flag for imaging and prescribing; offer a pregnancy test per policy."},
  {key: "fallRecent", label: "A fall in the last 6 months", show: c => c.age >= 65, flagOn: "yes", action: "Apply falls precautions."},
  {key: "safeHome", label: "Feels safe at home", show: () => true, flagOn: "no", action: "Follow the safeguarding pathway in private."},
  {key: "selfHarm", label: "Thoughts of harming themselves", show: c => c.emergency, flagOn: "yes", action: "Do not leave the patient alone. Inform the doctor now."},
];

export const SCREENING_ANSWERS: {value: ScreeningAnswer; label: string}[] = [
  {value: "yes", label: "Yes"}, {value: "no", label: "No"}, {value: "unknown", label: "Unknown"}, {value: "declined", label: "Declined"},
];

export type ScreeningAnswers = Record<string, ScreeningAnswer | null>;

export const questionsFor = (ctx: ScreeningContext, questions = SCREENING_QUESTIONS) => questions.filter(q => q.show(ctx));

/** Questions whose answer calls for action. */
export const flaggedQuestions = (ctx: ScreeningContext, answers: ScreeningAnswers, questions = SCREENING_QUESTIONS) =>
  questionsFor(ctx, questions).filter(q => q.flagOn && answers[q.key] === q.flagOn);

/** Answered questions only, as the API stores them. */
export const screeningPayload = (answers: ScreeningAnswers) =>
  Object.fromEntries(Object.entries(answers).filter(([, answer]) => answer)) as Record<string, ScreeningAnswer>;
