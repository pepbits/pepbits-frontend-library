import { Globe, ShieldCheck, Workflow } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { CarePathway } from "./CarePathway";

const PROOF = [
  { icon: ShieldCheck, text: "HIPAA and GDPR controls" },
  { icon: Workflow, text: "HL7 v2 and FHIR R4 interfaces" },
  { icon: Globe, text: "Data stored in your region" },
];

export function Hero() {
  return (
    <section className="grid w-full grid-cols-1 items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12 lg:px-10 lg:py-8 2xl:gap-20 2xl:px-16">
      <div className="min-w-0 max-w-[40rem]">
        <h1 className="font-display text-[2.7rem] font-semibold leading-[0.98] tracking-[-0.035em] text-ink-900 sm:text-6xl xl:text-[4.6rem] 2xl:text-[5.4rem]">
          One record of care, from front desk to final claim.
        </h1>
        <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-600 xl:text-xl xl:leading-relaxed">
          Orvia runs hospitals, clinics, pharmacies, laboratories and imaging centers on one platform. Each organization
          gets its own secure workspace, with clinical care, dispensing and billing working from the same patient record.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/register" size="lg">
            Register your organization
          </ButtonLink>
          <ButtonLink href="/workspace" variant="secondary" size="lg">
            Sign in to your workspace
          </ButtonLink>
        </div>
        <ul className="mt-9 flex flex-col gap-2.5 text-sm text-ink-600 sm:flex-row sm:flex-wrap sm:gap-x-6">
          {PROOF.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-scrub-600" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </div>
      <CarePathway />
    </section>
  );
}
