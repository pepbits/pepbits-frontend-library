import { Injectable } from '@nestjs/common';
import { Parameter, Patient, ReferenceRange } from '../entities';
import { ageOf, LookupService } from './lookup.service';

export interface Evaluation {
  flag: string | null; // N, L, H, LL, HH, A, AA
  isAbnormal: boolean;
  isCritical: boolean;
  referenceText: string;
  referenceRangeId: number | null;
  value: string;
}

const list = (s?: string) => (s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

export function rangeText(r?: ReferenceRange | null): string {
  if (!r) return '';
  if (r.displayText) return r.displayText;
  if (r.lowNormal != null && r.highNormal != null) return `${r.lowNormal} - ${r.highNormal}`;
  if (r.lowNormal != null) return `>= ${r.lowNormal}`;
  if (r.highNormal != null) return `<= ${r.highNormal}`;
  return r.normalText || '';
}

@Injectable()
export class ReferenceService {
  constructor(private lookup: LookupService) {}

  /**
   * Picks the most specific active range for the patient. Specificity order:
   * clinical condition > gender > ethnicity > sample type > narrowest age band.
   */
  async findRange(parameterId: number, patient: Patient, sampleTypeId?: number, at = new Date()) {
    const ranges = await this.lookup.repo(ReferenceRange).find({ where: { parameterId, active: true } });
    const age = ageOf(patient?.dob, at);
    let best: ReferenceRange | null = null;
    let bestScore = -Infinity;
    for (const r of ranges) {
      if (r.gender !== 'ANY' && r.gender !== patient?.gender) continue;
      if (r.ethnicity && r.ethnicity !== 'ANY' && r.ethnicity !== patient?.ethnicity) continue;
      if (r.sampleTypeId && sampleTypeId && r.sampleTypeId !== sampleTypeId) continue;
      if (r.condition) {
        if (r.condition.toUpperCase() === 'PREGNANCY' && !patient?.isPregnant) continue;
        if (r.condition.toUpperCase() !== 'PREGNANCY') continue; // other conditions are informational ranges; not auto-selected
      }
      let span = 0;
      if (age) {
        const a = r.ageUnit === 'DAYS' ? age.days : r.ageUnit === 'MONTHS' ? age.months : age.years;
        if (a < r.ageMin || a >= r.ageMax) continue;
        const factor = r.ageUnit === 'DAYS' ? 1 / 365 : r.ageUnit === 'MONTHS' ? 1 / 12 : 1;
        span = (r.ageMax - r.ageMin) * factor;
      }
      const score = (r.condition ? 100 : 0) + (r.gender !== 'ANY' ? 40 : 0) + (r.ethnicity && r.ethnicity !== 'ANY' ? 20 : 0)
        + (r.sampleTypeId ? 10 : 0) - Math.min(span, 150) / 20;
      if (score > bestScore) { best = r; bestScore = score; }
    }
    return best;
  }

  evaluate(param: Parameter, rawValue: string, range: ReferenceRange | null): Evaluation {
    const value = (rawValue ?? '').toString().trim();
    const base: Evaluation = {
      flag: null, isAbnormal: false, isCritical: false,
      referenceText: rangeText(range), referenceRangeId: range?.id ?? null, value,
    };
    if (!value) return base;

    if (param.resultType === 'NUMERIC' || param.resultType === 'CALCULATED') {
      const n = parseFloat(value.replace(/^[<>]=?/, ''));
      if (isNaN(n)) return { ...base, flag: 'A', isAbnormal: true };
      const formatted = /^[<>]/.test(value) ? value : n.toFixed(param.decimals ?? 2);
      let flag = 'N';
      if (range) {
        if (range.criticalLow != null && n < range.criticalLow) flag = 'LL';
        else if (range.criticalHigh != null && n > range.criticalHigh) flag = 'HH';
        else if (range.lowNormal != null && n < range.lowNormal) flag = 'L';
        else if (range.highNormal != null && n > range.highNormal) flag = 'H';
      }
      return {
        ...base, value: formatted, flag,
        isAbnormal: flag !== 'N', isCritical: flag === 'LL' || flag === 'HH',
      };
    }

    const v = value.toLowerCase();
    if (list(param.criticalValues).includes(v)) return { ...base, flag: 'AA', isAbnormal: true, isCritical: true };
    if (list(param.abnormalValues).includes(v)) return { ...base, flag: 'A', isAbnormal: true };
    return { ...base, flag: 'N', referenceText: base.referenceText || range?.normalText || '' };
  }

  /** Evaluates a formula like `{CHOL}-{HDL}-({TG}/5)` using parameter codes. Returns null if inputs are missing. */
  calculate(formula: string, valuesByCode: Record<string, string>): number | null {
    let missing = false;
    const expr = formula.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, code) => {
      const v = parseFloat((valuesByCode[code] ?? '').toString().replace(/^[<>]=?/, ''));
      if (isNaN(v)) { missing = true; return '0'; }
      return `(${v})`;
    });
    if (missing) return null;
    if (!/^[\d.+\-*/()\seE]+$/.test(expr)) return null;
    try {
      const out = Function(`"use strict"; return (${expr});`)();
      return typeof out === 'number' && isFinite(out) ? out : null;
    } catch {
      return null;
    }
  }
}
