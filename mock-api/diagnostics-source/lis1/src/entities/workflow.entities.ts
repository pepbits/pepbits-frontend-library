import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { Base } from './masters.entities';

export const OT = {
  ORDERED: 'ORDERED',
  BILLED: 'BILLED',
  COLLECTED: 'COLLECTED',
  ACCESSIONED: 'ACCESSIONED',
  IN_ANALYZER: 'IN_ANALYZER',
  OUTSOURCED: 'OUTSOURCED',
  RESULTED: 'RESULTED',
  VALIDATED: 'VALIDATED',
  SIGNED: 'SIGNED',
  AMENDING: 'AMENDING',
  CANCELLED: 'CANCELLED',
} as const;

@Entity('patients')
export class Patient extends Base {
  @Index({ unique: true }) @Column() mrn: string;
  @Column() firstName: string;
  @Column({ nullable: true }) lastName: string;
  @Column({ nullable: true }) dob: string; // YYYY-MM-DD
  @Column({ default: 'U' }) gender: string; // M | F | O | U
  @Column({ nullable: true }) ethnicity: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) address: string;
  @Column({ nullable: true }) nationalId: string;
  @Column({ nullable: true }) externalSystemId: number;
  @Column({ nullable: true }) externalPatientId: string;
  @Column({ default: false }) isPregnant: boolean;
}

@Entity('orders')
export class LabOrder extends Base {
  @Index({ unique: true }) @Column() orderNo: string;
  @Column() patientId: number;
  @Column({ nullable: true }) doctorId: number;
  @Column({ default: 'ROUTINE' }) priority: string; // ROUTINE | STAT
  @Column({ default: 'INTERNAL' }) source: string; // INTERNAL | EXTERNAL
  @Column({ nullable: true }) externalSystemId: number;
  @Column({ nullable: true }) externalOrderNo: string;
  @Column({ nullable: true }) clinicalNotes: string;
  @Column({ nullable: true }) diagnosis: string;
  @Column({ nullable: true }) patientLocation: string;
  @Column({ default: 'NEW' }) status: string; // NEW | IN_PROGRESS | PARTIAL | COMPLETED | CANCELLED
  @Column({ nullable: true }) createdBy: number;
}

@Entity('order_tests')
export class OrderTest extends Base {
  @Index() @Column() orderId: number;
  @Column() testId: number;
  @Column({ nullable: true }) profileId: number;
  @Index() @Column({ default: OT.ORDERED }) status: string;
  @Column({ type: 'real', default: 0 }) price: number;
  @Index() @Column({ nullable: true }) sampleId: number;
  @Column({ type: 'datetime', nullable: true }) dueAt: Date;
  @Column({ default: false }) isOutsourced: boolean;
  @Column({ nullable: true }) externalLabId: number;
  @Column({ nullable: true }) bodySiteId: number;
  @Column({ nullable: true }) analyzerId: number;
  @Column({ default: false }) isBilled: boolean;
  @Column({ nullable: true }) resultedAt: Date;
  @Column({ nullable: true }) validatedBy: number;
  @Column({ type: 'datetime', nullable: true }) validatedAt: Date;
  @Column({ nullable: true }) signedBy: number;
  @Column({ type: 'datetime', nullable: true }) signedAt: Date;
  @Column({ default: 0 }) amendCount: number;
  @Column({ nullable: true }) cancelReason: string;
  @Column({ nullable: true }) technicalNote: string;
}

@Entity('invoices')
export class Invoice extends Base {
  @Index({ unique: true }) @Column() invoiceNo: string;
  @Column() orderId: number;
  @Column() patientId: number;
  @Column({ default: 'SELF' }) payerType: string; // SELF | INSURANCE | CORPORATE
  @Column({ nullable: true }) payerName: string;
  @Column({ type: 'real', default: 0 }) grossAmount: number;
  @Column({ type: 'real', default: 0 }) discountAmount: number;
  @Column({ type: 'real', default: 0 }) taxAmount: number;
  @Column({ type: 'real', default: 0 }) netAmount: number;
  @Column({ type: 'real', default: 0 }) paidAmount: number;
  @Column({ default: 'UNPAID' }) status: string; // UNPAID | PARTIAL | PAID | CANCELLED
  @Column({ nullable: true }) createdBy: number;
  @Column({ nullable: true }) notes: string;
}

