"use client";
import { LANGUAGE_OPTIONS } from "@pepbits/erp-config";
import { LocalizedText, PrintDocument, useLocalization } from "@pepbits/ops-ui";
import { useReferenceHost } from "@pepbits/reference-host";
import { SourceButton } from "../../../../../shared/controls";
import { useEffect, useState } from "react";
import { CalendarCheck, FileText, FlaskConical, Loader2, Pill, Printer, Stethoscope } from "lucide-react";
import type { Order, Prescription, VisitSummary } from "../../../../../shared/types";
import { ApiError, useTeleconsultClient } from "../../../../lib/api";
import { useTeleconsultFormat } from "../../../../lib/format";
import { Avatar, Card, Header, Notice, Screen } from "../../../../components/ui";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const { t } = useLocalization();
  return (
    <Card>
      <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-forest">{icon}{t(title)}</h2>
      {children}
    </Card>
  );
}

const plain = (s: string) =>
  s.replace(/,\s*(site\s+)?(not specified|unspecified).*$/i, "").replace(/\s*\(.*?\)\s*/g, " ").trim();

const referralText = (o: Order, t: ReturnType<typeof useLocalization>["t"]) => (o.code === "REF-ED" ? t("Go to the emergency department today") : t("Referral to {value0}. They will contact you.", { value0: o.name }));

