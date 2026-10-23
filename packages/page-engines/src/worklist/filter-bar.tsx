"use client";
import {DateInput} from "@pepbits/ui";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";

import React, { useId, useState } from "react";
import { ChevronDown, Link2, Lock, RotateCcw, Share2, SlidersHorizontal } from "@pepbits/icons";
import {Button, Input, Select, cn} from "@pepbits/ui";
import {ReferenceDataWarning, ReferenceField, referenceStateOf} from "@pepbits/components";
import type { ReferenceResponse } from "@pepbits/components";
import {isUrlSafe, type FilterDefinition, type FilterValues} from "../types";

/**
 * One filter bar, driven by the registry.
 *
 * The classification does two visible things: it marks the fields that will not
 * travel in a link, and it decides which of the two share affordances is
 * offered. Both matter — a user who cannot tell which filters survive sharing
 * finds out by sharing one that does not.
 */
export function FilterBar({ definitions, advanced, values, sensitiveKeys, reference, referenceKeys, onChange, onReset, onApply, onRetryReference, onCopyLink, onSaveView, className }: {
  definitions: FilterDefinition[];
  /** A second group, collapsed by default. Classified exactly like the first. */
  advanced?: FilterDefinition[];
  values: FilterValues;
  sensitiveKeys: string[];
  /**
   * Lists that came from the server, and which of them failed.
   *
   * A select whose options are static needs none of this. One whose options are
   * reference data does: an empty branch dropdown means either "this tenant has
   * no branches" or "the branch service is down", and those look identical and
   * mean opposite things.
   */
  reference?: ReferenceResponse;
  /** Filter key to reference key, for the selects that are fed from the server. */
  referenceKeys?: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  onApply?: () => void;
  onRetryReference?: () => void;
  onCopyLink?: () => void;
  onSaveView?: () => void;
  className?: string;
}) {
  const base = useId();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const holdingBack = sensitiveKeys.length > 0;
  /* `holdingBack` counts too. A worklist's search box lives above this bar and
     is not one of `values`, so a name typed into it made the whole share row
     disappear — nothing to copy, and no offer to save the view that could
     carry it. Anything being held back is something to share. */
  const anyFilter = holdingBack || Object.values(values).some((value) => value.trim() !== "");
  /* Counted while collapsed: a filter set inside a closed section is a filtered
     list with nothing on screen saying why. */
  const advancedSet = (advanced ?? []).filter((definition) => (values[definition.key] ?? "").trim() !== "").length;

  /* Only the failures for lists this bar actually shows. A page asking for four
     reference lists and rendering one of them must not report the other three's
     outages over a filter nobody can see. */
  const shown = new Set(Object.values(referenceKeys ?? {}));
  const failures = (reference?.failures ?? []).filter((failure) => shown.has(failure.key));
  const referenceLabels = Object.fromEntries(
    Object.entries(referenceKeys ?? {}).map(([filterKey, referenceKey]) =>
      [referenceKey, [...definitions, ...(advanced ?? [])].find((definition) => definition.key === filterKey)?.label ?? referenceKey]),
  );

  const {t} = useLocalization();
  const renderField = (definition: FilterDefinition) => {
    const sensitive = !isUrlSafe(definition);
    const noteId = `${base}-${definition.key}-note`;
    const common = {
      label: definition.label,
      value: values[definition.key] ?? "",
      "aria-describedby": sensitive ? noteId : undefined,
    };
    const referenceKey = referenceKeys?.[definition.key];
    return (
      <div key={definition.key} className="min-w-0">
        {referenceKey && reference ? (
          /* Server-fed: the state of the list is part of the control, so an
             outage disables it rather than showing an empty dropdown that reads
             as "none configured". */
          <ReferenceField
            label={definition.label}
            state={referenceStateOf(reference, referenceKey)}
            options={reference.references[referenceKey] ?? []}
            value={values[definition.key] ?? ""}
            onChange={(next) => onChange(definition.key, next)}
          />
        ) : definition.type === "select" ? (
          <Select {...common} options={(definition.options ?? []).filter((o) => o !== "All").map((o) => ({ label: definition.optionLabels?.[o] ?? o, value: o }))} placeholder="ui.all.a52ace42" onChange={(event) => onChange(definition.key, event.target.value)} />
        ) : definition.type === "date" ? (
          <DateInput {...common} onChange={(event) => onChange(definition.key, event.target.value)} />
        ) : (
          <Input {...common} type="text" placeholder={t("Enter {field}", {field:t(definition.label)})} onChange={(event) => onChange(definition.key, event.target.value)} />
        )}
        {sensitive ? (
          /* Described, not just tinted. Which fields survive a share is the one
             thing this bar has to communicate, and a colour communicates it to
             some people. */
          <p id={noteId} className="mt-1 flex items-center gap-1 text-[length:calc(9px*var(--fs-scale))] font-semibold text-[var(--text-subtle)]">
            <Lock aria-hidden className="size-3 shrink-0" /><LocalizedText message="ui.kept.out.of.the.link.not.included.in.the.url.6c7f6a2e" /></p>
        ) : null}
      </div>
    );
  };

  return (
    <section className={cn("rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]", className)}>
      {failures.length ? (
        /* The banner names every broken list; the field says it again at the
           control. A user looking at an empty dropdown is looking at the field,
           not at a banner that may have scrolled away. */
        <ReferenceDataWarning className="m-3 mb-0" failures={failures} labels={referenceLabels} onRetry={onRetryReference} />
      ) : null}

      <div className="grid gap-3 p-3 md:grid-cols-3">
        {definitions.map(renderField)}
      </div>

      {advanced?.length ? (
        <div className="border-t border-[var(--border)]">
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
            className="focus-ring flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="flex items-center gap-2 text-[length:calc(10.5px*var(--fs-scale))] font-bold text-[var(--text-muted)]">
              <SlidersHorizontal aria-hidden className="size-3.5" /><LocalizedText message="ui.advanced.filters.db332598" />{advancedSet ? t(" ({count} set)",{count:advancedSet}) : ""}
            </span>
            <ChevronDown aria-hidden className={cn("size-4 text-[var(--text-subtle)] transition", advancedOpen && "rotate-180")} />
          </button>
          {advancedOpen ? (
            <div className="grid gap-3 border-t border-[var(--border)] p-3 md:grid-cols-3">{advanced.map(renderField)}</div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-3 py-2">
        {holdingBack ? (
          <p className="mr-auto flex items-center gap-1.5 text-[length:calc(9.5px*var(--fs-scale))] font-semibold text-[var(--text-muted)]">
            <Lock aria-hidden className="size-3.5 shrink-0 text-[var(--warning-ink)]" />
            {t(sensitiveKeys.length===1?"{count} filter cannot be put in a link. Save a view to share this.":"{count} filters cannot be put in a link. Save a view to share this.", {count:sensitiveKeys.length})}</p>
        ) : <span className="mr-auto" />}

        {/* One or the other, never both. Offering "copy link" beside a sensitive
            filter hands someone a link that silently drops half of what they
            are looking at. */}
        {anyFilter && holdingBack && onSaveView ? (
          <Button size="sm" variant="secondary" leftIcon={<Share2 className="size-3.5" />} onClick={onSaveView}><LocalizedText message="ui.create.saved.view.488ed7c5" /></Button>
        ) : null}
        {anyFilter && !holdingBack && onCopyLink ? (
          <Button size="sm" variant="secondary" leftIcon={<Link2 className="size-3.5" />} onClick={onCopyLink}><LocalizedText message="ui.copy.link.dbf362d4" /></Button>
        ) : null}
        {onApply ? <Button size="sm" variant="primary" onClick={onApply}><LocalizedText message="ui.apply.31e392d1" /></Button> : null}
        <Button size="sm" variant="ghost" leftIcon={<RotateCcw className="size-3.5" />} onClick={onReset}><LocalizedText message="ui.reset.daee7606" /></Button>
      </div>
    </section>
  );
}
