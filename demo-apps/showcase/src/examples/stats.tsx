"use client";
import React from "react";
import {Card, CardGrid, StatCard, Sparkline, LineChart, DonutChart, BarChart} from "@pepbits/components";
import {useFormatters} from "@pepbits/patterns/screen-host";

export function StatsDemo() {
  const format = useFormatters();
  const values = [12, 18, 16, 24];
  return <div className="space-y-4"><CardGrid columns={2}>
    <StatCard label="Total" value={format.number(1200)} trend={{direction:"up",delta:"+12%",comparedTo:"vs last month"}} />
    <StatCard label="Pending" value={format.number(24)} tone="inverse" trend={{direction:"down",delta:"-8%",comparedTo:"vs last month"}} />
  </CardGrid><Card className="space-y-3 p-3">
    <Sparkline values={values}/>
    <LineChart label="Total" labels={values.map((_,index) => format.number(index + 1))} series={[{id:'total',label:'Total',values}]} formatValue={format.number}/>
    <DonutChart label="Status" parts={[{label:'Active',value:24},{label:'Pending',value:6}]} formatValue={format.number}/>
    <BarChart label="Status" labels={['Active','Pending']} series={[{id:'total',label:'Total',values:[24,6]}]} formatValue={format.number}/>
  </Card></div>;
}
