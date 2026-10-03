import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Shared columns for every table. */
export abstract class Base {
  @PrimaryGeneratedColumn() id: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

/** Shared columns for master (configuration) tables. */
export abstract class MasterBase extends Base {
  @Column({ default: true }) active: boolean;
}

@Entity('departments')
export class Department extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) description: string;
  @Column({ default: 0 }) sequence: number;
}

@Entity('sub_departments')
export class SubDepartment extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column() departmentId: number;
  @Column({ default: 0 }) sequence: number;
}

@Entity('sample_types')
export class SampleType extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) snomedCode: string;
  @Column({ nullable: true }) storageTemperature: string;
  @Column({ type: 'integer', nullable: true }) stabilityHours: number;
  @Column({ nullable: true }) description: string;
}

@Entity('containers')
export class Container extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ default: '#9ca3af' }) capColor: string;
  @Column({ nullable: true }) additive: string;
  @Column({ type: 'real', nullable: true }) volumeMl: number;
}

@Entity('body_sites')
export class BodySite extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) snomedCode: string;
  @Column({ nullable: true }) laterality: string;
}

@Entity('methodologies')
export class Methodology extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) description: string;
}

@Entity('units')
export class Unit extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() symbol: string;
  @Column({ nullable: true }) ucumCode: string;
  @Column({ nullable: true }) description: string;
}

@Entity('loinc_codes')
export class LoincCode extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() component: string;
  @Column({ nullable: true }) property: string;
  @Column({ nullable: true }) timeAspect: string;
  @Column({ nullable: true }) system: string;
  @Column({ nullable: true }) scale: string;
  @Column({ nullable: true }) method: string;
  @Column({ nullable: true }) longName: string;
}

@Entity('ethnicities')
export class Ethnicity extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
}

/**
 * A measurable analyte. resultType drives the entry widget:
 * NUMERIC, TEXT, OPTION (pick-list from `options`), MEMO (free narrative), CALCULATED (from `formula`).
 */
@Entity('parameters')
export class Parameter extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) shortName: string;
  @Column({ default: 'NUMERIC' }) resultType: string;
  @Column({ nullable: true }) unitId: number;
  @Column({ default: 2 }) decimals: number;
  @Column({ nullable: true }) loincCode: string;
  @Column({ nullable: true }) methodologyId: number;
  @Column({ nullable: true }) options: string; // comma separated for OPTION
  @Column({ nullable: true }) abnormalValues: string; // comma separated values that flag as abnormal (text/option)
  @Column({ nullable: true }) criticalValues: string; // comma separated values that flag as critical (text/option)
  @Column({ nullable: true }) formula: string; // e.g. {CHOL}-{HDL}-({TG}/5)
  @Column({ nullable: true }) defaultValue: string;
  @Column({ type: 'real', nullable: true }) deltaCheckPercent: number;
  @Column({ nullable: true }) interpretation: string;
}

/**
 * Reference / critical ranges. The engine picks the most specific matching row for
 * gender, age, ethnicity, sample type and clinical condition.
 */
@Entity('reference_ranges')
export class ReferenceRange extends MasterBase {
  @Column() parameterId: number;
  @Column({ default: 'ANY' }) gender: string; // ANY | M | F | O
  @Column({ type: 'real', default: 0 }) ageMin: number;
  @Column({ type: 'real', default: 150 }) ageMax: number;
  @Column({ default: 'YEARS' }) ageUnit: string; // DAYS | MONTHS | YEARS
  @Column({ default: 'ANY' }) ethnicity: string; // ANY or ethnicity code
  @Column({ nullable: true }) sampleTypeId: number;
  @Column({ nullable: true }) condition: string; // e.g. PREGNANCY, FASTING
  @Column({ type: 'real', nullable: true }) lowNormal: number;
  @Column({ type: 'real', nullable: true }) highNormal: number;
  @Column({ type: 'real', nullable: true }) criticalLow: number;
  @Column({ type: 'real', nullable: true }) criticalHigh: number;
  @Column({ nullable: true }) normalText: string; // shown for text results / override display
  @Column({ nullable: true }) displayText: string; // custom printed range text
}

@Entity('tests')
export class LabTest extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) shortName: string;
  @Column({ nullable: true }) departmentId: number;
  @Column({ nullable: true }) subDepartmentId: number;
  @Column({ nullable: true }) sampleTypeId: number;
  @Column({ nullable: true }) containerId: number;
  @Column({ nullable: true }) bodySiteId: number;
  @Column({ nullable: true }) methodologyId: number;
  @Column({ nullable: true }) loincCode: string;
  @Column({ type: 'real', default: 0 }) price: number;
  @Column({ type: 'real', nullable: true }) sampleVolumeMl: number;
  @Column({ default: 240 }) tatRoutineMinutes: number;
  @Column({ default: 60 }) tatStatMinutes: number;
  @Column({ default: false }) isOutsourced: boolean;
  @Column({ nullable: true }) externalLabId: number;
  @Column({ type: 'real', nullable: true }) outsourceCost: number;
  @Column({ nullable: true }) reportTemplateId: number;
  @Column({ nullable: true }) patientPreparation: string;
  @Column({ nullable: true }) interpretation: string;
  @Column({ default: false }) requiresBodySite: boolean;
  @Column({ default: 0 }) sequence: number;
}

@Entity('test_parameters')
export class TestParameter extends MasterBase {
  @Column() testId: number;
  @Column() parameterId: number;
  @Column({ default: 0 }) sequence: number;
  @Column({ default: true }) isReportable: boolean;
  @Column({ default: true }) isMandatory: boolean;
  @Column({ nullable: true }) sectionHeading: string;
}

