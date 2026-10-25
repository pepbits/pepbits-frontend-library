import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Db } from './db/database.service';
import { AuthGuard, Public } from './common/auth';
import { AuthController } from './auth/auth.controller';
import { MastersController, MastersService } from './masters/masters';
import { PatientsController, PatientsService } from './patients/patients';
import { BillingController, OrdersController, OrdersService } from './orders/orders';
import { OutsourceController, SamplesController, SamplesService } from './samples/samples';
import { ResultsService } from './results/results.service';
import { CriticalController, ReportsController, ResultsController } from './results/results.controller';
import { OutboundService } from './integration/outbound.service';
import { InboundService } from './integration/inbound.service';
import { IntegrationAdminController, IntegrationPublicController, IntegrationServers } from './integration/integration.controller';
import { AuditController, DashboardController, InventoryController } from './dashboard/dashboard.controller';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}

@Module({
  controllers: [
    HealthController, AuthController, MastersController, PatientsController, OrdersController, BillingController, SamplesController, OutsourceController,
    ResultsController, ReportsController, CriticalController, IntegrationPublicController, IntegrationAdminController, DashboardController, InventoryController, AuditController,
  ],
  providers: [
    Db, MastersService, PatientsService, OrdersService, OutboundService, SamplesService, ResultsService, InboundService, IntegrationServers,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
