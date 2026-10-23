"use client";

import { useEffect, useState } from "react";

/**
 * The current time, or null until the client has mounted.
 *
 * NULL FIRST IS THE POINT. Rendering a clock during SSR bakes the *server's*
 * time into the HTML, and React reports a hydration mismatch the moment the
 * client disagrees -- which it always will. Callers render a placeholder of the
 * same width until this fills in.
 *
 * The interval is the caller's choice because the cost is theirs: a display with
 * minute resolution ticking every second is 59 wasted renders a minute.
 */
export function useClock(intervalMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
