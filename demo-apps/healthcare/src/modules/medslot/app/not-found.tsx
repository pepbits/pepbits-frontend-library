"use client";
import {LocalizedText} from "@pepbits/i18n/react";
import {ReferenceLink as Link} from "../host";
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-mute">404</p>
      <h1 className="text-2xl font-semibold"><LocalizedText message="This page doesn't exist" /></h1>
      <Link href="/" className="text-sm font-medium text-scrub hover:underline"><LocalizedText message="Go to the dashboard" /></Link>
    </div>
  );
}
