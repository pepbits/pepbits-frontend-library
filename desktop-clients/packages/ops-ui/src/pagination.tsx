"use client";
import { LocalizedText } from "./localization";


import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, IconButton } from "./button";
import { Select } from "./form-controls";

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeDisabled = false, hasMore }: { hasMore?: boolean; pageSizeDisabled?: boolean; page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: 10 | 20 | 50 | 100) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const visible = Array.from({ length: Math.min(5, pages) }, (_, index) => {
    let first = Math.max(1, page - 2);
    if (first + 4 > pages) first = Math.max(1, pages - 4);
    return first + index;
  });
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2">
      <div className="flex items-center gap-3 text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--text-muted)]">
        <span><LocalizedText message="ui.showing.7282e1fb" /><b className="text-[var(--text)]">{start}–{end}</b>{hasMore === undefined ? <><LocalizedText message="ui.of.a4282e4b" /><b className="text-[var(--text)]">{total}</b></> : null}</span>
        <div className="w-28"><Select disabled={pageSizeDisabled} aria-label="ui.rows.per.page.141b69f9" value={String(pageSize)} placeholder="" options={[{ label: "10 / page", value: "10" }, { label: "20 / page", value: "20" }, { label: "50 / page", value: "50" }, { label: "100 / page", value: "100" }]} onChange={(event) => onPageSizeChange(Number(event.target.value) as 10 | 20 | 50 | 100)} /></div>
      </div>
      <div className="flex items-center gap-1">
        <IconButton label="ui.previous.page.1208ec01" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="size-4" /></IconButton>
        {/* aria-current, not just the filled variant: styled alone, the row
            reads to a screen reader as five identical numbered buttons with
            nothing saying which one is the page you are on. */}
        {(hasMore === undefined ? visible : [page]).map((item) => <Button key={item} size="xs" variant={item === page ? "primary" : "ghost"} aria-current={item === page ? "page" : undefined} className="min-w-7 px-2" onClick={() => onPageChange(item)}>{item}</Button>)}
        <IconButton label="ui.next.page.c08ac736" disabled={hasMore === undefined ? page >= pages : !hasMore} onClick={() => onPageChange(page + 1)}><ChevronRight className="size-4" /></IconButton>
      </div>
    </div>
  );
}
