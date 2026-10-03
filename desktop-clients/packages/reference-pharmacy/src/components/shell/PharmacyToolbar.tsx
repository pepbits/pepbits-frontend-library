"use client";
import { Plus, Search } from "lucide-react";
import { LocalizedText } from "@pepbits/ops-ui";
import { Button, Kbd } from "../ui/primitives";
import { SourceButton } from "../ui/controls";
import { useShell } from "./ShellContext";

/**
 * The part of the source top bar that belongs to the page: the command palette entry and "New prescription" (the title,
 * navigation, theme switch and user menu are the host's). Beside them sits the demonstration-data notice: every record in
 * this workspace is fictional and the module makes no production clinical or payer claim.
 */
export function PharmacyToolbar() {
  const { openPalette, openNewRx } = useShell();
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 md:px-5" data-pharmacy-toolbar="true">
      <span className="hidden shrink-0 rounded border border-amber-mark/40 bg-amber-wash px-2 py-0.5 text-xs text-amber lg:inline-block"><LocalizedText message="Demonstration data" /></span>
      <SourceButton onClick={openPalette} className="mx-auto hidden h-9 w-full max-w-md items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-left text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:flex">
        <Search className="size-4" />
        <span className="flex-1 truncate"><LocalizedText message="Find a patient, prescription, product or claim" /></span>
        <Kbd>{"⌘K"}</Kbd>
      </SourceButton>
      <span className="flex-1 sm:hidden" />
      <span className="hidden md:block"><Button variant="primary" icon={<Plus className="size-4" />} onClick={openNewRx} kbd="N"><LocalizedText message="New prescription" /></Button></span>
      <SourceButton aria-label="New prescription" onClick={openNewRx} className="flex size-8 shrink-0 items-center justify-center rounded-md bg-cobalt text-on-cobalt hover:bg-cobalt-strong md:hidden"><Plus className="size-[18px]" /></SourceButton>
    </header>
  );
}
