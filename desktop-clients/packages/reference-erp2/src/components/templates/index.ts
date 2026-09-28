import { MatrixTemplate, ReportTemplate, LedgerTemplate, DashboardTemplate, SettingsTemplate, type PageDef, type TemplateKey } from '@pepbits/reference-keystone-core';
import type { ComponentType } from 'react';
import GridTemplate from './GridTemplate';
import DependentTemplate from './DependentTemplate';
import TreeTemplate from './TreeTemplate';
import ProfileTemplate from './ProfileTemplate';
import StructureTemplate from './StructureTemplate';
import RateTemplate from './RateTemplate';
import DocumentTemplate from './DocumentTemplate';
import RequestTemplate from './RequestTemplate';
import BookingTemplate from './BookingTemplate';
import ChecklistTemplate from './ChecklistTemplate';
import CaseTemplate from './CaseTemplate';
import ProcessTemplate from './ProcessTemplate';
import PrintTemplate from './PrintTemplate';
import InboxTemplate from './InboxTemplate';

/** Template key (from the registry) → screen component. */
export const TEMPLATES: Record<TemplateKey, ComponentType<{ def: PageDef }>> = {
  grid: GridTemplate,
  dependent: DependentTemplate,
  tree: TreeTemplate,
  profile: ProfileTemplate,
  structure: StructureTemplate,
  rate: RateTemplate,
  document: DocumentTemplate,
  voucher: DocumentTemplate,
  request: RequestTemplate,
  booking: BookingTemplate,
  matrix: MatrixTemplate,
  checklist: ChecklistTemplate,
  case: CaseTemplate,
  process: ProcessTemplate,
  report: ReportTemplate,
  ledger: LedgerTemplate,
  print: PrintTemplate,
  dashboard: DashboardTemplate,
  settings: SettingsTemplate,
  inbox: InboxTemplate,
};