@Entity('invoice_items')
export class InvoiceItem extends Base {
  @Index() @Column() invoiceId: number;
  @Column({ nullable: true }) orderTestId: number;
  @Column() description: string;
  @Column({ type: 'real', default: 0 }) amount: number;
}

@Entity('payments')
export class Payment extends Base {
  @Index() @Column() invoiceId: number;
  @Column({ default: 'PAYMENT' }) type: string; // PAYMENT | REFUND
  @Column({ type: 'real' }) amount: number;
  @Column({ default: 'CASH' }) mode: string;
  @Column({ nullable: true }) reference: string;
  @Column({ nullable: true }) receivedBy: number;
}

@Entity('samples')
export class Sample extends Base {
  @Index({ unique: true }) @Column() sampleNo: string; // printed barcode
  @Column() patientId: number;
  @Column({ nullable: true }) sampleTypeId: number;
  @Column({ nullable: true }) containerId: number;
  @Index() @Column({ default: 'COLLECTED' }) status: string; // COLLECTED | ACCESSIONED | IN_PROCESS | SENT_OUT | COMPLETED | REJECTED
  @Column({ type: 'datetime', nullable: true }) collectedAt: Date;
  @Column({ nullable: true }) collectedBy: number;
  @Column({ nullable: true }) collectionSite: string;
  @Column({ type: 'datetime', nullable: true }) accessionedAt: Date;
  @Column({ nullable: true }) accessionedBy: number;
  @Column({ nullable: true }) rejectionReason: string;
  @Column({ type: 'datetime', nullable: true }) rejectedAt: Date;
  @Column({ nullable: true }) rejectedBy: number;
  @Column({ nullable: true }) notes: string;
}

@Entity('outsource_shipments')
export class OutsourceShipment extends Base {
  @Index({ unique: true }) @Column() shipmentNo: string;
  @Column() externalLabId: number;
  @Column({ default: 'DRAFT' }) status: string; // DRAFT | DISPATCHED | COMPLETED
  @Column({ nullable: true }) courier: string;
  @Column({ nullable: true }) trackingNo: string;
  @Column({ type: 'datetime', nullable: true }) dispatchedAt: Date;
  @Column({ nullable: true }) dispatchedBy: number;
  @Column({ nullable: true }) transmissionStatus: string; // SENT | FAILED | NOT_CONFIGURED
  @Column({ type: 'text', nullable: true }) transmissionResponse: string;
  @Column({ nullable: true }) notes: string;
}

@Entity('outsource_items')
export class OutsourceItem extends Base {
  @Index() @Column() shipmentId: number;
  @Column() sampleId: number;
  @Column() orderTestId: number;
  @Column({ nullable: true }) externalReference: string;
  @Column({ default: 'PENDING' }) status: string; // PENDING | SENT | RESULT_RECEIVED
}

@Entity('results')
export class Result extends Base {
  @Index() @Column() orderTestId: number;
  @Column() parameterId: number;
  @Column({ type: 'text', nullable: true }) value: string;
  @Column({ nullable: true }) rawValue: string;
  @Column({ nullable: true }) unit: string;
  @Column({ nullable: true }) flag: string; // N | L | H | LL | HH | A | AA
  @Column({ default: false }) isAbnormal: boolean;
  @Column({ default: false }) isCritical: boolean;
  @Column({ nullable: true }) referenceRangeId: number;
  @Column({ nullable: true }) referenceText: string;
  @Column({ default: 'MANUAL' }) source: string; // MANUAL | ANALYZER | EXTERNAL_LAB | CALCULATED
  @Column({ nullable: true }) analyzerId: number;
  @Column({ nullable: true }) comment: string;
  @Column({ nullable: true }) enteredBy: number;
  @Column({ type: 'datetime', nullable: true }) enteredAt: Date;
}

@Entity('result_history')
export class ResultHistory extends Base {
  @Column() resultId: number;
  @Index() @Column() orderTestId: number;
  @Column() parameterId: number;
  @Column({ nullable: true }) oldValue: string;
  @Column({ nullable: true }) newValue: string;
  @Column({ nullable: true }) oldFlag: string;
  @Column({ nullable: true }) newFlag: string;
  @Column({ nullable: true }) reason: string;
  @Column({ nullable: true }) source: string;
  @Column({ nullable: true }) changedBy: number;
}

