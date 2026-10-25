import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Addendum, LabOrder, OrderTest, OT, Patient, Report, ReportVersion } from '../entities';
import { SequenceService } from '../common/sequence.service';
import { AuthUser } from '../common/auth';
import { LookupService } from './lookup.service';
import { ReportBuilder } from './report-builder';
import { IntegrationService } from './integration.service';

@Injectable()
export class ReportsService {
  constructor(
    private lookup: LookupService,
    private seq: SequenceService,
    private builder: ReportBuilder,
    @Inject(forwardRef(() => IntegrationService)) private integration: IntegrationService,
  ) {}

  /** Creates or re-versions the order's report and snapshots it; then publishes to the originating system. */
  async release(orderId: number, event: 'RELEASE' | 'AMENDMENT' | 'ADDENDUM', reason: string | null, user: AuthUser | null) {
    const repo = this.lookup.repo(Report);
    let report = await repo.findOneBy({ orderId });
    const ots = (await this.lookup.repo(OrderTest).findBy({ orderId })).filter((o) => o.status !== OT.CANCELLED);
    const allSigned = ots.length > 0 && ots.every((o) => o.status === OT.SIGNED);
    const anyAmended = ots.some((o) => o.amendCount > 0);
    const status = !allSigned ? 'PARTIAL' : anyAmended ? 'AMENDED' : 'FINAL';
    const now = new Date();
    if (!report) {
      report = await repo.save({ reportNo: await this.seq.next('RPT'), orderId, version: 1, status, firstReleasedAt: now, lastReleasedAt: now });
    } else {
      report.version += 1;
      report.status = status;
      report.lastReleasedAt = now;
      await repo.save(report);
    }
    const snapshot = await this.builder.build(orderId);
    await this.lookup.repo(ReportVersion).save({ reportId: report.id, version: report.version, event, reason, snapshot: JSON.stringify(snapshot), createdBy: user?.id ?? null });
    try {
      await this.integration.publish(orderId);
    } catch {
      /* publication failures are logged in integration_logs and can be retried */
    }
    return repo.findOneBy({ id: report.id });
  }

  async addAddendum(orderId: number, body: { text: string; orderTestId?: number }, user: AuthUser) {
    if (!body.text?.trim()) throw new BadRequestException('Write the addendum text');
    const report = await this.lookup.repo(Report).findOneBy({ orderId });
    if (!report) throw new BadRequestException('Addenda can be added only after a report is released');
    await this.lookup.repo(Addendum).save({ orderId, orderTestId: body.orderTestId || null, text: body.text.trim(), createdBy: user.id });
    await this.lookup.audit('report', report.id, 'ADDENDUM', body.text, user.id);
    return this.release(orderId, 'ADDENDUM', body.text.trim().slice(0, 200), user);
  }

  async list(q: { status?: string; q?: string }) {
    const qb = this.lookup.repo(Report).createQueryBuilder('r')
      .leftJoin(LabOrder, 'o', 'o.id = r.orderId').leftJoin(Patient, 'p', 'p.id = o.patientId')
      .select('r.*').addSelect('o.orderNo', 'orderNo').addSelect('o.priority', 'priority').addSelect('o.source', 'source')
      .addSelect("p.firstName || ' ' || COALESCE(p.lastName,'')", 'patientName').addSelect('p.mrn', 'mrn')
      .orderBy('r.lastReleasedAt', 'DESC').limit(300);
    if (q.status) qb.andWhere('r.status = :s', { s: q.status });
    if (q.q) qb.andWhere('(r.reportNo LIKE :t OR o.orderNo LIKE :t OR p.mrn LIKE :t OR p.firstName LIKE :t OR p.lastName LIKE :t)', { t: `%${q.q}%` });
    return qb.getRawMany();
  }

  async versions(orderId: number) {
    const report = await this.lookup.repo(Report).findOneBy({ orderId });
    if (!report) return [];
    const rows = await this.lookup.repo(ReportVersion).find({ where: { reportId: report.id }, order: { version: 'DESC' }, select: ['id', 'version', 'event', 'reason', 'createdAt', 'createdBy'] });
    const users = await this.lookup.userNames(rows.map((r) => r.createdBy));
    return rows.map((r) => ({ ...r, createdByName: users.get(r.createdBy)?.fullName }));
  }

  async version(versionId: number) {
    const v = await this.lookup.repo(ReportVersion).findOneBy({ id: versionId });
    if (!v) throw new NotFoundException('Report version not found');
    return { ...v, snapshot: JSON.parse(v.snapshot) };
  }
}