export default function Summary({ params }: { params: { id: string } }) {
  const { t } = useLocalization();
  const { language } = useReferenceHost().preferences;
  const client = useTeleconsultClient();
  const { fmtDay, fmtTime } = useTeleconsultFormat();
  const [data, setData] = useState<VisitSummary>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const load = async () => {
      try {
        const summary = await client.get<VisitSummary>(`/api/appointments/${encodeURIComponent(params.id)}/summary`, { signal: controller.signal });
        setData(summary);
        setPending(false);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 404) {
          setPending(true);
          t = setTimeout(load, 4000); // notes not signed yet: keep checking
        } else setError((e as Error).message);
      }
    };
    load();
    return () => { clearTimeout(t); controller.abort(); };
  }, [params.id, client]);

  const e = data?.encounter;
  const tests = e?.orders.filter((o) => ["lab", "imaging", "procedure"].includes(o.kind)) ?? [];
  const referrals = e?.orders.filter((o) => o.kind === "referral") ?? [];
  const nursing = e?.orders.filter((o) => o.kind === "nursing") ?? [];
  const medicineDetail = (p: Prescription) => t("{value0} for {value1} days", { value0: [p.dose, p.frequency.toLowerCase() + (p.prn ? ` ${t("when needed")}` : "")].join(", "), value1: p.durationDays });
  const followUpText = e?.followUp ? t("A {value0} follow-up in {value1} days is booked. You’ll find it on your home screen.", { value0: (language === "en" ? e.followUp.mode : t(e.followUp.mode[0].toUpperCase() + e.followUp.mode.slice(1))), value1: e.followUp.inDays }) : "";
  const fitNoteText = e && e.sickNoteDays > 0 ? t(e.sickNoteDays > 1 ? "Fit note: you’re advised to stay off work for {value0} days." : "Fit note: you’re advised to stay off work for {value0} day.", { value0: e.sickNoteDays }) : "";

  return (
    <Screen>
      <Header back="/home" title="Visit summary" right={data && <SourceButton onClick={() => window.print()} className="rounded-full p-2 text-forest hover:bg-forest/5" aria-label="Print or save as PDF"><Printer className="h-5 w-5" /></SourceButton>} />
      <main className="space-y-3 px-4 pb-8 pt-2">
        {error && <Notice tone="error">{error}</Notice>}
        {pending && (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-forest" />
            <p className="text-lg font-bold text-forest"><LocalizedText message={"Your doctor is writing up your visit"} /></p>
            <p className="text-sm text-ink-600"><LocalizedText message={"Your summary, prescriptions and test details appear here as soon as they sign. You can leave this screen. (Demo content, not medical advice.)"} /></p>
          </Card>
        )}
        {data && e && (
          <>
            <Card className="flex items-center gap-3">
              <Avatar name={data.clinician.name} color={data.clinician.color} size={48} />
              <div className="min-w-0">
                <p className="font-bold text-ink">{data.clinician.name}</p>
                <p className="text-sm text-ink-600">{fmtDay(data.appointment.start)}, {fmtTime(data.appointment.start)}</p>
              </div>
            </Card>

            {e.patientInstructions && (
              <section className="rounded-3xl bg-forest p-5 text-white">
                <h2 className="mb-2 text-[15px] font-bold text-sun"><LocalizedText message={"What to do next"} /></h2>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-forest-100">{e.patientInstructions}</p>
              </section>
            )}

            {e.diagnoses.length > 0 && (
              <Section icon={<Stethoscope className="h-5 w-5" />} title="What we found">
                <ul className="space-y-1.5">
                  {e.diagnoses.map((d) => (
                    <li key={d.code} className="text-[15px] text-ink">
                      {plain(d.display)}
                      {d.certainty === "provisional" && <span className="ml-1.5 text-xs text-ink-400"><LocalizedText message={"(likely, to be confirmed)"} /></span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {e.prescriptions.length > 0 && (
              <Section icon={<Pill className="h-5 w-5" />} title="Your medicines">
                <ul className="space-y-3">
                  {e.prescriptions.map((p) => (
                    <li key={p.id} className="rounded-2xl bg-mint p-3">
                      <p className="font-semibold text-ink">{p.name} {p.strength}</p>
                      <p className="text-sm text-ink-600">{medicineDetail(p)}</p>
                      {p.instructions && <p className="mt-1 text-sm text-ink-600">{p.instructions}</p>}
                      <p className="mt-1 text-xs text-ink-400">{t("Demo prescription (not sent to a real pharmacy) · {value0} {value1}", { value0: p.quantity, value1: p.form + (p.quantity === 1 ? "" : "s") })}{p.refills ? ` · ${t("{value0} refills", { value0: p.refills })}` : ""}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {(tests.length > 0 || referrals.length > 0) && (
              <Section icon={<FlaskConical className="h-5 w-5" />} title="Tests and referrals">
                <ul className="space-y-2">
                  {tests.map((o) => (
                    <li key={o.id} className="flex items-start gap-2 text-[15px] text-ink">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                      <span>{o.name}{o.priority !== "routine" && <b className="ml-1.5 text-xs text-rose-600">{t(o.priority === "stat" ? "today" : "within 24 h")}</b>}</span>
                    </li>
                  ))}
                  {referrals.map((o) => (
                    <li key={o.id} className="flex items-start gap-2 text-[15px] text-ink">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sun" />
                      <span>{referralText(o, t)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-400"><LocalizedText message={"Demo: no real laboratory or pharmacy is connected, and no results are delivered."} /></p>
              </Section>
            )}

            {nursing.length > 0 && (
              <Section icon={<CalendarCheck className="h-5 w-5" />} title="Our nurse will follow up">
                <ul className="space-y-1.5 text-[15px] text-ink">{nursing.map((o) => <li key={o.id}>{o.name}</li>)}</ul>
              </Section>
            )}

            {(e.followUp || e.sickNoteDays > 0) && (
              <Section icon={<FileText className="h-5 w-5" />} title="Follow-up and documents">
                {followUpText && <p className="text-[15px] text-ink">{followUpText}</p>}
                {fitNoteText && <p className="mt-1.5 text-[15px] text-ink">{fitNoteText}</p>}
              </Section>
            )}

            <p className="px-2 pt-2 text-center text-xs text-ink-400">{t("Signed by {value0}. If anything is unclear, message your care team from your next visit.", { value0: data.clinician.name })}</p>
          </>
        )}
      </main>
      {/* The browser's print dialog (which can also save a PDF). Shared print surface: while printing, only this document is
          shown, so the host shell and this phone column's chrome never reach the paper. Not a clinical document service. */}
      {data && e && (
        <PrintDocument>
          <div lang={language} dir={LANGUAGE_OPTIONS.find((l) => l.value === language)?.dir ?? "ltr"}>
            <h1>{t("Visit summary")}</h1>
            <p>{data.clinician.name} · {fmtDay(data.appointment.start)}, {fmtTime(data.appointment.start)}</p>
            {e.patientInstructions && <section><h2>{t("What to do next")}</h2><p style={{ whiteSpace: "pre-wrap" }}>{e.patientInstructions}</p></section>}
            {e.diagnoses.length > 0 && (
              <section><h2>{t("What we found")}</h2><ul>{e.diagnoses.map((d) => <li key={d.code}>{plain(d.display)}{d.certainty === "provisional" ? ` ${t("(likely, to be confirmed)")}` : ""}</li>)}</ul></section>
            )}
            {e.prescriptions.length > 0 && (
              <section>
                <h2>{t("Your medicines")}</h2>
                <ul>{e.prescriptions.map((p) => <li key={p.id}>{p.name} {p.strength}: {medicineDetail(p)}{p.instructions ? ` ${p.instructions}` : ""}</li>)}</ul>
              </section>
            )}
            {(tests.length > 0 || referrals.length > 0) && (
              <section><h2>{t("Tests and referrals")}</h2><ul>{tests.map((o) => <li key={o.id}>{o.name}</li>)}{referrals.map((o) => <li key={o.id}>{referralText(o, t)}</li>)}</ul></section>
            )}
            {nursing.length > 0 && <section><h2>{t("Our nurse will follow up")}</h2><ul>{nursing.map((o) => <li key={o.id}>{o.name}</li>)}</ul></section>}
            {(followUpText || fitNoteText) && <section><h2>{t("Follow-up and documents")}</h2>{followUpText && <p>{followUpText}</p>}{fitNoteText && <p>{fitNoteText}</p>}</section>}
            <p>{t("Signed by {value0}. If anything is unclear, message your care team from your next visit.", { value0: data.clinician.name })}</p>
            <p><small>{t("Printed from the CareCall demo with fictional data. This page is not a clinical document, a prescription or medical advice.")}</small></p>
          </div>
        </PrintDocument>
      )}
    </Screen>
  );
}
