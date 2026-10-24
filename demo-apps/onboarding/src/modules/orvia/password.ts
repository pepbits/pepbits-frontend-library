// Ported unchanged from the source demo (orvia-health-onboarding, lib/password.ts). Labels are localized at render time.
export interface PasswordCheck {
  id: "length" | "cases" | "number" | "symbol";
  label: string;
  met: boolean;
  required: boolean;
}

export interface PasswordResult {
  checks: PasswordCheck[];
  /** 0 to 4 */
  score: number;
  acceptable: boolean;
  containsPersonal: boolean;
}

export function evaluatePassword(pw: string, personal: string[] = []): PasswordResult {
  const checks: PasswordCheck[] = [
    { id: "length", label: "At least 12 characters", met: pw.length >= 12, required: true },
    { id: "cases", label: "Upper- and lowercase letters", met: /[a-z]/.test(pw) && /[A-Z]/.test(pw), required: true },
    { id: "number", label: "At least one number", met: /\d/.test(pw), required: true },
    { id: "symbol", label: "A symbol makes it stronger", met: /[^A-Za-z0-9]/.test(pw), required: false },
  ];
  const lower = pw.toLowerCase();
  const containsPersonal = personal.some((p) => p.length >= 3 && lower.includes(p.toLowerCase()));
  let score = checks.filter((c) => c.met).length;
  if (pw.length >= 16 && score === 4) score = 4;
  if (containsPersonal) score = Math.min(score, 1);
  if (pw.length === 0) score = 0;
  const acceptable = checks.every((c) => !c.required || c.met) && !containsPersonal;
  return { checks, score, acceptable, containsPersonal };
}
