"use client";
import React, { useCallback, useId } from "react";
import { Button, Select, Textarea } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useConsultHost, useConsultPort } from "../context/consult-host";
import { ConsultSection } from "../layout/ConsultSection";
import type { ConsultSectionProps } from "../models/consult-workflow";
import { OrderLoadProblems, useOrderResource } from "../orders/OrderPriority";
export function EducationSection(props: ConsultSectionProps) {
  const { draft, detail, onChange, readOnly } = props,
    port = useConsultPort(),
    host = useConsultHost(),
    { t } = useLocalization(),
    uid = useId();
  const templates = useOrderResource(
    useCallback(
      (signal: AbortSignal) => port.listEducationTemplates(signal),
      [port]
    )
  );
  const update: typeof onChange = (fn) => {
    if (!readOnly) onChange(fn);
  };
  return (
    <ConsultSection
      id={props.id ?? uid}
      stickyOffset={host.stickyOffset}
      title="Education materials"
    >
      <OrderLoadProblems {...templates} />
      <Select
        label="Add education material"
        disabled={readOnly}
        value=""
        options={[
          { value: "", label: "Add education material…" },
          ...(templates.data ?? [])
            .filter((x) => !draft.education.some((e) => e.templateId === x.id))
            .map((x) => ({ value: x.id, label: x.title })),
        ]}
        onChange={(e) => {
          const template = templates.data?.find((x) => x.id === e.target.value);
          if (template)
            update((n) => {
              if (n.education.some((x) => x.templateId === template.id)) return;
              n.education.push({
                templateId: template.id,
                title: `${template.title} (v${template.version})`,
                language: template.languages.includes(
                  detail.patient.preferredLanguage
                )
                  ? detail.patient.preferredLanguage
                  : "en",
                method: ["verbal"],
                understanding: null,
              });
            });
        }}
      />
      <ul>
        {draft.education.map((education, index) => (
          <li key={education.templateId}>
            <p>
              {education.title} · {education.language.toUpperCase()}
            </p>
            <Select
              label={`${t("Understanding of")} ${education.title}`}
              disabled={readOnly}
              value={education.understanding ?? ""}
              options={[
                { value: "", label: "Choose" },
                { value: "understood", label: "Understood" },
                { value: "partial", label: "Partly" },
                { value: "not-assessed", label: "Not checked" },
              ]}
              onChange={(e) =>
                update((n) => {
                  n.education[index]!.understanding =
                    (e.target.value as "understood") || null;
                })
              }
            />
            <Button
              disabled={readOnly}
              aria-label={`${t("Remove")} ${education.title}`}
              onClick={() =>
                update((n) => {
                  n.education.splice(index, 1);
                })
              }
            >
              {t("Remove")}
            </Button>
          </li>
        ))}
      </ul>
      <Textarea
        label="Advice given"
        disabled={readOnly}
        rows={2}
        value={draft.advice}
        onChange={(e) =>
          update((n) => {
            n.advice = e.target.value;
          })
        }
      />
    </ConsultSection>
  );
}