@Entity('profiles')
export class Profile extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ type: 'real', default: 0 }) price: number;
  @Column({ type: 'simple-json', nullable: true }) testIds: number[];
  @Column({ nullable: true }) departmentId: number;
  @Column({ nullable: true }) description: string;
}

@Entity('doctors')
export class Doctor extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) specialty: string;
  @Column({ nullable: true }) registrationNo: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) email: string;
}

@Entity('rejection_reasons')
export class RejectionReason extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
}

@Entity('external_labs')
export class ExternalLab extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) contactPerson: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) address: string;
  @Column({ nullable: true }) accreditation: string;
  @Column({ nullable: true }) manifestEndpointUrl: string; // real HTTP POST of shipment manifest
  @Column({ nullable: true }) outboundAuthToken: string;
  @Column({ nullable: true }) inboundApiKey: string; // key the external lab uses to post results back
  @Column({ default: 48 }) defaultTatHours: number;
}

/** Middleware = the instrument-interface engine sitting between LIS and analyzers. */
@Entity('middlewares')
export class Middleware extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) vendor: string;
  @Column({ default: 'PUSH' }) orderMode: string; // PUSH (LIS posts orders) | PULL (middleware polls LIS)
  @Column({ nullable: true }) orderEndpointUrl: string;
  @Column({ default: 'JSON' }) messageFormat: string; // JSON | HL7
  @Column({ default: 'NONE' }) authType: string; // NONE | BEARER | API_KEY
  @Column({ nullable: true }) outboundAuthToken: string;
  @Column({ nullable: true }) inboundApiKey: string; // key middleware uses to post results / poll orders
  @Column({ default: true }) autoSendOnAccession: boolean;
  @Column({ default: 3 }) maxRetries: number;
}

@Entity('analyzers')
export class Analyzer extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) manufacturer: string;
  @Column({ nullable: true }) model: string;
  @Column({ nullable: true }) serialNo: string;
  @Column({ nullable: true }) departmentId: number;
  @Column({ nullable: true }) middlewareId: number;
  @Column({ default: 'ASTM' }) protocol: string; // ASTM | HL7 | JSON | CSV
  @Column({ default: 'TCP' }) connectionType: string; // TCP | SERIAL | FILE | HTTP
  @Column({ nullable: true }) host: string;
  @Column({ type: 'integer', nullable: true }) port: number;
  @Column({ default: true }) bidirectional: boolean;
  @Column({ default: false }) autoValidateNormals: boolean;
}

@Entity('analyzer_test_mappings')
export class AnalyzerTestMapping extends MasterBase {
  @Column() analyzerId: number;
  @Column() testId: number;
  @Column() analyzerTestCode: string;
  @Column({ default: 1 }) priority: number; // 1 = primary analyzer for the test
}

@Entity('analyzer_parameter_mappings')
export class AnalyzerParameterMapping extends MasterBase {
  @Column() analyzerId: number;
  @Column() parameterId: number;
  @Column() analyzerCode: string;
  @Column({ type: 'real', default: 1 }) conversionFactor: number;
  @Column({ nullable: true }) analyzerUnit: string;
}

/** Hospital systems (HIS / EMR / portals) that send orders and receive results. */
@Entity('external_systems')
export class ExternalSystem extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ default: 'HIS' }) systemType: string;
  @Column() apiKey: string;
  @Column({ nullable: true }) resultCallbackUrl: string;
  @Column({ nullable: true }) callbackAuthToken: string;
  @Column({ default: 'JSON' }) resultFormat: string; // JSON | FHIR | HL7
  @Column({ default: true }) autoPublish: boolean;
}

@Entity('report_templates')
export class ReportTemplate extends MasterBase {
  @Index({ unique: true }) @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) departmentId: number;
  @Column({ default: 'A4' }) paperSize: string;
  @Column({ default: 'portrait' }) orientation: string;
  @Column({ nullable: true }) logoUrl: string;
  @Column({ type: 'text', nullable: true }) headerHtml: string;
  @Column({ type: 'text', nullable: true }) footerHtml: string;
  @Column({ default: '#0e5e6f' }) accentColor: string;
  @Column({ default: 'Georgia, serif' }) fontFamily: string;
  @Column({ default: 12 }) fontSizePx: number;
  @Column({ default: true }) showMethod: boolean;
  @Column({ default: false }) showLoinc: boolean;
  @Column({ default: true }) showUnits: boolean;
  @Column({ default: true }) showReferenceRange: boolean;
  @Column({ default: true }) showFlags: boolean;
  @Column({ default: true }) showBarcode: boolean;
  @Column({ default: true }) showInterpretation: boolean;
  @Column({ default: true }) pageBreakPerDepartment: boolean;
  @Column({ nullable: true }) signatureLabel: string;
  @Column({ type: 'text', nullable: true }) disclaimer: string;
  @Column({ default: false }) isDefault: boolean;
}

@Entity('users')
export class User extends MasterBase {
  @Index({ unique: true }) @Column() username: string;
  @Column() fullName: string;
  @Column({ default: 'TECHNOLOGIST' }) role: string; // ADMIN | RECEPTION | PHLEBOTOMIST | TECHNOLOGIST | PATHOLOGIST
  @Column({ select: false, nullable: true }) passwordHash: string;
  @Column({ nullable: true }) qualification: string;
  @Column({ nullable: true }) signatureText: string;
  @Column({ nullable: true }) email: string;
}

@Entity('settings')
export class Setting extends Base {
  @Index({ unique: true }) @Column() key: string;
  @Column({ type: 'text', nullable: true }) value: string;
  @Column({ nullable: true }) description: string;
}
