"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "../../../navigation";
import {useSourceApi} from "../../../lib/api";
import type { Patient } from "../../../lib/types";
import { BookingFlow, type BookingPrefill } from "../../../components/booking/BookingFlow";
import { PageHeader, Spinner } from "../../../components/ui";

function BookInner() {
  const api = useSourceApi();
  const sp = useSearchParams();
  const [prefill, setPrefill] = useState<BookingPrefill | null>(null);
  useEffect(() => {
    const pid = sp.get("patient_id");
    const base: BookingPrefill = {
      serviceId: sp.get("service_id") ? Number(sp.get("service_id")) : undefined,
      resourceId: sp.get("resource_id") ? Number(sp.get("resource_id")) : undefined,
      date: sp.get("date") ?? undefined,
    };
    if (pid) api<Patient>(`/patients/${pid}`).then((p) => setPrefill({ ...base, patient: p })).catch(() => setPrefill(base));
    else setPrefill(base);
  }, [sp]);
  if (!prefill) return <div className="flex justify-center py-20"><Spinner /></div>;
  return <BookingFlow key={sp.toString()} prefill={prefill} />;
}

export default function BookPage() {
  return (
    <>
      <PageHeader title="Book an appointment" description="Find the patient, choose what they need, then pick a time. Only times when every person, room and machine is free are shown." />
      <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}><BookInner /></Suspense>
    </>
  );
}
