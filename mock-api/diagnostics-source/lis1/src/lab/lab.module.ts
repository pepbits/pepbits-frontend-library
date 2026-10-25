import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';
import { SequenceService } from '../common/sequence.service';
import { LookupService } from './lookup.service';
import { ReferenceService } from './reference.service';
import { BillingService, OrdersService, PatientsService } from './orders.service';
import { OutsourceService, SamplesService } from './samples.service';
import { ResultsService } from './results.service';
import { ReportsService } from './reports.service';
import { ReportBuilder } from './report-builder';
import { IntegrationService } from './integration.service';
import { AutomationService } from './automation.service';
import {
  AuthController, AutomationController, BillingController, DashboardController, DashboardService, IntegrationController,
  OrdersController, OutsourceController, PatientsController, ReportsController, ResultsController, SamplesController,
  UsersController,
} from './controllers';
import { MASTER_CONTROLLERS } from './masters';

@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  controllers: [
    AuthController, UsersController, PatientsController, OrdersController, BillingController, SamplesController,
    OutsourceController, ResultsController, ReportsController, AutomationController, IntegrationController,
    DashboardController, ...MASTER_CONTROLLERS,
  ],
  providers: [
    SequenceService, LookupService, ReferenceService, PatientsService, OrdersService, BillingService, SamplesService,
    OutsourceService, ResultsService, ReportsService, ReportBuilder, IntegrationService, AutomationService, DashboardService,
  ],
})
export class LabModule {}
