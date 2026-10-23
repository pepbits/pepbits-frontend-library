"use client";
import React from "react";
import {Card, CardHeader, CardTitle, CardContent} from '@pepbits/components';
import {Input, Textarea} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {ComprehensiveValues, ComprehensiveConfiguration} from '../../domain/comprehensive-consultation';
import type { DocumentFieldsProps } from "../clinical-document/editor";
export type ComprehensiveProps = DocumentFieldsProps<
  ComprehensiveValues,
  ComprehensiveConfiguration
>;
export const key = (name: string) => "template.comprehensive." + name;
export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader style={{ paddingBlock: ".5rem", minHeight: 0 }}>
        <CardTitle title={title} action={action} />
      </CardHeader>
      <CardContent className="space-y-3" style={{ paddingBlock: ".5rem" }}>
        {children}
      </CardContent>
    </Card>
  );
}
export function Hint({ message }: { message: string }) {
  const { t } = useLocalization();
  return <p className="text-xs text-[var(--text-muted)]">{t(message)}</p>;
}
export function EntryField({
  label,
  value,
  onChange,
  disabled,
  multiline = false,
  name,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  name?: string;
  error?: string;
}) {
  const props = {
    label,
    value,
    name,
    disabled,
    error,
    maxLength: 2000,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
  };
  return multiline ? <Textarea {...props} rows={2} /> : <Input {...props} />;
}
