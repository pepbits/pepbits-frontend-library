import type { Errors, RegistrationData, StepId } from "@/lib/registration";

export type SetData = (fn: (d: RegistrationData) => RegistrationData) => void;

export interface StepProps {
  data: RegistrationData;
  errors: Errors;
  setData: SetData;
  onJump?: (id: StepId) => void;
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
