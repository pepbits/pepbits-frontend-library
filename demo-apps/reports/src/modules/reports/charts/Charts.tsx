"use client";
/*
 * Port of lumen-reports src/components/charts/Charts.tsx onto the shared @pepbits/components charts.
 * The source drew bar, line and donut SVG itself; the library GroupedBarChart, LineChart and DonutChart now carry the
 * geometry, semantic colours, accessible names and keyboard inspection. This module only maps the API chart
 * payload and formats values with the effective preference formatter (column type of the first series).
 */
import React, { useMemo } from 'react';
import { DonutChart, GroupedBarChart, LineChart } from '@pepbits/components';
import { useLocalization } from '@pepbits/i18n/react';
import type { ChartData, ColumnType } from '../types';
import { useReportFormat } from '../ui/preferences';

interface Props {
  data: ChartData;
  types: Record<string, ColumnType>;
  height?: number;
}

export function ChartRenderer({ data, types, height }: Props) {
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const type = types[data.series[0]?.key ?? ''] ?? 'number';
  const series = useMemo(() => data.series.map((s) => ({ id: s.key, label: s.label, values: s.values })), [data.series]);
  const names = data.series.map((s) => t(s.label)).join(', ');
  if (!data.labels.length) return <p className="lr-empty-text lr-center">{t('No data to chart for this period.')}</p>;
  const compact = (v: number) => fmt.value(v, type, true);
  const full = (v: number) => fmt.value(v, type);
  if (data.type === 'line') return <div data-report-chart="line"><LineChart label={t('Line chart of {series}', { series: names })} labels={data.labels} series={series} formatValue={compact} /></div>;
  if (data.type === 'donut') {
    const first = data.series[0];
    if (!first) return null;
    return <div data-report-chart="donut"><DonutChart label={t('Donut chart of {series}', { series: t(first.label) })} totalLabel={t('Total')} parts={data.labels.map((label, i) => ({ label, value: first.values[i] ?? 0 }))} formatValue={full} /></div>;
  }
  return <div data-report-chart="bar"><GroupedBarChart label={t('Bar chart of {series}', { series: names })} labels={data.labels} series={series} formatValue={compact} height={height} /></div>;
}
