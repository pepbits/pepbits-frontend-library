"use client";
import React, { useId, useState } from "react";
import { Button, Input, Select, Badge } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useClinicalActor } from "../context/clinical-context";
import { useConsultHost } from "../context/consult-host";
import { ConsultSection } from "../layout/ConsultSection";
import { CodedSearch } from "../complaint/CodedSearch";
import type { ConsultSectionProps } from "../models/consult-workflow";
import {
  OrderInfoPanel,
  OrderInfoProvider,
  useOrderInfo,
} from "../orders/OrderInfo";
import {
  OrderLoadProblems,
  PriorityPicker,
  useOrderPriorities,
} from "../orders/OrderPriority";
import { LabOrderQuestions } from "../orders/LabOrderQuestions";
import { ToothPicker } from "../orders/ToothPicker";
import { ProcedureDone, type ProcedureOrder } from "../orders/ProcedureDone";
/** Signed-order permissions are independent of the locked note; the workspace supplies the capability. */
export interface OrdersSectionProps extends ConsultSectionProps {
  canCompleteProcedures?: boolean;
  procedureOrders?: ProcedureOrder[];
  onBusyChange?: (busy: boolean) => void;
  orderInfo?: ReturnType<typeof useOrderInfo>;
}
export function OrdersSection(props: OrdersSectionProps) {
  const { detail, draft, onChange, readOnly, onRecordsChanged } = props;
  const host = useConsultHost(),
    { can } = useClinicalActor(),
    { t } = useLocalization(),
    uid = useId();
  const priorities = useOrderPriorities(),
    localInfo = useOrderInfo(draft, detail.encounter.id, readOnly || !!props.orderInfo);
  const info = props.orderInfo ?? localInfo;
  const [history, setHistory] = useState<
    "lab" | "imaging" | "procedure" | null
  >(null);
  const primary =
    draft.diagnoses.find((x) => x.primary)?.display ??
    draft.complaints.find((x) => x.primary)?.display ??
    "";
  const procedureOrders =
    props.procedureOrders ??
    detail.orders
      .filter((o) => o.kind === "procedure")
      .map((order) => ({
        id: order.id,
        display: order.display,
        status: order.status,
        details: {
          timing:
            typeof order.details.timing === "string"
              ? order.details.timing
              : undefined,
          consentRequired: order.details.consentRequired === true,
        },
      }));
  const update: typeof onChange = (fn) => {
    if (!readOnly) onChange(fn);
  };
  return (
    <ConsultSection
      id={props.id ?? uid}
      stickyOffset={host.stickyOffset}
      title="Investigations and procedures"
      subtitle="Orders are created when you sign. Items needing insurer approval are requested automatically."
    >
      <OrderLoadProblems {...priorities} />
      <OrderLoadProblems {...info} />
      <OrderInfoProvider value={info}>
        <div className="grid gap-4">
          {(["labs", "imaging"] as const).map((kind) => (
            <div key={kind}>
              <h3>
                {t(kind === "labs" ? "Laboratory" : "Imaging and diagnostics")}
              </h3>
              <Button
                onClick={() => setHistory(kind === "labs" ? "lab" : "imaging")}
              >
                {t("History")}
              </Button>
              {!readOnly && (
                <CodedSearch
                  catalog={kind}
                  label={
                    kind === "labs" ? "Add laboratory test" : "Add imaging"
                  }
                  disabledCodes={draft[kind].map((x) => x.code)}
                  onPick={(item) =>
                    update((n) => {
                      if (!n[kind].some((x) => x.code === item.code))
                        n[kind].push({
                          code: item.code,
                          display: item.display,
                          indication: primary,
                          priority: "",
                          priorAuth: !!item.meta?.priorAuth,
                        });
                    })
                  }
                />
              )}
              {!draft[kind].length && (
                <p>
                  {t(
                    kind === "labs"
                      ? "No laboratory tests ordered."
                      : "No imaging or diagnostics ordered."
                  )}
                </p>
              )}
              <ul className="grid gap-3">
                {draft[kind].map((order, index) => (
                  <li key={order.code}>
                    <h4>{order.display}</h4>
                    {order.priorAuth && (
                      <Badge tone="warning">{t("Insurer approval")}</Badge>
                    )}
                    <Button
                      disabled={readOnly}
                      aria-label={`${t("Remove")} ${order.display}`}
                      onClick={() =>
                        update((n) => {
                          n[kind].splice(index, 1);
                        })
                      }
                    >
                      {t("Remove")}
                    </Button>
                    <PriorityPicker
                      value={order}
                      priorities={priorities.priorities}
                      disabled={readOnly}
                      onChange={(value) =>
                        update((n) => {
                          Object.assign(n[kind][index]!, value);
                        })
                      }
                    />
                    <Input
                      label="Clinical indication"
                      disabled={readOnly}
                      value={order.indication}
                      maxLength={500}
                      onChange={(e) =>
                        update((n) => {
                          n[kind][index]!.indication = e.target.value;
                        })
                      }
                    />
                    {kind === "labs" && (
                      <LabOrderQuestions
                        code={order.code}
                        value={order.questions}
                        disabled={readOnly}
                        onChange={(questions) =>
                          update((n) => {
                            n.labs[index]!.questions = questions;
                          })
                        }
                      />
                    )}
                    <OrderInfoPanel
                      list={kind}
                      index={index}
                      onChange={update}
                      readOnly={readOnly}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h3>{t("Procedures and services")}</h3>
            <Button onClick={() => setHistory("procedure")}>
              {t("History")}
            </Button>
            {!readOnly && (
              <CodedSearch
                catalog="procedures"
                label="Add procedure or service"
                disabledCodes={(draft.procedures ?? []).map((x) => x.code)}
                onPick={(item) =>
                  update((n) => {
                    if (n.procedures?.some((x) => x.code === item.code)) return;
                    (n.procedures ??= []).push({
                      code: item.code,
                      display: item.display,
                      indication: primary,
                      priority: "",
                      specialty: String(item.meta?.specialty ?? ""),
                      timing:
                        item.meta?.timing === "booked"
                          ? "booked"
                          : "this-visit",
                      consent: !!item.meta?.consent,
                      siteKind:
                        item.meta?.site === "tooth"
                          ? "tooth"
                          : item.meta?.site === "side"
                          ? "side"
                          : "none",
                      site: {},
                    });
                  })
                }
              />
            )}
            <ul className="grid gap-3">
              {(draft.procedures ?? []).map((order, index) => (
                <li key={order.code}>
                  <h4>{order.display}</h4>
                  <Badge>
                    {t(
                      order.timing === "booked"
                        ? "Booked for later"
                        : "This visit"
                    )}
                  </Badge>
                  {order.consent && (
                    <Badge tone="warning">{t("Consent needed")}</Badge>
                  )}
                  <Button
                    disabled={readOnly}
                    aria-label={`${t("Remove")} ${order.display}`}
                    onClick={() =>
                      update((n) => {
                        n.procedures!.splice(index, 1);
                      })
                    }
                  >
                    {t("Remove")}
                  </Button>
                  {order.siteKind === "tooth" && (
                    <ToothPicker
                      child={detail.patient.age < 12}
                      teeth={order.site?.teeth ?? []}
                      surfaces={order.site?.surfaces ?? []}
                      disabled={readOnly}
                      onChange={(site) =>
                        update((n) => {
                          n.procedures![index]!.site = {
                            ...n.procedures![index]!.site,
                            ...site,
                          };
                        })
                      }
                    />
                  )}
                  {order.siteKind === "side" && (
                    <Select
                      label="Side"
                      required
                      disabled={readOnly}
                      value={order.site?.side ?? ""}
                      options={[
                        { value: "", label: "Choose" },
                        { value: "left", label: "Left" },
                        { value: "right", label: "Right" },
                        { value: "both", label: "Both" },
                      ]}
                      onChange={(e) =>
                        update((n) => {
                          n.procedures![index]!.site = {
                            ...order.site,
                            side: (e.target.value as "left") || undefined,
                          };
                        })
                      }
                    />
                  )}
                  <PriorityPicker
                    value={order}
                    priorities={priorities.priorities}
                    disabled={readOnly}
                    onChange={(value) =>
                      update((n) => {
                        Object.assign(n.procedures![index]!, value);
                      })
                    }
                  />
                  <Input
                    label="Indication"
                    disabled={readOnly}
                    maxLength={500}
                    value={order.indication}
                    onChange={(e) =>
                      update((n) => {
                        n.procedures![index]!.indication = e.target.value;
                      })
                    }
                  />
                  <OrderInfoPanel
                    list="procedures"
                    index={index}
                    onChange={update}
                    readOnly={readOnly}
                  />
                </li>
              ))}
            </ul>
            {procedureOrders.map((order) => (
              <div key={order.id}>
                <h4>{order.display}</h4>
                <ProcedureDone
                  key={`${detail.encounter.id}:${order.id}`}
                  encounterId={detail.encounter.id}
                  order={order}
                  canWrite={
                    (props.canCompleteProcedures ?? !readOnly) &&
                    (can("note.write") || can("order.write"))
                  }
                  onDone={onRecordsChanged ?? (() => {})}
                  onBusyChange={props.onBusyChange}
                />
              </div>
            ))}
          </div>
        </div>
      </OrderInfoProvider>
      {history && (
        <div>
          <Button onClick={() => setHistory(null)}>{t("Close history")}</Button>
          {host.renderInvestigationHistory?.({ ...props, kind: history }) ?? (
            <p role="status">{t("Investigation history is unavailable.")}</p>
          )}
        </div>
      )}
    </ConsultSection>
  );
}
