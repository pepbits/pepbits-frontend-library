"use client";
import React, { useState } from "react";
import {CardGrid, Tabs, Modal} from '@pepbits/components';
import {Button, Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {
  Stethoscope,
  ClipboardCheck,
  Pill,
  Activity,
  FileText,
} from "@pepbits/icons";
import {validateComprehensive} from '../../domain/comprehensive-consultation';
import { ConsultationSection } from "../clinical-consultation/fields";
import { requiredFields } from "../op-consultation/board";
import { DiagnosisPanel } from "./diagnoses";
import { OrdersPanel } from "./orders";
import { ScoresPanel } from "./scores";
import { SpecialtyPanel, EMPanel, ReportingPanel } from "./context-panels";
import { ConsultationReview } from "./review";
import { Panel, Hint, key, type ComprehensiveProps } from "./shared";
export const comprehensiveSections = [
  { id: "context", label: key("context") },
  { id: "history", label: "template.consultation.historySection" },
  { id: "assessment", label: "template.consultation.assessmentSection" },
  { id: "plan", label: "template.consultation.planSection" },
  ...["coding", "orders", "scores", "em", "reporting"].map((id) => ({
    id,
    label: key(id),
  })),
];
export function ComprehensiveBoard({
  section,
  flat,
  ...p
}: ComprehensiveProps & { section: string; flat: boolean }) {
  const { t } = useLocalization(),
    [review, setReview] = useState(false),
    complete = requiredFields.filter((f) => p.values[f].trim()).length;
  const invalid = validateComprehensive(p.values, p.config, true);
  const active =
    comprehensiveSections.find((s) => s.id === section) ??
    comprehensiveSections[0];
  return (
    <>
      <CardGrid
        columns={flat ? 3 : 2}
        style={{
          gridTemplateColumns: flat
            ? "minmax(10rem,.65fr) minmax(0,2.6fr) minmax(14rem,.9fr)"
            : "minmax(0,2.6fr) minmax(14rem,.9fr)",
        }}
        data-comprehensive-board
      >
        {flat ? (
          <Panel
            title="template.op.navigator"
            action={<Stethoscope className="size-4" />}
          >
            <Tabs
              orientation="vertical"
              items={comprehensiveSections}
              value={active!.id}
              onChange={(id) => p.navigate?.(id)}
            />
          </Panel>
        ) : null}
        <div className="min-w-0">
          {section === "context" ? (
            <SpecialtyPanel {...p} />
          ) : section === "coding" ? (
            <DiagnosisPanel {...p} />
          ) : section === "orders" ? (
            <OrdersPanel {...p} />
          ) : section === "scores" ? (
            <ScoresPanel {...p} />
          ) : section === "em" ? (
            <EMPanel {...p} />
          ) : section === "reporting" ? (
            <ReportingPanel {...p} />
          ) : (
            <ConsultationSection
              {...p}
              section={
                section === "assessment"
                  ? "assessment"
                  : section === "plan"
                    ? "plan"
                    : "history"
              }
            />
          )}
        </div>
        <Panel
          title={key("snapshot")}
          action={<ClipboardCheck className="size-4" />}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs">{t("template.op.summary")}</span>
            <Badge
              tone={complete === requiredFields.length ? "success" : "neutral"}
            >
              {p.format?.number(complete)}/
              {p.format?.number(requiredFields.length)}
            </Badge>
          </div>
          <Hint message="template.op.readiness" />
          <div className="space-y-2">
            {[
              {
                id: "coding",
                icon: FileText,
                count: p.values.diagnoses.length,
              },
              { id: "orders", icon: Pill, count: p.values.orders.length },
              { id: "scores", icon: Activity, count: p.values.scores.length },
            ].map((item) => (
              <Button
                key={item.id}
                className="w-full justify-between"
                onClick={() => p.navigate?.(item.id)}
              >
                <item.icon className="size-4" />
                <span>{t(key(item.id))}</span>
                <Badge>{p.format?.number(item.count)}</Badge>
              </Button>
            ))}
          </div>
          <div className="border-t border-[var(--border)] pt-2">
            <p className="text-xs font-semibold">
              {t("template.consultation.allergyReview")}
            </p>
            <p className="line-clamp-2 break-words text-xs text-[var(--text-muted)]">
              {p.values.allergyDetails ||
                t(
                  p.values.allergyReview
                    ? "template.consultation." + p.values.allergyReview
                    : "template.op.notRecorded",
                )}
            </p>
          </div>
          <Button className="w-full" onClick={() => setReview(true)}>
            {t(key("review"))}
          </Button>
          {Object.keys(invalid).length ? (
            <Button
              size="xs"
              className="w-full"
              onClick={() =>
                p.navigate?.(sectionForComprehensive(Object.keys(invalid)[0]!))
              }
            >
              {t(key("missingItems"))} ·{" "}
              {p.format?.number(Object.keys(invalid).length)}
            </Button>
          ) : null}
        </Panel>
      </CardGrid>
      <Modal
        open={review}
        onClose={() => setReview(false)}
        title={t(key("review"))}
        size="xl"
      >
        <ConsultationReview {...p} />
      </Modal>
    </>
  );
}
export function sectionForComprehensive(field: string) {
  if (["specialty", "context", "specialtyNotes"].includes(field))
    return "context";
  if (field === "diagnoses") return "coding";
  if (["orders", "scores", "em"].includes(field)) return field;
  if (["profile", "attested", "reportingNotes"].includes(field))
    return "reporting";
  if (["examination", "diagnosis", "allergyReview"].includes(field))
    return "assessment";
  if (["treatment", "followUp", "safetyAdvice"].includes(field)) return "plan";
  return "history";
}
