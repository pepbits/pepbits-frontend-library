"use client";
import React, { useCallback } from "react";
import { Input, Select } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useClinicalPort } from "../context/clinical-context";
import {
  ABSENT_ANSWER,
  unanswered,
  type Answers,
  type Answer,
  type LabQuestion,
} from "../models/consult-orders";
import { OrderLoadProblems, useOrderResource } from "./OrderPriority";

export function QuestionInputs({
  questions,
  value,
  onChange,
  disabled,
}: {
  questions: LabQuestion[];
  value?: Answers;
  onChange: (next: Answers) => void;
  disabled?: boolean;
}) {
  const { t } = useLocalization();
  const put = (code: string, answer?: Answer) => {
    if (disabled) return;
    const next = { ...value };
    if (answer) next[code] = answer;
    else delete next[code];
    onChange(next);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {questions
        .filter((q) => q.stage === "order")
        .map((q) => {
          const answer = value?.[q.code],
            off = disabled || !!answer?.absent;
          const set = (v: Answer["value"]) =>
            put(q.code, v === "" || v === undefined ? undefined : { value: v });
          return (
            <div key={q.code}>
              {q.type === "boolean" || q.type === "code" ? (
                <Select
                  label={q.label}
                  required={q.required}
                  disabled={off}
                  value={
                    answer?.value === undefined ? "" : String(answer.value)
                  }
                  options={[
                    { value: "", label: "Choose" },
                    ...(q.type === "boolean"
                      ? [
                          { value: "true", label: "Yes" },
                          { value: "false", label: "No" },
                        ]
                      : (q.options ?? []).map((v) => ({
                          value: v,
                          label: v.replace(/-/g, " "),
                        }))),
                  ]}
                  onChange={(e) =>
                    set(
                      e.target.value === ""
                        ? undefined
                        : q.type === "boolean"
                        ? e.target.value === "true"
                        : e.target.value
                    )
                  }
                />
              ) : (
                <Input
                  label={q.label}
                  required={q.required}
                  disabled={off}
                  type={
                    q.type === "date"
                      ? "date"
                      : ["integer", "decimal"].includes(q.type)
                      ? "number"
                      : "text"
                  }
                  step={q.type === "integer" ? 1 : "any"}
                  min={q.min ?? undefined}
                  max={q.max ?? undefined}
                  maxLength={500}
                  value={String(answer?.value ?? "")}
                  onChange={(e) =>
                    set(
                      q.type === "integer" && e.target.value !== ""
                        ? Number(e.target.value)
                        : e.target.value
                    )
                  }
                />
              )}
              <Select
                label={`${t(q.label)}: ${t("reason it is missing")}`}
                disabled={disabled}
                value={answer?.absent ?? ""}
                options={[{ value: "", label: "Answer" }, ...ABSENT_ANSWER]}
                onChange={(e) =>
                  put(
                    q.code,
                    e.target.value
                      ? { absent: e.target.value as Answer["absent"] }
                      : undefined
                  )
                }
              />
            </div>
          );
        })}
    </div>
  );
}
export function LabOrderQuestions({
  code,
  value,
  onChange,
  disabled,
}: {
  code: string;
  value?: Answers;
  onChange: (next: Answers) => void;
  disabled?: boolean;
}) {
  const { domain } = useClinicalPort(),
    { t } = useLocalization();
  const resource = useOrderResource(
    useCallback(
      (signal: AbortSignal) =>
        domain
          ? domain.loadLabQuestions({ stage: "order", test: code }, signal)
          : Promise.resolve(null),
      [domain, code]
    )
  );
  if (!domain)
    return (
      <p role="status">{t("Laboratory ordering questions are unavailable.")}</p>
    );
  const questions =
    resource.data?.tests
      .find((test) => test.code === code)
      ?.questions.filter((q) => q.stage === "order") ?? [];
  return (
    <div>
      <OrderLoadProblems {...resource} />
      {questions.length > 0 && (
        <>
          <p>{t("Questions for the laboratory")}</p>
          {unanswered(questions, value).length > 0 && (
            <p>{t("Answer required questions before signing.")}</p>
          )}
          <QuestionInputs
            questions={questions}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}
