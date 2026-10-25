import {
  BadRequestException, Body, Controller, Delete, Get, Headers, Injectable, Param, ParseIntPipe,
  Post, Put, Query, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { In, MoreThanOrEqual, Not, IsNull, LessThan } from 'typeorm';
import { AuthUser, CurrentUser, hashPassword, Public, Roles, verifyPassword } from '../common/auth';
import { friendly } from '../common/crud.factory';
import {
  CriticalAlert, LabOrder, MiddlewareMessage, OrderTest, OT, Payment, Sample, User,
} from '../entities';
import { LookupService } from './lookup.service';
import { BillingService, OrdersService, PatientsService } from './orders.service';
import { OutsourceService, SamplesService } from './samples.service';
import { ResultsService } from './results.service';
import { ReportsService } from './reports.service';
import { ReportBuilder } from './report-builder';
import { AutomationService } from './automation.service';
import { IntegrationService } from './integration.service';

const FRONT = ['RECEPTION'];
const PHLEB = ['PHLEBOTOMIST', 'RECEPTION', 'TECHNOLOGIST'];
const TECH = ['TECHNOLOGIST', 'PATHOLOGIST'];
const PATH = ['PATHOLOGIST'];

@Controller('auth')
export class AuthController {
  constructor(private lookup: LookupService, private jwt: JwtService) {}

  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const user = await this.lookup.repo(User).createQueryBuilder('u').addSelect('u.passwordHash')
      .where('u.username = :u', { u: (body.username || '').trim() }).getOne();
    if (!user || !user.active || !verifyPassword(body.password || '', user.passwordHash)) {
      throw new UnauthorizedException('Username or password is incorrect');
    }
    const payload: AuthUser = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    return { token: this.jwt.sign(payload), user: payload };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(private lookup: LookupService) {}

  @Get()
  list() {
    return this.lookup.repo(User).find({ order: { id: 'ASC' } });
  }

  @Post()
  async create(@Body() b: any) {
    if (!b.username || !b.fullName || !b.password) throw new BadRequestException('Username, full name and password are required');
    try {
      const { password, id, ...rest } = b;
      const saved = await this.lookup.repo(User).save({ ...rest, passwordHash: hashPassword(password) });
      return this.lookup.repo(User).findOneBy({ id: saved.id });
    } catch (e) {
      throw new BadRequestException(friendly(e));
    }
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    const { password, id: _i, createdAt, updatedAt, passwordHash, ...rest } = b;
    const patch: any = { ...rest };
    if (password) patch.passwordHash = hashPassword(password);
    await this.lookup.repo(User).update(id, patch);
    return this.lookup.repo(User).findOneBy({ id });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.lookup.repo(User).update(id, { active: false });
    return { deactivated: true };
  }
}

@Controller('patients')
export class PatientsController {
  constructor(private svc: PatientsService) {}
  @Get() list(@Query('q') q: string) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles(...FRONT, 'PHLEBOTOMIST') create(@Body() b: any) { return this.svc.save(b); }
  @Put(':id') @Roles(...FRONT, 'PHLEBOTOMIST') update(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.save(b, id); }
}

@Controller('orders')
export class OrdersController {
  constructor(private svc: OrdersService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post() @Roles(...FRONT) create(@Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.create(b, u); }
  @Post(':id/tests') @Roles(...FRONT, ...TECH) addTests(@Param('id', ParseIntPipe) id: number, @Body() b: { testIds: number[] }, @CurrentUser() u: AuthUser) {
    return this.svc.addTests(id, b.testIds || [], u);
  }
  @Post('order-tests/:id/cancel') @Roles(...FRONT, ...TECH) cancel(@Param('id', ParseIntPipe) id: number, @Body() b: { reason: string }, @CurrentUser() u: AuthUser) {
    return this.svc.cancelTest(id, b.reason, u);
  }
}

@Controller('billing')
export class BillingController {
  constructor(private svc: BillingService) {}
  @Get('invoices') list(@Query() q: any) { return this.svc.list(q); }
  @Get('invoices/:id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post('orders/:orderId/invoice') @Roles(...FRONT) create(@Param('orderId', ParseIntPipe) id: number, @Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.create(id, b, u); }
  @Post('invoices/:id/payments') @Roles(...FRONT) pay(@Param('id', ParseIntPipe) id: number, @Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.addPayment(id, b, u); }
  @Post('invoices/:id/cancel') @Roles(...FRONT) cancel(@Param('id', ParseIntPipe) id: number, @Body() b: { reason: string }, @CurrentUser() u: AuthUser) { return this.svc.cancel(id, b.reason, u); }
}

@Controller('samples')
export class SamplesController {
  constructor(private svc: SamplesService) {}
  @Get('pending-collection') pending(@Query('q') q: string) { return this.svc.pendingCollection(q); }
  @Post('collect') @Roles(...PHLEB) collect(@Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.collect(b, u); }
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get('barcode/:no') byNo(@Param('no') no: string) { return this.svc.findByNo(no); }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Post(':id/accession') @Roles(...TECH, 'PHLEBOTOMIST') accession(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) { return this.svc.accession(id, u); }
  @Post(':id/reject') @Roles(...TECH, 'PHLEBOTOMIST') reject(@Param('id', ParseIntPipe) id: number, @Body() b: { reason: string }, @CurrentUser() u: AuthUser) { return this.svc.reject(id, b.reason, u); }
}

@Controller('outsource')
export class OutsourceController {
  constructor(private svc: OutsourceService) {}
  @Get('pending') pending() { return this.svc.pending(); }
  @Get('shipments') list(@Query('status') s: string) { return this.svc.list(s); }
  @Get('shipments/:id') get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }
  @Get('shipments/:id/manifest') manifest(@Param('id', ParseIntPipe) id: number) { return this.svc.manifest(id); }
  @Post('shipments') @Roles(...TECH) create(@Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.createShipment(b, u); }
  @Post('shipments/:id/dispatch') @Roles(...TECH) dispatch(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) { return this.svc.dispatch(id, u); }
  /** Reference labs post results here with their inbound API key. */
  @Public() @Post('results') receive(@Headers('x-api-key') key: string, @Body() b: any) { return this.svc.receiveResults(key, b); }
}

@Controller('results')
export class ResultsController {
  constructor(private svc: ResultsService, private automation: AutomationService, private lookup: LookupService) {}
  @Get('worklist') worklist(@Query() q: any) { return this.svc.worklist(q); }
  @Get('order-tests/:id') detail(@Param('id', ParseIntPipe) id: number) { return this.svc.detail(id); }
  @Post('order-tests/:id') @Roles(...TECH) async save(@Param('id', ParseIntPipe) id: number, @Body() b: { results: any[]; source?: string }, @CurrentUser() u: AuthUser) {
    const ot = await this.lookup.repo(OrderTest).findOneBy({ id });
    const source = b.source === 'EXTERNAL_LAB' || ot?.isOutsourced ? 'EXTERNAL_LAB' : 'MANUAL';
    await this.svc.saveResults(id, b.results || [], source, u.id);
    return this.svc.detail(id);
  }
  @Post('validate') @Roles(...TECH) validate(@Body() b: { ids: number[]; note?: string }, @CurrentUser() u: AuthUser) { return this.svc.validate(b.ids || [], u, b.note); }
  @Post('order-tests/:id/return') @Roles(...TECH) ret(@Param('id', ParseIntPipe) id: number, @Body() b: { note: string }, @CurrentUser() u: AuthUser) { return this.svc.unvalidate(id, b.note, u); }
  @Post('sign') @Roles(...PATH) sign(@Body() b: { ids: number[] }, @CurrentUser() u: AuthUser) { return this.svc.sign(b.ids || [], u); }
  @Post('order-tests/:id/amend') @Roles(...PATH) amend(@Param('id', ParseIntPipe) id: number, @Body() b: { reason: string }, @CurrentUser() u: AuthUser) { return this.svc.amend(id, b.reason, u); }
  @Post('order-tests/:id/rerun') @Roles(...TECH) rerun(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) { return this.automation.rerun(id, u); }
  @Get('critical-alerts') alerts(@Query('status') s: string) { return this.svc.criticalAlerts(s); }
  @Post('critical-alerts/:id/notify') @Roles(...TECH) notify(@Param('id', ParseIntPipe) id: number, @Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.notifyCritical(id, b, u); }
}

@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService, private builder: ReportBuilder, private integration: IntegrationService) {}
  @Get() list(@Query() q: any) { return this.svc.list(q); }
  @Get('order/:orderId') get(@Param('orderId', ParseIntPipe) id: number, @Query('templateId') t: string) { return this.builder.build(id, t ? Number(t) : undefined); }
  @Get('order/:orderId/versions') versions(@Param('orderId', ParseIntPipe) id: number) { return this.svc.versions(id); }
  @Get('versions/:id') version(@Param('id', ParseIntPipe) id: number) { return this.svc.version(id); }
  @Post('order/:orderId/addendum') @Roles(...PATH) addendum(@Param('orderId', ParseIntPipe) id: number, @Body() b: any, @CurrentUser() u: AuthUser) { return this.svc.addAddendum(id, b, u); }
  @Post('order/:orderId/publish') @Roles(...TECH) publish(@Param('orderId', ParseIntPipe) id: number) { return this.integration.publish(id, true); }
}

