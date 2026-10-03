"use client";
import { CalendarPlus, Search, UserPlus } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { useHotkeys } from "../../lib/hooks";
import { useStore } from "../../lib/store";
import { medbandPaths } from "../../routes";
import { SourceButton } from "../controls";
import { Kbd, LinkButton } from "../ui/primitives";
import { CommandPalette } from "./CommandPalette";
import { CounterSwitcher } from "./CounterSwitcher";

/**
 * The source AppShell without its chrome. The title, navigation rail and identity belong to the host shell; what remains is the
 * source top bar's working part: the quick search (Ctrl/Cmd+K, only while the host's shortcut preference is on), Register,
 * New encounter and the counter switcher. The source's "Reset demo data" is not offered: the backend blocks it for embedded hosts.
 */
export function MedbandShell({ children }: { children: ReactNode }) {
  const { demo } = useStore();
  const [palette, setPalette] = useState(false);
  const close = useCallback(() => setPalette(false), []);
  useHotkeys({ "mod+k": () => setPalette((p) => !p) });
  const notice = demo === true || (typeof demo === "object" && demo !== null);

  return (
    <div className="flex flex-col" style={{ height: "max(36rem, calc(100dvh - var(--medband-chrome, 7.5rem)))" }} data-medband-stage="true">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-paper/80 px-4 backdrop-blur md:px-6" data-medband-toolbar="true">
        {notice && <span className="hidden shrink-0 rounded bg-band/30 px-2 py-0.5 text-xs text-ink xl:inline-block"><LocalizedText message="Demonstration data" /></span>}
        <SourceButton
          onClick={() => setPalette(true)}
          className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg bg-canvas px-3 text-left text-sm text-ink-faint transition-colors hover:bg-scrub-50 md:max-w-md"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate"><LocalizedText message="Search patient by name, MRN, phone or member ID" /></span>
          <span className="ml-auto hidden gap-1 sm:flex">
            <Kbd>{"Ctrl"}</Kbd>
            <Kbd>{"K"}</Kbd>
          </span>
        </SourceButton>
        <div className="ml-auto flex items-center gap-2">
          <LinkButton href={medbandPaths.patientNew()} variant="secondary" className="hidden lg:inline-flex">
            <UserPlus className="size-4" /> <LocalizedText message="Register" />
          </LinkButton>
          <LinkButton href={medbandPaths.encounterNew()} variant="primary">
            <CalendarPlus className="size-4" /> <span className="hidden sm:inline"><LocalizedText message="New encounter" /></span>
          </LinkButton>
          <CounterSwitcher />
        </div>
      </header>
      <main id="main" className="scroll-thin min-h-0 flex-1 overflow-auto">{children}</main>
      {palette && <CommandPalette onClose={close} />}
    </div>
  );
}
