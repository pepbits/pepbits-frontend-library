/** Fictional contract-v1 fixtures for tests. Not seeded records or claims that these workflows exist. */
import type {
  LifecycleSource, LifecycleSourceCapabilities, LifecycleSourceMapping, LifecycleSourceSummary, LifecycleMetadata, LifecycleReleaseDefinition, LifecycleReleaseVersion, LifecycleVersionDetail, LifecycleVersionSummary,
} from '@pepbits/patterns/lifecycle';

export const sampleRecordDefinition = (): LifecycleReleaseDefinition => ({
  schemaVersion: 1, application: 'application', code: 'sample-record', version: 1, label: 'Sample record', description: null,
  dimensions: [{ code: 'amount', label: 'Approval amount', type: 'NUMBER' }],
  stages: [
    { key: 'ORDER_DRAFT', label: 'Order draft', description: null },
    { key: 'ORDER_APPROVAL', label: 'Order approval', description: 'Manager approval' },
  ],
  events: [{ key: 'APPROVED', eventType: 'application.sample-record.approved', schemaVersion: 1, label: 'Approved' }],
  lifecycles: [{
    key: 'sample-record', label: 'Sample record', subjectTypes: ['sample-record'], stages: ['ORDER_DRAFT', 'ORDER_APPROVAL'],
    stageEvents: [{ stage: 'ORDER_APPROVAL', event: 'APPROVED' }],
  }],
  bindings: [{
    key: 'approval-form-large', lifecycle: 'sample-record', stage: 'ORDER_APPROVAL', event: null, purpose: 'approval-form', priority: 20,
    target: { kind: 'FORM', code: 'po-approval-large', version: 2, handler: null, states: [] },
    applicability: { include: [{ dimension: 'amount', operator: 'RANGE', values: [], min: '10000', max: null }], exclude: [] },
  }],
});

export const releaseVersion = (patch: Partial<LifecycleReleaseVersion> = {}): LifecycleReleaseVersion => ({
  application: 'application', code: 'sample-record', version: 1, status: 'DRAFT', revision: 3, checksum: 'a'.repeat(64), approvedChecksum: null,
  definition: sampleRecordDefinition(), editors: ['editor-1'], createdBy: 'editor-1', createdAt: '2026-09-18T10:00:00Z',
  updatedBy: 'editor-1', updatedAt: '2026-09-18T10:05:00Z', approvedBy: null, approvedAt: null, approvalComment: null,
  publishedBy: null, publishedAt: null, ...patch,
});
export const versionDetail = (patch: Partial<LifecycleReleaseVersion> = {}, activation: LifecycleVersionDetail['activation'] = null): LifecycleVersionDetail =>
  ({ version: releaseVersion(patch), activation });
export const summaryOf = (v: LifecycleReleaseVersion, active = false): LifecycleVersionSummary => ({
  application: v.application, code: v.code, version: v.version, label: v.definition.label, status: v.status, revision: v.revision,
  checksum: v.checksum, updatedAt: v.updatedAt, active,
});
export const metadataFixture = (): LifecycleMetadata => ({
  schemaVersion: 1, targetKinds: ['FORM', 'WORKFLOW', 'ASSESSMENT', 'NOTIFICATION', 'INTEGRATION', 'RULE', 'ACTION'],
  supportedTargetKinds: ['FORM', 'WORKFLOW'], dimensionTypes: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE'], operators: ['IN', 'WITHIN', 'RANGE'],
  statuses: ['DRAFT', 'APPROVED', 'PUBLISHED'], outcomes: ['MATCH', 'NO_MATCH', 'UNKNOWN'], reservedDimensions: ['organisation', 'subject-type'],
  limits: { stages: 256, events: 512, lifecycles: 64, bindings: 1024, dimensions: 64, constraints: 32, values: 256, pageSize: 100 },
});

