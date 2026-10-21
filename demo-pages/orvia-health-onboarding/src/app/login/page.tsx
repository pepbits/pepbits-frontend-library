import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginFlow } from "@/components/auth/LoginFlow";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell
      aside={
        <div className="max-w-md">
          <p className="font-display text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.025em] xl:text-[2.8rem]">
            Good to see you again.
          </p>
          <p className="mt-5 leading-relaxed text-scrub-100">
            Your worklists, patients and pending claims are where you left them. Sign-in codes are required for every
            account that can open a patient record.
          </p>
        </div>
      }
    >
      <Suspense fallback={null}>
        <LoginFlow />
      </Suspense>
    </AuthShell>
  );
}
