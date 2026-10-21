import { Building2, FlaskConical, Hospital, LockKeyhole, Pill, Stethoscope } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { BRAND } from "@/lib/brand";

const STEPS = [
  { title: "Register your organization", text: "About ten minutes. Choose your facilities, modules and an address for your workspace." },
  { title: "We verify your license", text: "Our compliance team checks your registration within one business day." },
  { title: "Your team signs in", text: `Staff sign in at your own address, like stmarys.${BRAND.domain}, with MFA from day one.` },
];

const TREE = [
  { icon: Hospital, name: "St. Mary's Main Hospital", meta: "420 beds" },
  { icon: Stethoscope, name: "Northside Family Clinic", meta: "Outpatient" },
  { icon: Pill, name: "St. Mary's Pharmacy", meta: "Retail and inpatient" },
  { icon: FlaskConical, name: "Central Lab and Imaging", meta: "LIS and RIS" },
];

export function HowWorkspaces() {
  return (
    <section id="workspaces" className="scroll-mt-16 border-t border-ink-100 bg-white">
      <div className="grid w-full grid-cols-1 items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-10 lg:py-20 2xl:px-16">
        <div>
          <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-[2.6rem]">
            Every organization gets its own workspace
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-ink-600">
            A workspace is your private tenant. Groups with several hospitals, clinics or pharmacies run each one as an
            entity inside it, with one patient index and consolidated reporting.
          </p>
          <ol className="mt-8 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-scrub-300 font-display text-sm font-semibold text-scrub-800">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-ink-900">{s.title}</p>
                  <p className="mt-0.5 text-[0.95rem] leading-relaxed text-ink-600">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg">
              Register your organization
            </ButtonLink>
            <ButtonLink href="/workspace" variant="secondary" size="lg">
              Find my workspace
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-[28px] border border-ink-100 bg-paper p-4 sm:p-6" aria-hidden="true">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm">
            <LockKeyhole className="h-4 w-4 text-scrub-600" />
            <span className="truncate">
              <span className="text-ink-400">https://</span>
              <span className="font-semibold text-ink-900">stmarys</span>
              <span className="text-ink-500">.{BRAND.domain}</span>
            </span>
          </div>
          <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-ink-100">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-scrub-700 text-white">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-ink-900">St. Mary&apos;s Medical Center</p>
                <p className="text-sm text-ink-500">Workspace with 4 entities</p>
              </div>
            </div>
            <ul className="relative ml-5 mt-4 space-y-2 border-l border-dashed border-ink-200 pl-5">
              {TREE.map(({ icon: Icon, name, meta }) => (
                <li key={name} className="relative flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5">
                  <span className="absolute -left-5 top-1/2 h-px w-5 border-t border-dashed border-ink-200" />
                  <Icon className="h-4 w-4 shrink-0 text-scrub-700" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">{name}</span>
                  <span className="hidden text-[0.8rem] text-ink-500 sm:block">{meta}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
