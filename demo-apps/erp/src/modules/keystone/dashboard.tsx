import {RangeSparkline, TrendPlot, DonutSummary} from '@pepbits/components/dashboard-visuals';
import {Card, CardGrid, LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {CollectionView} from '@pepbits/components/collection-view';
import {Button, Badge, Avatar, StatusBadge} from '@pepbits/ui';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {formatCompactMoney, formatShortDate} from '@pepbits/i18n';
import {useNavigation} from '@pepbits/platform/navigation';
import {useFetch} from './client';
import {useKeystone} from './context';
import {PAGES} from './catalog';
import {pageId} from '../../navigation';
import type {ReactNode} from 'react';
import {TrendingUp, TrendingDown} from '@pepbits/icons';
import './workspace-reports.css';
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
  const panel = (span:number,title:string,body:ReactNode,action?:ReactNode,kind?:string) => <Card shadow="none" data-dashboard-widget={kind} className={'erp-dashboard-panel erp-span-'+span}><header><h2>{t(title)}</h2>{action}</header>{body}</Card>;
  const link = (slug:string,label:string) => <Button variant="ghost" onClick={()=>open(slug)}>{t(label)}</Button>;
  return <section data-erp-dashboard data-density={preferences.density} className="erp-dashboard"><h1 className="sr-only">{t('Dashboard')}</h1><CardGrid className="erp-dashboard-grid">
    {data.kpis.map(kpi=><Card shadow="none" key={kpi.key} data-dashboard-kpi className="erp-span-3 erp-dashboard-kpi"><div><p>{t(kpi.label)}</p><strong>{kpi.format==='currency'?compact(kpi.value):format.number(kpi.value)}</strong><div className="erp-kpi-delta" style={{color:kpi.delta>=0?'var(--success-ink)':'var(--danger-ink)'}}>{kpi.delta>=0?<TrendingUp size={13}/>:<TrendingDown size={13}/>}<span>{kpi.delta>0?'+':''}{format.number(kpi.delta)}%</span><span>{t(kpi.note??'vs last period')}</span></div></div><RangeSparkline values={kpi.spark} color={kpi.delta>=0?'var(--success)':'var(--danger)'} fill={kpi.delta>=0?'color-mix(in srgb, var(--success) 12%, var(--surface))':'color-mix(in srgb, var(--danger) 12%, var(--surface))'}/></Card>)}
    {panel(8,'Sales and purchases, last 12 months',<div className="erp-trend-body"><TrendPlot label="Monthly sales and purchases for the last twelve months" labels={data.months} series={[{id:'sales',label:'Sales',values:data.sales,fill:true},{id:'purchases',label:'Purchases',values:data.purchases,dashed:true}]} formatAxis={compact} formatValue={format.money}/></div>,<div className="erp-trend-legend"><span><i/>{t('Sales')}</span><span><i/>{t('Purchases')}</span></div>,'trend')}
    {panel(4,'Invoice value by status',<div className="erp-donut-body"><DonutSummary totalLabel="All invoices" label="Invoice value by status" parts={data.statusSplit.map(part=>({...part,color:part.label==='Paid'?'var(--success)':part.label==='Overdue'?'var(--danger)':part.label==='Partially paid'?'var(--info)':part.label==='Unpaid'?'var(--chart-5, var(--primary))':'var(--warning)'}))} formatValue={compact} formatPercent={value=>format.number(Math.round(value))+'%'}/></div>,link('sales-register','Register'),'status')}
    {panel(5,'Recent sales orders',<CollectionView className="erp-dashboard-orders" view={preferences.resultView} rows={data.recentOrders} rowKey={row=>row.id} columns={[{key:'code',header:'Order'},{key:'customer',header:'Customer',className:'max-w-[180px] truncate'},{key:'date',header:'Date',render:row=>formatShortDate(preferences,row.date)},{key:'total',header:'Total',align:'right',render:row=>format.money(row.total)},{key:'status',header:'Status',align:'right',render:row=><StatusBadge value={row.status}/>}]} onRowClick={variant==='erp2'?row=>open('sales-orders',row.id):undefined}/>,link('sales-orders','All orders'),'orders')}
    {panel(4,t('Waiting on you')+' ('+format.number(data.pendingApprovals)+')',<ul className="erp-dashboard-approvals">{data.approvals.map(approval=><li key={approval.id}><Button variant="ghost" onClick={()=>open('approvals',approval.id)}><Avatar name={approval.requester} size="sm"/><span><span>{t(approval.type)} {t('from')} {approval.requester}</span><small>{approval.code}, {format.date(approval.submitted)}</small></span><span className="erp-approval-amount">{approval.type==='Leave'?format.number(approval.days??0)+' '+t('days'):compact(approval.amount)}{approval.priority!=='Normal'&&<Badge tone={approval.priority==='Urgent'?'danger':'warning'}>{t(approval.priority)}</Badge>}</span></Button></li>)}</ul>,link('approvals','Open inbox'),'approvals')}
    {panel(3,'Largest receivables',<div className="erp-receivables-body"><ul>{data.topCustomers.map(customer=><li key={customer.name}><div><span>{customer.name}</span><strong>{compact(customer.value)}</strong></div><div className="erp-receivable-bar" aria-hidden><div style={{width:Math.max(0,customer.value/max*100)+'%'}}/></div></li>)}</ul><div className="erp-dashboard-shortcuts"><Button variant="ghost" onClick={()=>open('support-tickets')}><span>{t('Open tickets')}</span><strong>{format.number(data.openTickets)}</strong></Button><Button variant="ghost" onClick={()=>open('purchase-register')}><span>{t('Purchases')}</span><strong>{compact(data.purchaseValue)}</strong></Button></div></div>,undefined,'receivables')}
  </CardGrid></section>;
}