@Entity('amendments')
export class Amendment extends Base {
  @Index() @Column() orderTestId: number;
  @Column() orderId: number;
  @Column() reason: string;
  @Column({ default: 'OPEN' }) status: string; // OPEN | COMPLETED
  @Column({ nullable: true }) requestedBy: number;
  @Column({ type: 'datetime', nullable: true }) completedAt: Date;
}

@Entity('reports')
export class Report extends Base {
  @Index({ unique: true }) @Column() reportNo: string;
  @Index({ unique: true }) @Column() orderId: number;
  @Column({ default: 1 }) version: number;
  @Column({ default: 'PARTIAL' }) status: string; // PARTIAL | FINAL | AMENDED
  @Column({ type: 'datetime', nullable: true }) firstReleasedAt: Date;
  @Column({ type: 'datetime', nullable: true }) lastReleasedAt: Date;
  @Column({ nullable: true }) lastPublishedStatus: string;
}

@Entity('report_versions')
export class ReportVersion extends Base {
  @Index() @Column() reportId: number;
  @Column() version: number;
  @Column() event: string; // RELEASE | AMENDMENT | ADDENDUM
  @Column({ nullable: true }) reason: string;
  @Column({ type: 'text' }) snapshot: string;
  @Column({ nullable: true }) createdBy: number;
}

@Entity('addenda')
export class Addendum extends Base {
  @Index() @Column() orderId: number;
  @Column({ nullable: true }) orderTestId: number;
  @Column({ type: 'text' }) text: string;
  @Column({ nullable: true }) createdBy: number;
}

@Entity('critical_alerts')
export class CriticalAlert extends Base {
  @Column() resultId: number;
  @Index() @Column() orderTestId: number;
  @Column() patientId: number;
  @Column() parameterName: string;
  @Column({ nullable: true }) value: string;
  @Column({ nullable: true }) flag: string;
  @Index() @Column({ default: 'OPEN' }) status: string; // OPEN | NOTIFIED
  @Column({ nullable: true }) notifiedTo: string;
  @Column({ nullable: true }) notifiedBy: number;
  @Column({ type: 'datetime', nullable: true }) notifiedAt: Date;
  @Column({ default: false }) readBackConfirmed: boolean;
  @Column({ nullable: true }) notes: string;
}

@Entity('middleware_messages')
export class MiddlewareMessage extends Base {
  @Column() direction: string; // OUTBOUND | INBOUND
  @Column({ nullable: true }) middlewareId: number;
  @Column({ nullable: true }) analyzerId: number;
  @Column({ nullable: true }) sampleId: number;
  @Column({ nullable: true }) sampleNo: string;
  @Column() messageType: string; // ORDER | RESULT | CANCEL
  @Column({ default: 'JSON' }) format: string;
  @Column({ type: 'text' }) payload: string;
  @Column({ type: 'text', nullable: true }) response: string;
  @Index() @Column({ default: 'PENDING' }) status: string; // PENDING | SENT | FAILED | PROCESSED | PARTIAL | ERROR
  @Column({ type: 'text', nullable: true }) error: string;
  @Column({ default: 0 }) attempts: number;
}

@Entity('integration_logs')
export class IntegrationLog extends Base {
  @Column({ nullable: true }) externalSystemId: number;
  @Column({ nullable: true }) externalLabId: number;
  @Column() direction: string; // INBOUND | OUTBOUND
  @Column() eventType: string; // ORDER_IN | RESULT_OUT | RESULT_IN | MANIFEST_OUT
  @Column({ nullable: true }) reference: string;
  @Column({ type: 'text', nullable: true }) payload: string;
  @Column({ type: 'text', nullable: true }) response: string;
  @Column({ default: 'SUCCESS' }) status: string;
  @Column({ type: 'text', nullable: true }) error: string;
}

@Entity('audit_logs')
export class AuditLog extends Base {
  @Column() entity: string;
  @Column({ nullable: true }) entityId: number;
  @Column() action: string;
  @Column({ type: 'text', nullable: true }) detail: string;
  @Column({ nullable: true }) userId: number;
}

@Entity('counters')
export class Counter {
  @PrimaryColumn() name: string;
  @Column({ default: 0 }) value: number;
}
