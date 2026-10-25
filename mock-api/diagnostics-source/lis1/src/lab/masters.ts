import { createCrudController } from '../common/crud.factory';
import * as E from '../entities';

/** Every configurable master exposed as a uniform REST resource at /api/masters/<path>. */
export const MASTER_CONTROLLERS = [
  createCrudController('masters/departments', E.Department, { orderBy: { sequence: 'ASC', name: 'ASC' } }),
  createCrudController('masters/sub-departments', E.SubDepartment, { orderBy: { sequence: 'ASC', name: 'ASC' } }),
  createCrudController('masters/sample-types', E.SampleType),
  createCrudController('masters/containers', E.Container),
  createCrudController('masters/body-sites', E.BodySite),
  createCrudController('masters/methodologies', E.Methodology),
  createCrudController('masters/units', E.Unit, { searchFields: ['code', 'symbol', 'ucumCode'] }),
  createCrudController('masters/loinc-codes', E.LoincCode, { searchFields: ['code', 'component', 'longName'] }),
  createCrudController('masters/ethnicities', E.Ethnicity),
  createCrudController('masters/parameters', E.Parameter, { searchFields: ['code', 'name', 'shortName', 'loincCode'] }),
  createCrudController('masters/reference-ranges', E.ReferenceRange, { searchFields: ['condition', 'displayText', 'normalText'], orderBy: { parameterId: 'ASC', gender: 'ASC', ageMin: 'ASC' }, writeRoles: ['ADMIN', 'PATHOLOGIST'] }),
  createCrudController('masters/tests', E.LabTest, { searchFields: ['code', 'name', 'shortName', 'loincCode'], orderBy: { sequence: 'ASC', code: 'ASC' } }),
  createCrudController('masters/test-parameters', E.TestParameter, { searchFields: ['sectionHeading'], orderBy: { testId: 'ASC', sequence: 'ASC' } }),
  createCrudController('masters/profiles', E.Profile),
  createCrudController('masters/doctors', E.Doctor, { searchFields: ['code', 'name', 'specialty', 'phone'], writeRoles: ['ADMIN', 'RECEPTION'] }),
  createCrudController('masters/rejection-reasons', E.RejectionReason),
  createCrudController('masters/external-labs', E.ExternalLab),
  createCrudController('masters/middlewares', E.Middleware),
  createCrudController('masters/analyzers', E.Analyzer),
  createCrudController('masters/analyzer-test-mappings', E.AnalyzerTestMapping, { searchFields: ['analyzerTestCode'], orderBy: { analyzerId: 'ASC', priority: 'ASC' } }),
  createCrudController('masters/analyzer-parameter-mappings', E.AnalyzerParameterMapping, { searchFields: ['analyzerCode'], orderBy: { analyzerId: 'ASC' } }),
  createCrudController('masters/external-systems', E.ExternalSystem),
  createCrudController('masters/report-templates', E.ReportTemplate, { writeRoles: ['ADMIN', 'PATHOLOGIST'] }),
  createCrudController('masters/settings', E.Setting, { searchFields: ['key', 'description'], orderBy: { key: 'ASC' } }),
];
