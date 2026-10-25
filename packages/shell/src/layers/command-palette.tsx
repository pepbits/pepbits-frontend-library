"use client";
import {productNavigationTarget, productModuleForPage} from "../products";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";

import { useShell } from "../shell-context";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, LayoutDashboard, Search } from "@pepbits/icons";
import { Badge } from "@pepbits/ui";
import { Modal } from "@pepbits/components";
import { useNavigation } from "@pepbits/platform";
import { useERP, type CommandSearch, type CommandSearchResult } from "../shell-context";

export function CommandPalette() {
  const {product} = useShell();
  const { t } = useLocalization();
  const { currentModule, commandOpen, setCommandOpen } = useERP();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const pages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return Object.values(product.pages)
      .filter((page) => !term || `${t(page.titleKey ?? page.title)} ${t(page.subtitleKey ?? page.subtitle ?? "")} ${page.module} ${page.id} ${page.title} ${page.subtitle ?? ""}`.toLowerCase().includes(term))
      .slice(0, 18);
  }, [query, product, t, currentModule]);
  const {commandSearch} = useShell();
  const records = useCommandSearch(commandSearch, commandOpen ? query : "");
  const close = () => { setCommandOpen(false); setQuery(""); };
  return (
    <Modal open={commandOpen} onClose={() => { setCommandOpen(false); setQuery(""); }} title="ui.open.page.or.command.2839f587" subtitle="ui.search.every.configured.module.master.transaction.report.05e26683" size="md">
      <div className="p-3">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3"><Search className="size-4 text-[var(--text-subtle)]" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("Search pages, modules and actions…")} placeholder={t("Search pages, modules and actions…")} className="h-full min-w-0 flex-1 bg-transparent text-[length:calc(12px*var(--fs-scale))] outline-none" /><kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[length:calc(8px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ESC" /></kbd></div>
        <div className="mt-2 max-h-[55vh] overflow-auto">{records.map(([group, items]) => <div key={group} role="group" aria-label={group} data-command-search-group={group}><p aria-hidden className="px-3 pb-1 pt-2 text-[length:calc(9px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{group}</p>{items.map(item => <button key={item.id} type="button" data-command-search-result={item.id} onClick={() => { navigation.open(item.target); close(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-2)]"><span className="min-w-0 flex-1 truncate text-[length:calc(11px*var(--fs-scale))] font-bold">{item.label}</span>{item.hint ? <span className="shrink-0 text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]">{item.hint}</span> : null}</button>)}</div>)}{pages.map((page) => { const module = page.module === "shared" ? null : product.modules[productModuleForPage(product,page.id,currentModule) ?? page.module]; return <button key={page.id} type="button" onClick={() => { navigation.open(productNavigationTarget(product,page.id,currentModule)); setCommandOpen(false); setQuery(""); }} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--surface-2)]"><span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">{page.kind === "dashboard" ? <LayoutDashboard className="size-4" /> : <ChevronRight className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[length:calc(11px*var(--fs-scale))] font-extrabold">{t(page.titleKey ?? page.title)}</span><span className="mt-0.5 block truncate text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]">{t(page.subtitleKey ?? page.subtitle ?? "")}</span></span><Badge tone="neutral">{module?.shortLabel ?? "Shared"}</Badge></button>; })}</div>
      </div>
    </Modal>
  );
}

/** Debounced host search. Superseded and closed queries are aborted; failures show page matches only. */
function useCommandSearch(search: CommandSearch | undefined, query: string) {
  const [state, setState] = useState<{query: string; results: readonly CommandSearchResult[]}>({query: "", results: []});
  const term = query.trim();
  useEffect(() => {
    if (!search || !term) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      search(term, controller.signal).then(results => { if (!controller.signal.aborted) setState({query: term, results}); }, () => { if (!controller.signal.aborted) setState({query: term, results: []}); });
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, term]);
  return useMemo(() => {
    const groups = new Map<string, CommandSearchResult[]>();
    if (search && term && state.query === term) for (const item of state.results) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    return [...groups.entries()];
  }, [search, term, state]);
}
