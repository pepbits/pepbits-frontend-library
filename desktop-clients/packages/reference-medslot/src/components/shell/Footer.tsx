"use client";
import {LocalizedText} from "@pepbits/ops-ui";

import { ShieldCheck } from "lucide-react";
import { useAuth } from "./auth";

export function Footer() {
  const { settings } = useAuth();

  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-mute lg:px-6">
      <span>{settings.facility_name}</span>
      <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-scrub" aria-hidden />
        <LocalizedText message="Patient information is confidential. Sign-in and session expiry are managed by the workspace." /></span>
      <span><LocalizedText message="MedSlot 1.0" /></span>
    </footer>
  );
}
