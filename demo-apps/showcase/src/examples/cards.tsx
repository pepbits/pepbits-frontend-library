"use client";
import React, {useState, useId} from "react";
import {Avatar, Badge, StatusBadge} from "@pepbits/ui";
import {Card, CardContent, CardFooter, CardGrid, CardHeader, CardTitle, DataValue, DescriptionList} from "@pepbits/components";
import {LocalizedText} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";

export function CardsDemo() {
  const format = useFormatters();
  return <CardGrid columns={2}>
    <Card><CardHeader><CardTitle title="Summary" subtitle="catalog.sampleData" /></CardHeader><CardContent><DataValue value={1200} numeric format={format.number} /></CardContent><CardFooter><Badge tone="success"><LocalizedText message="Active"/></Badge></CardFooter></Card>
    <Card tone="muted" shadow="none"><CardContent><Avatar name="Demo User" /><DescriptionList items={[{id:"id",label:"Record ID",value:"DEMO-001"},{id:"status",label:"Status",value:<StatusBadge value="Pending"/>}]} /></CardContent></Card>
  </CardGrid>;
}

