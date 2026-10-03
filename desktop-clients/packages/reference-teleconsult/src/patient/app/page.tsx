"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { SourceButton } from "../../shared/controls";
import { useEffect, useState } from "react";
import { useReferenceRouter as useRouter } from "@pepbits/reference-host";
import { ChevronRight, Loader2, Video } from "lucide-react";
import { usePatient } from "../lib/session";
import { Avatar, Button, Notice } from "../components/ui";

export default function Welcome() {
  const router = useRouter();
  const { patient, patients, canRegister, ready, error, signIn } = usePatient();
  const [busy, setBusy] = useState<string>();
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    if (ready && patient) router.replace("/home");
  }, [ready, patient, router]);

  const go = async (id: string) => {
    setBusy(id);
    setFailure(undefined);
    try {
      await signIn(id);
      router.push("/home");
    } catch (e) {
      setFailure((e as Error).message);
      setBusy(undefined);
    }
  };

  return (
    <main className="flex min-h-full flex-1 flex-col px-5 pb-8 pt-12">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest">
          <Video className="h-5 w-5 text-sun" />
        </span>
        <span className="text-lg font-bold tracking-tight text-forest"><LocalizedText message={"CareCall"} /></span>
      </div>

      <h1 className="mt-10 text-[34px] font-extrabold leading-[1.08] tracking-tight text-forest">
        
        <LocalizedText message={"See a doctor today,"} />
        <br />
        
        <LocalizedText message={"from your phone."} />
      </h1>
      <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed text-ink-600">
        
        <LocalizedText message={"Book a video visit, share readings from your home devices, and get your prescription and notes right here."} />
      </p>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-ink-600"><LocalizedText message={"Continue as"} /></h2>
        {(error || failure) && <Notice tone="error">{failure ?? error}</Notice>}
        {ready && !patients.length && !error && <Notice><LocalizedText message={"No patient record is linked to this account yet."} /></Notice>}
        <ul className="max-h-[360px] overflow-y-auto rounded-3xl bg-white">
          {!ready && (
            <li className="flex justify-center p-6 text-ink-400"><Loader2 className="h-5 w-5 animate-spin" /></li>
          )}
          {patients.map((p, i) => (
            <li key={p.id} className={i ? "border-t border-mint" : ""}>
              <SourceButton onClick={() => go(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-mint-50">
                <Avatar name={`${p.firstName} ${p.lastName}`} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{p.firstName} {p.lastName}</span>
                  <span className="block text-xs text-ink-400">{p.phone}</span>
                </span>
                {busy === p.id ? <Loader2 className="h-5 w-5 animate-spin text-forest" /> : <ChevronRight className="h-5 w-5 text-ink-200" />}
              </SourceButton>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-xs text-ink-400"><LocalizedText message={"Demo: you can only continue as people your account is allowed to act for. A production sign-in would use a one-time code."} /></p>
      </section>

      <div className="mt-auto pt-8">
        {canRegister && <Button variant="sun" block onClick={() => router.push("/register")}><LocalizedText message={"Create an account"} /></Button>}
      </div>
    </main>
  );
}
