import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterWizard } from "@/components/register/RegisterWizard";

export const metadata: Metadata = { title: "Register your organization" };

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterWizard />
    </Suspense>
  );
}
