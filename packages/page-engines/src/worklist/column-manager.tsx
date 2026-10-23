"use client";
import {Card} from "@pepbits/components";
import {LocalizedText} from "@pepbits/i18n/react";

import React from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, RotateCcw } from "@pepbits/icons";
import {Modal} from "@pepbits/components";
import {Button, IconButton} from "@pepbits/ui";
import {cn} from "@pepbits/ui";
import type {DataColumn} from "../types";

export function ColumnManager({ open, onClose, columns, visibleKeys, onChange, onReset }: { open: boolean; onClose: () => void; columns: DataColumn[]; visibleKeys: string[]; onChange: (keys: string[]) => void; onReset: () => void }) {
  const toggle = (key: string) => {
    if (visibleKeys.includes(key)) {
      if (visibleKeys.length === 1) return;
      onChange(visibleKeys.filter((item) => item !== key));
    } else {
      onChange([...visibleKeys, key]);
    }
  };
  const move = (key: string, direction: -1 | 1) => {
    const next = [...visibleKeys];
    const index = next.indexOf(key);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  const ordered = [...visibleKeys.map((key) => columns.find((column) => column.key === key)).filter(Boolean), ...columns.filter((column) => !visibleKeys.includes(column.key))] as DataColumn[];
  return (
    <Modal open={open} onClose={onClose} title="ui.columns.layout.cfbf6147" subtitle="ui.choose.visible.columns.and.save.their.order.for.this.pag.9658cf67" size="sm" footer={<><Button variant="ghost" leftIcon={<RotateCcw className="size-3.5" />} onClick={onReset}><LocalizedText message="ui.reset.daee7606" /></Button><Button variant="primary" onClick={onClose}><LocalizedText message="ui.done.11a6767d" /></Button></>}>
      <div className="p-4">
        <Card shadow="none" tone="muted" radius="xl" className="mb-3 px-3 py-2 text-[length:calc(10px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.column.choices.are.stored.per.page.the.same.saved.layout.96049e42" /></Card>
        <div className="space-y-1.5">
          {ordered.map((column) => {
            const visible = visibleKeys.includes(column.key);
            const index = visibleKeys.indexOf(column.key);
            return <div key={column.key} className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-2", visible ? "border-[var(--border)] bg-[var(--surface)]" : "border-transparent bg-[var(--surface-2)] opacity-65")}><GripVertical className="size-3.5 text-[var(--text-subtle)]" /><button type="button" onClick={() => toggle(column.key)} className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", visible ? "border-[var(--primary)] bg-[var(--primary-fill)] text-white" : "border-[var(--border-strong)]")}><Check className={cn("size-3", !visible && "opacity-0")} /></button><span className="min-w-0 flex-1 text-[length:calc(10.5px*var(--fs-scale))] font-bold"><LocalizedText message={column.label} /></span>{visible ? <div className="flex"><IconButton label="ui.move.up.c66feb5e" className="size-7" disabled={index <= 0} onClick={() => move(column.key, -1)}><ArrowUp className="size-3" /></IconButton><IconButton label="ui.move.down.40bb50da" className="size-7" disabled={index >= visibleKeys.length - 1} onClick={() => move(column.key, 1)}><ArrowDown className="size-3" /></IconButton></div> : null}</div>;
          })}
        </div>
      </div>
    </Modal>
  );
}
