export const LABEL_PAGES = [
  ["barcode-labels", "items"],
  ["specimen-labels", "specimen"],
  ["patient-wristbands", "patient"],
  ["qr-library", "qr"],
  ["payment-qr", "payment"],
  ["batch-label-printing", "batch"],
  ["printer-profiles", "profiles"],
] as const;
export interface LabelTemplate {
  id: string;
  title: string;
  category: string;
  symbology: string;
  widthMm: number;
  heightMm: number;
  version: number;
  fields: string[];
}
export interface PrinterProfile {
  id: string;
  title: string;
  widthMm: number;
  heightMm: number;
  columns: number;
  marginMm: number;
  gapMm: number;
}
export interface LabelPolicy {
  version: number;
  maxCopies: number;
  reprintAllowed: boolean;
  lockedProfile: string;
}
export interface LabelRecord {
  id: string;
  category: string;
  name: string;
  identifier: string;
  detail: string;
  amount?: number;
  currency?: string;
}
export interface LabelArtwork {
  recordId: string;
  title: string;
  lines: string[];
  code: string;
  image: string;
  widthMm: number;
  heightMm: number;
}
export interface LabelJob {
  id: string;
  templateId: string;
  templateVersion: number;
  profile: PrinterProfile;
  copies: number;
  labels: LabelArtwork[];
  createdAt: string;
  expiresAt?: string;
  paymentStatus?: "pending" | "paid" | "failed" | "expired";
  attempts: Array<{
    id: string;
    at: string;
    reason: string;
    status: "requested";
  }>;
}
export interface LabelLibrary {
  templates: LabelTemplate[];
  profiles: PrinterProfile[];
  records: LabelRecord[];
  jobs: LabelJob[];
  policy: LabelPolicy;
  defaultProfile: string;
  canManage: boolean;
}
export interface LabelCommand {
  action:
    | "library"
    | "create"
    | "job"
    | "print"
    | "simulate"
    | "preference"
    | "policy";
  operationId?: string;
  templateId?: string;
  recordIds?: string[];
  profileId?: string;
  copies?: number;
  jobId?: string;
  reason?: string;
  paymentStatus?: "paid" | "failed";
  policy?: LabelPolicy;
}
/** Physical stock compatibility shared by preview and authoritative API validation. */
export function labelFitsProfile(
  template: LabelTemplate,
  profile: PrinterProfile,
): boolean {
  return (
    profile.columns * template.widthMm +
      (profile.columns - 1) * profile.gapMm +
      2 * profile.marginMm <=
      profile.widthMm &&
    template.heightMm + 2 * profile.marginMm <= profile.heightMm
  );
}
