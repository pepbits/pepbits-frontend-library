"use client";
import React from "react";
import {PrintDocument,Modal} from '@pepbits/components';
import {Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type { LabelArtwork, LabelJob } from "@pepbits/data/label-printing";
import styles from "./printing.module.css";
/** Backend-generated image only; SVG is an image resource, never injected markup. */
export function CodePreview({
  image,
  description,
}: {
  image: string;
  description: string;
}) {
  if (!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(image)) return null;
  return <img className={styles.code} src={image} alt={description} />;
}
export function LabelPreview({ label }: { label: LabelArtwork }) {
  return (
    <section
      className={styles.label}
      style={{ width: `${label.widthMm}mm`, height: `${label.heightMm}mm` }}
    >
      <strong>{label.title}</strong>
      <div className={styles.codeBox}>
        <CodePreview image={label.image} description={label.code} />
      </div>
      {label.lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </section>
  );
}
export function WristbandPreview({ label }: { label: LabelArtwork }) {
  return <LabelPreview label={label} />;
}
export function PrintSheet({ job }: { job: LabelJob }) {
  const p = job.profile,
    labels = job.labels.flatMap((label) =>
      Array.from({ length: job.copies }, () => label),
    );
  const rows = Math.max(
      1,
      Math.floor(
        (p.heightMm - 2 * p.marginMm + p.gapMm) /
          (job.labels[0]!.heightMm + p.gapMm),
      ),
    ),
    capacity = rows * p.columns;
  return (
    <>
      {Array.from(
        { length: Math.ceil(labels.length / capacity) },
        (_, page) => (
          <div
            className={styles.sheet}
            key={page}
            style={{
              width: `${p.widthMm}mm`,
              height: `${p.heightMm}mm`,
              padding: `${p.marginMm}mm`,
              gap: `${p.gapMm}mm`,
              gridTemplateColumns: `repeat(${p.columns},${job.labels[0]!.widthMm}mm)`,
            }}
          >
            {labels
              .slice(page * capacity, (page + 1) * capacity)
              .map((label, i) => (
                <LabelPreview key={i} label={label} />
              ))}
          </div>
        ),
      )}
    </>
  );
}
export function LabelPrintDialog({
  job,
  onClose,
  onPrint,
  busy,
}: {
  job: LabelJob;
  onClose: () => void;
  onPrint: () => void;
  busy: boolean;
}) {
  const { t } = useLocalization();
  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="labels.preview"
        footer={
          <>
            <Button onClick={onClose}>{t("Close")}</Button>
            <Button disabled={busy} onClick={onPrint}>
              {t("labels.print")}
            </Button>
          </>
        }
      >
        <p>{t("labels.printHint")}</p>
        <div className={styles.preview}>
          <PrintSheet job={job} />
        </div>
      </Modal>
      <PrintDocument>
        <style>{`@media print{@page{size:${job.profile.widthMm}mm ${job.profile.heightMm}mm;margin:0}body>.ops-print-document{padding:0!important}}`}</style>
        <PrintSheet job={job} />
      </PrintDocument>
    </>
  );
}
