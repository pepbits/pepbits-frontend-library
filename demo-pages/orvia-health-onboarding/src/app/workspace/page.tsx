import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { WorkspaceFinder } from "@/components/auth/WorkspaceFinder";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Find your workspace" };

export default function WorkspacePage() {
  return (
    <AuthShell
      aside={
        <div className="max-w-md">
          <p className="font-display text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.025em] xl:text-[2.8rem]">
            Each organization signs in at its own address.
          </p>
          <p className="mt-5 leading-relaxed text-scrub-100">
            Your hospital, clinic or pharmacy group has a private workspace on {BRAND.name}. Patient records, users and
            settings stay inside it.
          </p>
          <div className="mt-8 space-y-2" aria-hidden="true">
            {["stmarys", "alnoor", "cityrx"].map((s, i) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-[0.95rem] ring-1 ring-white/10"
                style={{ opacity: 1 - i * 0.28 }}
              >
                <span className="h-2 w-2 rounded-full bg-mint" />
                <span>
                  <span className="font-semibold text-white">{s}</span>
                  <span className="text-scrub-300">.{BRAND.domain}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <WorkspaceFinder />
    </AuthShell>
  );
}
