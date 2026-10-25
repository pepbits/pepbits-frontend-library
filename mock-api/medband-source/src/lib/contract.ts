// Request contracts for the REST API. The server validates with these schemas;
// the client imports only the inferred types.
import { z } from "zod";

const text = (max = 200) => z.string().trim().max(max);
const optText = (max = 200) => text(max).optional().transform((v) => (v ? v : undefined));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use yyyy-mm-dd");
const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "is not a valid date and time");

export const ENCOUNTER_TYPE = z.enum(["OP", "FOLLOW_UP", "IP", "EMERGENCY", "DAY_CARE", "TELE", "HOME_VISIT", "OUTSIDE", "NO_CONSULT", "HEALTH_CHECK"]);
export const START_TYPE = z.enum([
  "WALK_IN", "APPOINTMENT", "INTERNAL_REFERRAL", "EXTERNAL_REFERRAL", "SELF_ARRIVAL", "AMBULANCE", "POLICE_CASE", "TRANSFER_IN",
  "ADMIT_FROM_OP", "ADMIT_FROM_ER", "ELECTIVE", "SCHEDULED_CALL", "ON_DEMAND_CALL", "SCHEDULED_VISIT", "ORDER_ONLY", "SAMPLE_COLLECTION",
]);
const EPISODE_KIND = z.enum(["Acute illness", "Chronic care", "Maternity", "Surgical", "Rehabilitation", "Preventive", "Oncology"]);
const BILLING = z.enum(["Self pay", "Insurance", "Corporate"]);

export const complaintEntry = z.object({
  code: text(20).min(1),
  label: text(120).min(1),
  duration: z.number().int().min(1).max(999).optional(),
  unit: z.enum(["hours", "days", "weeks", "months"]).optional(),
});

export const coverageSchema = z.object({
  id: text(60).min(1),
  priority: z.enum(["Primary", "Secondary", "Tertiary"]),
  payerId: text(60).min(1),
  tpaId: optText(60),
  networkId: text(60).min(1),
  planId: text(60).min(1),
  policyNumber: text(40).min(1, "is required"),
  memberId: text(40).min(1, "is required"),
  validFrom: isoDate,
  validTo: isoDate,
  relationship: z.enum(["Self", "Spouse", "Child", "Parent", "Other"]),
  holderName: optText(120),
});

export const patientSchema = z.object({
  firstName: text(80).min(1, "is required"),
  middleName: optText(80),
  lastName: text(80).min(1, "is required"),
  dob: isoDate,
  gender: z.enum(["Male", "Female", "Other", "Unknown"]),
  phone: text(30),
  altPhone: optText(30),
  email: optText(120).refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "is not a valid email"),
  nationalId: optText(40),
  nationality: optText(60),
  bloodGroup: optText(5),
  preferredLanguage: optText(40),
  address: optText(200),
  city: optText(80),
  emergencyName: optText(120),
  emergencyPhone: optText(30),
  allergies: optText(300),
  vip: z.boolean().optional(),
  unidentified: z.boolean().optional(),
  coverages: z.array(coverageSchema).max(3).default([]),
});
export type PatientInput = z.infer<typeof patientSchema>;
export const patientPatchSchema = patientSchema.partial();

export const episodeSchema = z.object({
  patientId: text(60).min(1),
  title: text(120).min(1, "is required"),
  kind: EPISODE_KIND,
  departmentId: text(60).min(1),
  practitionerId: optText(60),
  notes: optText(500),
});
export const episodeStatusSchema = z.object({ status: z.enum(["Active", "On hold", "Closed"]) });
export const caseStatusSchema = z.object({ status: z.enum(["Open", "Closed"]), provisionalDiagnosis: optText(200) });

const episodeChoice = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), episodeId: text(60).min(1) }),
  z.object({ mode: z.literal("new"), title: text(120).min(1, "is required"), kind: EPISODE_KIND }),
]);

export const caseChoice = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), caseId: text(60).min(1) }),
  z.object({
    mode: z.literal("new"),
    title: optText(120),
    provisionalDiagnosis: optText(200),
    medicoLegal: z.boolean().default(false),
    mlcNumber: optText(40),
    policeStation: optText(120),
    episode: episodeChoice,
  }),
]);
export type CaseChoice = z.infer<typeof caseChoice>;

export const encounterSchema = z.object({
  counterId: text(60).min(1, "Choose your counter"),
  patientId: text(60).min(1),
  type: ENCOUNTER_TYPE,
  startType: START_TYPE,
  priority: z.enum(["Routine", "Urgent", "Emergency"]),
  start: isoDateTime,
  departmentId: text(60).min(1, "Choose a department"),
  practitionerId: optText(60),
  complaints: z.array(complaintEntry).max(8).default([]),
  case: caseChoice.optional(),
  parentEncounterId: optText(60),
  admissionRequestId: optText(60),
  billingMode: BILLING,
  coverageIds: z.array(text(60)).max(3).default([]),
  authNumber: optText(40),
  corporateName: optText(120),
  wardId: optText(60),
  bed: optText(20),
  admissionReason: optText(300),
  expectedStayDays: z.number().int().min(1).max(365).optional(),
  teleChannel: z.enum(["Video", "Audio", "Chat"]).optional(),
  teleLink: optText(300),
  visitAddress: optText(300),
  visitTeam: optText(60),
  referringFacility: optText(160),
  referringDoctor: optText(120),
  referralNote: optText(500),
  services: z.array(text(80)).max(20).default([]),
  triage: z.enum(["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"]).optional(),
  packageId: optText(60),
  broughtBy: optText(120),
  broughtByPhone: optText(30),
});
export type EncounterInput = z.infer<typeof encounterSchema>;

export const encounterStatusSchema = z.object({
  status: z.enum(["Planned", "Arrived", "In progress", "Completed", "Cancelled"]),
  counterId: optText(60),
});

export const admissionRequestSchema = z.object({
  patientId: text(60).min(1),
  sourceEncounterId: optText(60),
  case: caseChoice.optional(),
  complaints: z.array(complaintEntry).max(8).default([]),
  requestedById: text(60).min(1, "Choose the requesting clinician"),
  admittingDepartmentId: text(60).min(1, "Choose the admitting department"),
  admittingPractitionerId: text(60).min(1, "Choose the admitting consultant"),
  urgency: z.enum(["Elective", "Urgent", "Emergency"]),
  plannedDate: isoDateTime,
  expectedStayDays: z.number().int().min(1).max(365),
  bedCategory: z.enum(["General", "Semi-private", "Private", "ICU", "Maternity"]),
  isolation: z.enum(["None", "Contact", "Droplet", "Airborne"]),
  reason: text(300).min(1, "is required"),
  plannedProcedure: optText(200),
  specialNeeds: z.array(text(60)).max(12).default([]),
  billingMode: BILLING,
  coverageId: optText(60),
  authNumber: optText(40),
  estimatedCost: z.number().min(0).max(10_000_000).optional(),
  depositCollected: z.boolean().default(false),
  notes: optText(1000),
});
export type AdmissionRequestInput = z.infer<typeof admissionRequestSchema>;

export const admissionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("authorize"), decision: z.enum(["Approved", "Rejected"]), authNumber: optText(40) }),
  z.object({ action: z.literal("deposit") }),
  z.object({ action: z.literal("reschedule"), plannedDate: isoDateTime }),
  z.object({ action: z.literal("cancel"), reason: text(300).min(1, "Give a reason for cancelling") }),
]);
