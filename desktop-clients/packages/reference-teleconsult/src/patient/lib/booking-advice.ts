"use client";
import { useCallback, useEffect, useState } from "react";
import { qs } from "../../shared/client";
import { parseBookingAdvice, type BookingAdvice } from "../../shared/contract";
import { useTeleconsultClient } from "./api";

interface Settled { key: string; advice?: BookingAdvice; error?: string }
const ADVICE_DELAY_MS = 250;

/**
 * Specialty suggestion and urgency for the current answers, from GET /api/booking-advice. The rules live on
 * the server; this only asks. The answer is tied to the exact (patient, symptoms, severity) it was requested
 * for, so a late or earlier answer is never returned for different answers: `advice` is undefined until the
 * server has answered the current ones.
 */
export function useBookingAdvice(patientId: string | undefined, symptoms: string[], severity: number) {
  const client = useTeleconsultClient();
  const key = JSON.stringify([patientId, symptoms, severity]);
  const [settled, setSettled] = useState<Settled>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!patientId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      client.get<unknown>(`/api/booking-advice${qs({ patientId, symptoms: symptoms.join(","), severity })}`, { signal: controller.signal })
        .then((raw) => { if (!controller.signal.aborted) setSettled({ key, advice: parseBookingAdvice(raw) }); })
        .catch((e) => { if (!controller.signal.aborted && (e as Error).name !== "AbortError") setSettled({ key, error: (e as Error).message }); });
    }, ADVICE_DELAY_MS);
    return () => { clearTimeout(timer); controller.abort(); };
    // `key` encodes patientId, symptoms and severity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key, attempt]);

  const current = settled?.key === key ? settled : undefined;
  const retry = useCallback(() => { setSettled(undefined); setAttempt((n) => n + 1); }, []);
  return { advice: current?.advice, error: current?.error, loading: !current, retry };
}
