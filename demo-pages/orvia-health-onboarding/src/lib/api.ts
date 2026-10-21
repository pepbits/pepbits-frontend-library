/**
 * Backend seams. Everything below is mocked so the UI runs on its own;
 * replace each body with a call to your API.
 */
import type { RegistrationData } from "./registration";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RegistrationReceipt {
  reference: string;
}

export async function submitRegistration(data: RegistrationData): Promise<RegistrationReceipt> {
  // Example:
  // const res = await fetch("/api/registrations", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(data),
  // });
  // if (!res.ok) throw new Error((await res.json()).message);
  // return res.json();
  void data;
  await wait(1600);
  const year = new Date().getFullYear().toString().slice(2);
  return { reference: `ORV-${year}-${Math.floor(10000 + Math.random() * 90000)}` };
}
