'use client';
import React, {useMemo} from 'react';
import {useNavigation} from '@pepbits/platform/navigation';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {NotFoundState} from '@pepbits/components';
import {settlePathFor, targetForSettlePath, type SettleTarget} from '../../navigation';
import {SettleRouteProvider, type SettleRoute} from './host';
import {AppShell} from './components/shell/AppShell';
import DeskPage from './pages/desk';
import BillsPage from './pages/bills';
import BillPage from './pages/bill';
import PatientsPage from './pages/patients';
import PatientAccountPage from './pages/patient';
import ReceiptsPage from './pages/receipts';
import ApprovalsPage from './pages/approvals';
import DayClosePage from './pages/day-close';
import ReportsPage from './pages/reports';
import AuditPage from './pages/audit';
import SettingsPage from './pages/settings';
import PrintBill from './pages/print-bill';
import PrintReceipt from './pages/print-receipt';

const SCREENS: Record<string, React.ComponentType> = {
  'settle-desk': DeskPage, 'settle-bills': BillsPage, 'settle-bill': BillPage, 'settle-patients': PatientsPage, 'settle-patient': PatientAccountPage,
  'settle-receipts': ReceiptsPage, 'settle-approvals': ApprovalsPage, 'settle-day-close': DayClosePage, 'settle-reports': ReportsPage,
  'settle-audit': AuditPage, 'settle-settings': SettingsPage, 'settle-print-bill': PrintBill, 'settle-print-receipt': PrintReceipt,
};

/** Page-engine renderer for every Settle page: maps the host NavigationPort onto Settle paths. */
export function SettlePage({page, target}: PageRenderContext) {
  const navigation = useNavigation();
  const path = settlePathFor({...(target as SettleTarget), pageId: page.id});
  const route = useMemo<SettleRoute>(() => ({
    path,
    navigate: destination => navigation.open(targetForSettlePath(destination)),
    hrefFor: destination => navigation.hrefFor(targetForSettlePath(destination)),
    openWindow: destination => navigation.openInNewContext(targetForSettlePath(destination)),
  }), [path, navigation]);
  const Screen = SCREENS[page.id];
  return (
    <SettleRouteProvider value={route}>
      <div data-page-id={page.id} className="h-full">
        <AppShell>{Screen ? <Screen key={path.split('?')[0]}/> : <NotFoundState/>}</AppShell>
      </div>
    </SettleRouteProvider>
  );
}
