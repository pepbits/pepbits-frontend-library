import {Card, CardGrid, StatCard, Sparkline, LineChart, DonutChart, LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {CollectionView} from '@pepbits/components/collection-view';
import {Button, Badge} from '@pepbits/ui';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {formatCompactMoney} from '@pepbits/i18n';
import {useNavigation} from '@pepbits/platform/navigation';
import {useFetch} from './client';
import {useKeystone} from './context';
import {PAGES} from './catalog';
import {pageId} from '../../navigation';
interface DashboardData {
  kpis: {key:string;label:string;value:number;format:string;delta:number;spark:number[];note?:string}[];
  months:string[];sales:number[];purchases:number[];statusSplit:{label:string;value:number}[];
  topCustomers:{name:string;value:number;group:string}[];
  recentOrders:{id:string;code:string;customer:string;date:string;total:number;status:string}[];
  approvals:{id:string;code:string;type:string;requester:string;amount:number;days?:number;priority:string;submitted:string}[];
  pendingApprovals:number;openTickets:number;purchaseValue:number;
}
export function Dashboard() {
  const result = useFetch<DashboardData>('/api/dashboard'), format = useFormatters(), {preferences} = usePreferences(), {t} = useLocalization(), navigation = useNavigation(), {variant} = useKeystone();
  if (result.error) return <RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.reload}/>;
  if (!result.data) return <LoadingState/>;
  const data = result.data, compact = (value:number) => formatCompactMoney(preferences,value), max = Math.max(1,...data.topCustomers.map(customer => customer.value));
  const open = (slug:string,recordId?:string) => {const def = PAGES.find(page => page.slug === slug)!;navigation.open({pageId:pageId(variant,def),...(variant === 'erp2' && recordId ? {recordId,mode:'view' as const} : {})});};
  return <section data-erp-dashboard className="space-y-3" style={{fontSize:'calc(1rem * var(--fs-result))'}}><h1>{t('Dashboard')}</h1><CardGrid columns={4}>{data.kpis.map(kpi => <Card key={kpi.key}><StatCard className="border-0 shadow-none" label={kpi.label} value={kpi.format === 'currency' ? compact(kpi.value) : format.number(kpi.value)} trend={{direction:kpi.delta > 0 ? 'up' : kpi.delta < 0 ? 'down' : 'flat',delta:format.number(kpi.delta) + '%',comparedTo:kpi.note ?? 'vs last period'}}/><div className="px-3.5 pb-3.5"><Sparkline values={kpi.spark}/></div></Card>)}</CardGrid>
    <div className="grid gap-3 lg:grid-cols-3"><Card className="space-y-3 p-3 lg:col-span-2"><h2>{t('Sales and purchases, last 12 months')}</h2><LineChart label="Monthly sales and purchases for the last twelve months" labels={data.months} series={[{id:'sales',label:'Sales',values:data.sales},{id:'purchases',label:'Purchases',values:data.purchases,dashed:true}]} formatValue={compact}/></Card><Card className="space-y-3 p-3"><h2>{t('Invoice value by status')}</h2><Button variant="ghost" onClick={() => open('sales-register')}>{t('Register')}</Button><DonutChart totalLabel="All invoices" label="Invoice value by status" parts={data.statusSplit} formatValue={compact}/></Card></div>
    <div className="grid items-start gap-3 xl:grid-cols-[5fr_4fr_3fr]"><Card className="space-y-3 p-3"><h2>{t('Recent sales orders')}</h2><Button variant="ghost" onClick={() => open('sales-orders')}>{t('All orders')}</Button><CollectionView view={preferences.resultView} rows={data.recentOrders} rowKey={row => row.id} columns={[{key:'code',header:'Order'},{key:'customer',header:'Customer'},{key:'date',header:'Date',render:row => format.date(row.date)},{key:'total',header:'Total',render:row => format.money(row.total)},{key:'status',header:'Status',render:row => <Badge>{t(row.status)}</Badge>}]} onRowClick={variant === 'erp2' ? row => open('sales-orders',row.id) : undefined}/></Card>
      <Card className="space-y-3 p-3"><h2>{t('Waiting on you')} · {format.number(data.pendingApprovals)}</h2><Button variant="ghost" onClick={() => open('approvals')}>{t('Open inbox')}</Button><ul>{data.approvals.map(approval => <li key={approval.id} className="border-b border-[var(--border)] py-2"><Button variant="ghost" onClick={() => open('approvals',approval.id)}>{approval.type} · {approval.requester} · {approval.code}</Button><p>{format.date(approval.submitted)} · {approval.type === 'Leave' ? format.number(approval.days ?? 0) + ' ' + t('days') : compact(approval.amount)} · {t(approval.priority)}</p></li>)}</ul></Card>
      <Card className="space-y-3 p-3"><h2>{t('Largest receivables')}</h2><ul>{data.topCustomers.map(customer => <li key={customer.name} className="space-y-1 py-2"><span>{customer.name} · {compact(customer.value)}</span><div aria-hidden className="h-2 overflow-hidden rounded-[var(--radius)] bg-[var(--surface-2)]"><div className="h-full bg-[var(--primary)]" style={{width:Math.max(0,customer.value / max * 100) + '%'}}/></div></li>)}</ul><Button variant="ghost" onClick={() => open('support-tickets')}>{t('Open tickets')} · {format.number(data.openTickets)}</Button><Button variant="ghost" onClick={() => open('purchase-register')}>{t('Purchases')} · {compact(data.purchaseValue)}</Button></Card>
    </div>
  </section>;
}
