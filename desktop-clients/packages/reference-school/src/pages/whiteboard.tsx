"use client";

import { useLocalization as useReferenceLocalization } from "@pepbits/ops-ui";
import { Video } from "lucide-react";
import { Link } from "../lib/router";
import { Button } from "../ui";
import { Whiteboard } from "../components/whiteboard/whiteboard";
import { useSession } from "../lib/session";

export function WhiteboardPage() {
  const referenceT = useReferenceLocalization().t;
  const { role } = useSession();
  return (
    <div className="flex h-full min-h-[520px] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>{role === "student" ? referenceT("Your personal scratch board for working out problems. Pages stay until you leave the page; download a PNG to keep them.") : referenceT("Plan a lesson or sketch an explanation. The same board opens inside every live class for everyone in the room.")}</span>
        <Link href="/live" className="ml-auto"><Button size="xs" variant="subtle" icon={Video}>{role === "student" ? referenceT("Join a live class") : referenceT("Use in a live class")}</Button></Link>
      </div>
      <Whiteboard className="min-h-0 flex-1" />
    </div>
  );
}