@Controller('automation')
export class AutomationController {
  constructor(private svc: AutomationService) {}
  @Get('messages') messages(@Query() q: any) { return this.svc.messages(q); }
  @Get('routing') routing() { return this.svc.routing(); }
  @Post('messages/:id/retry') @Roles(...TECH) retry(@Param('id', ParseIntPipe) id: number) { return this.svc.retry(id); }
  /** Manual import of an analyzer result file / message from the UI (HL7, ASTM or JSON text). */
  @Post('ingest') @Roles(...TECH) ingest(@Body() b: { message: string; analyzerCode?: string }, @CurrentUser() u: AuthUser) {
    if (!b?.message) throw new BadRequestException('Paste a result message');
    return this.svc.ingest(b.message, { user: u, analyzerCode: b.analyzerCode || undefined });
  }
  /** Middleware -> LIS results (x-api-key). Accepts application/json, text/plain HL7 ORU, or ASTM. */
  @Public() @Post('results') results(@Headers('x-api-key') key: string, @Body() b: any) { return this.svc.ingest(b, { apiKey: key }); }
  /** PULL-mode middleware polls queued orders (x-api-key). */
  @Public() @Get('middleware/orders') pull(@Headers('x-api-key') key: string) { return this.svc.pullOrders(key); }
}

