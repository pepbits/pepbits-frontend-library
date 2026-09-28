"use client";
import {productNavigationTarget, productModuleForPage} from "@pepbits/erp-config";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

import { useProduct } from "../product-context";

import React, { useMemo, useState } from "react";
import { ChevronRight, LayoutDashboard, Search } from "lucide-react";
import { Badge, Modal } from "@pepbits/ops-ui";
import { useNavigation } from "@pepbits/platform-ports";
import { useERP } from "../erp-context";

export function CommandPalette() {
  const product = useProduct();
  const { t } = useLocalization();
  const { currentModule, commandOpen, setCommandOpen } = useERP();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const pages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return Object.values(product.pages)
      .filter(page => !currentModule?.startsWith('reference-school') || !page.module.startsWith('reference-school') || productModuleForPage(product,page.id,currentModule) === currentModule)
      .filter((page) => !term || `${t(page.titleKey ?? page.title)} ${t(page.subtitleKey ?? page.subtitle ?? "")} ${page.module} ${page.id} ${page.title} ${page.subtitle ?? ""}`.toLowerCase().includes(term))
      .slice(0, 18);
  }, [query, product, t, currentModule]);
  return (
    <Modal open={commandOpen} onClose={() => { setCommandOpen(false); setQuery(""); }} title="ui.open.page.or.command.2839f587" subtitle="ui.search.every.configured.module.master.transaction.report.05e26683" size="md">
      <div className="p-3">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3"><Search className="size-4 text-[var(--text-subtle)]" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search pages, modules and actions…")} className="h-full min-w-0 flex-1 bg-transparent text-[length:calc(12px*var(--fs-scale))] outline-none" /><kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[length:calc(8px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ESC" /></kbd></div>
        <div className="mt-2 max-h-[55vh] overflow-auto">{pages.map((page) => { const module = page.module === "shared" ? null : product.modules[productModuleForPage(product,page.id,currentModule) ?? page.module]; return <button key={page.id} type="button" onClick={() => { navigation.open(productNavigationTarget(product,page.id,currentModule)); setCommandOpen(false); setQuery(""); }} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--surface-2)]"><span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">{page.kind === "dashboard" ? <LayoutDashboard className="size-4" /> : <ChevronRight className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[length:calc(11px*var(--fs-scale))] font-extrabold">{t(page.titleKey ?? page.title)}</span><span className="mt-0.5 block truncate text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]">{t(page.subtitleKey ?? page.subtitle ?? "")}</span></span><Badge tone="neutral">{module?.shortLabel ?? "Shared"}</Badge></button>; })}</div>
      </div>
    </Modal>
  );
}
