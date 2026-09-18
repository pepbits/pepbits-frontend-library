/** Fictional contract-v1 fixtures for tests. Not seeded records or claims that these workflows exist. */
import type {
  LifecycleSource, LifecycleSourceCapabilities, LifecycleSourceMapping, LifecycleSourceSummary, LifecycleMetadata, LifecycleReleaseDefinition, LifecycleReleaseVersion, LifecycleVersionDetail, LifecycleVersionSummary,
} from './contract.ts';

export const purchaseOrderDefinition = (): LifecycleReleaseDefinition => ({
  schemaVersion: 1, application: 'erp', code: 'purchase-order', version: 1, label: 'Purchase order', description: null,
  dimensions: [{ code: 'amount', label: 'Approval amount', type: 'NUMBER' }],
  stages: [
    { key: 'ORDER_DRAFT', label: 'Order draft', description: null },
    { key: 'ORDER_APPROVAL', label: 'Order approval', description: 'Manager approval' },
  ],
  events: [{ key: 'APPROVED', eventType: 'erp.purchase-order.approved', schemaVersion: 1, label: 'Approved' }],
  lifecycles: [{
    key: 'purchase-order', label: 'Purchase order', subjectTypes: ['purchase-order'], stages: ['ORDER_DRAFT', 'ORDER_APPROVAL'],
    stageEvents: [{ stage: 'ORDER_APPROVAL', event: 'APPROVED' }],
  }],
  bindings: [{
    key: 'approval-form-large', lifecycle: 'purchase-order', stage: 'ORDER_APPROVAL', event: null, purpose: 'approval-form', priority: 20,
    target: { kind: 'FORM', code: 'po-approval-large', version: 2, handler: null, states: [] },
    applicability: { include: [{ dimension: 'amount', operator: 'RANGE', values: [], min: '10000', max: null }], exclude: [] },
  }],
});

export const releaseVersion = (patch: Partial<LifecycleReleaseVersion> = {}): LifecycleReleaseVersion => ({
  application: 'erp', code: 'purchase-order', version: 1, status: 'DRAFT', revision: 3, checksum: 'a'.repeat(64), approvedChecksum: null,
  definition: purchaseOrderDefinition(), editors: ['editor-1'], createdBy: 'editor-1', createdAt: '2026-09-18T10:00:00Z',
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

/** Fictional ERP purchase-order source registry entry (schema metadata only; no row values). */
export const purchaseOrderSource = (patch: Partial<LifecycleSource> = {}): LifecycleSource => ({
  application: 'erp', code: 'purchase_order', name: 'Purchase orders', description: 'Purchase order header',
  provenance: { release: 'erp-src-4', revision: 2, fingerprint: 'f'.repeat(64) },
  captureModes: ['SERVICE', 'TABLE'], serviceOperations: ['CREATED', 'UPDATED'], tableEventPrefix: 'erp.purchase-order.',
  tableCaptures: [{ operation: 'UPDATED', eventType: 'erp.purchase-order.updated', schemaVersion: 1, configurationId: 7, revision: 3, payloadFields: ['order_number', 'status'] }],
  fields: [
    { code: 'po.amount', name: 'amount', type: 'decimal', nullable: false, sensitivity: 'FINANCIAL', selectable: true, sensitive: true, disclosable: false, tableCapturable: false, required: false, description: 'Order total' },
    { code: 'po.approved-at', name: 'approved_at', type: 'instant', nullable: true, sensitivity: 'INTERNAL', selectable: true, sensitive: false, disclosable: true, tableCapturable: false, required: false, description: 'Approval time' },
    { code: 'po.notes', name: 'notes_json', type: 'json', nullable: true, sensitivity: 'INTERNAL', selectable: false, sensitive: false, disclosable: true, tableCapturable: false, required: false, description: 'Structured notes' },
    { code: 'po.number', name: 'order_number', type: 'text', nullable: false, sensitivity: 'INTERNAL', selectable: true, sensitive: false, disclosable: true, tableCapturable: true, required: true, description: 'Order number' },
    { code: 'po.status', name: 'status', type: 'decision', nullable: false, sensitivity: 'INTERNAL', selectable: true, sensitive: false, disclosable: true, tableCapturable: true, required: false, description: 'Order status' },
    { code: 'po.supplier-email', name: 'supplier_email', type: 'text', nullable: true, sensitivity: 'PII', selectable: true, sensitive: true, disclosable: false, tableCapturable: false, required: false, description: 'Supplier contact' },
    { code: 'po.tenant', name: 'tenant_id', type: 'text', nullable: false, sensitivity: 'INTERNAL', selectable: false, sensitive: false, disclosable: true, tableCapturable: false, required: false, description: 'Tenant' },
  ],
  ...patch,
});
export const sourceSummaryOf = (s: LifecycleSource): LifecycleSourceSummary => ({
  application: s.application, code: s.code, name: s.name, description: s.description, provenance: s.provenance, captureModes: s.captureModes, fieldCount: s.fields.length,
});
export const sourceCapabilitiesFixture = (): LifecycleSourceCapabilities => ({
  captureModes: ['SERVICE', 'TABLE'], operations: ['CREATED', 'UPDATED', 'RETIRED', 'DELETED'],
  transforms: ['COPY', 'TRIM', 'LOWERCASE', 'UPPERCASE', 'PRESENT', 'DATE', 'MAP'],
  sensitiveClasses: ['RESTRICTED', 'PII', 'PHI', 'FINANCIAL', 'SECURITY_SENSITIVE'], mappingLimit: 256, fieldLimit: 128, mapValueLimit: 64,
});
export const approvedMapping = (patch: Partial<LifecycleSourceMapping> = {}): LifecycleSourceMapping => ({
  key: 'po-approved', source: { application: 'erp', source: 'purchase_order', release: 'erp-src-4', revision: 2, fingerprint: 'f'.repeat(64) },
  capture: 'SERVICE', operation: 'UPDATED', lifecycle: 'purchase-order', stage: 'ORDER_APPROVAL', event: 'APPROVED', watch: ['status'],
  fields: [{ target: 'orderNumber', source: 'order_number', transform: 'COPY', values: {} }, { target: 'hasSupplierEmail', source: 'supplier_email', transform: 'PRESENT', values: {} }],
  applicability: { include: [], exclude: [] },
  ...patch,
});