@Controller('integration')
export class IntegrationController {
  constructor(private svc: IntegrationService) {}
  @Public() @Post('orders') receive(@Headers('x-api-key') key: string, @Body() b: any) { return this.svc.receiveOrder(key, b); }
  @Public() @Get('orders/:externalOrderNo/status') status(@Headers('x-api-key') key: string, @Param('externalOrderNo') no: string) { return this.svc.orderStatus(key, no); }
  @Public() @Get('orders/:externalOrderNo/results') results(@Headers('x-api-key') key: string, @Param('externalOrderNo') no: string, @Query('format') f: string) { return this.svc.pullResults(key, no, f); }
  @Get('logs') logs(@Query() q: any) { return this.svc.logs(q); }
}

@Injectable()
export class DashboardService {
  constructor(private lookup: LookupService) {}

  async summary() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const week = new Date(Date.now() - 7 * 86400000);
    const ot = this.lookup.repo(OrderTest);
    const count = (statuses: string[]) => ot.count({ where: { status: In(statuses) } });
    const [ordersToday, pendingCollection, awaitingAccession, inProcess, awaitingValidation, awaitingSign, signedToday, openCriticals, failedMessages] = await Promise.all([
      this.lookup.repo(LabOrder).count({ where: { createdAt: MoreThanOrEqual(start) } }),
      ot.count({ where: { status: In([OT.ORDERED, OT.BILLED]), sampleId: IsNull() } }),
      this.lookup.repo(Sample).count({ where: { status: 'COLLECTED' } }),
      count([OT.ACCESSIONED, OT.IN_ANALYZER, OT.OUTSOURCED]),
      count([OT.RESULTED, OT.AMENDING]),
      count([OT.VALIDATED]),
      ot.count({ where: { status: OT.SIGNED, signedAt: MoreThanOrEqual(start) } }),
      this.lookup.repo(CriticalAlert).count({ where: { status: 'OPEN' } }),
      this.lookup.repo(MiddlewareMessage).count({ where: { status: In(['FAILED', 'ERROR']) } }),
    ]);
    const payments = await this.lookup.repo(Payment).find({ where: { createdAt: MoreThanOrEqual(start) } });
    const revenueToday = Math.round(payments.reduce((s, p) => s + (p.type === 'REFUND' ? -p.amount : p.amount), 0) * 100) / 100;

    const overdueRows = await ot.find({ where: { status: Not(In([OT.SIGNED, OT.CANCELLED])), dueAt: LessThan(new Date()) }, order: { dueAt: 'ASC' }, take: 25 });
    const overdue = (await this.lookup.enrich(overdueRows)).map((o) => ({
      id: o.id, orderId: o.orderId, orderNo: o.order?.orderNo, patient: o.patient?.fullName, test: o.test?.name, status: o.status,
      priority: o.order?.priority, dueAt: o.dueAt, department: o.department?.name,
    }));

    const signed = await this.lookup.enrich(await ot.find({ where: { status: OT.SIGNED, signedAt: MoreThanOrEqual(week) }, take: 5000 }));
    const byDept = new Map<string, { n: number; mins: number; within: number }>();
    for (const s of signed) {
      const name = s.department?.name || 'General';
      const g = byDept.get(name) || { n: 0, mins: 0, within: 0 };
      g.n++;
      g.mins += (new Date(s.signedAt).getTime() - new Date(s.order.createdAt).getTime()) / 60000;
      if (!s.dueAt || new Date(s.signedAt) <= new Date(s.dueAt)) g.within++;
      byDept.set(name, g);
    }
    const tat = [...byDept.entries()].map(([department, g]) => ({ department, tests: g.n, avgMinutes: Math.round(g.mins / g.n), withinTatPercent: Math.round((g.within / g.n) * 100) }));

    return { ordersToday, pendingCollection, awaitingAccession, inProcess, awaitingValidation, awaitingSign, signedToday, openCriticals, failedMessages, revenueToday, overdue, tat, currency: await this.lookup.setting('billing.currency', 'USD') };
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private svc: DashboardService) {}
  @Get() summary() { return this.svc.summary(); }
}

