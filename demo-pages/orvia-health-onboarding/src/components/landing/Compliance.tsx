import { FileLock2, History, KeyRound, LockKeyhole } from "lucide-react";
import { STANDARD_GROUPS } from "@/lib/catalog";

const SAFEGUARDS = [
  { icon: LockKeyhole, title: "Encrypted everywhere", text: "AES-256 at rest and TLS 1.3 in transit, with keys managed per tenant." },
  { icon: History, title: "Every access is logged", text: "An immutable audit trail records who opened which chart, and when." },
  { icon: KeyRound, title: "Least-privilege access", text: "Role-based permissions, MFA for all clinical users and break-the-glass with review." },
  { icon: FileLock2, title: "Agreements at signup", text: "Business associate and data processing agreements are signed during registration." },
];

export function Compliance() {
  return (
    <section id="compliance" className="scroll-mt-16 border-t border-ink-100 bg-paper">
      <div className="grid w-full grid-cols-1 gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,2.25fr)] lg:gap-12 lg:px-10 lg:py-20 2xl:px-16">
        <div>
          <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-[2.6rem]">
            Built for regulated care
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-ink-600">
            Patient data never leaves the region you choose, and each organization&apos;s data is isolated in its own tenant.
          </p>
        </div>
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] xl:gap-12">
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1">
            {SAFEGUARDS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-scrub-100 text-scrub-800">
                  <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-semibold text-ink-900">{title}</p>
                  <p className="mt-1 text-[0.92rem] leading-relaxed text-ink-600">{text}</p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="divide-y divide-ink-200 border-y border-ink-200">
            {STANDARD_GROUPS.map((g) => (
              <div key={g.id} className="grid gap-3 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                <dt>
                  <p className="font-semibold text-ink-900">{g.label}</p>
                  <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-500">{g.description}</p>
                </dt>
                <dd className="flex flex-wrap content-start gap-2">
                  {g.items.map((i) => (
                    <span key={i.id} className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-sm font-medium text-ink-800">
                      {i.label}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
