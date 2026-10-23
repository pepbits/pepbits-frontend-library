"use client";
import React, {useState, useId} from "react";
import {StatusBadge} from "@pepbits/ui";
import {DataValue, DescriptionList} from "@pepbits/components";
import {useFormatters} from "@pepbits/patterns/screen-host";

export function ValuesDemo() {
  const format = useFormatters();
  return <DescriptionList layout="stacked" items={[
    {id:"money",label:"Amount",value:<DataValue value={12345.67} numeric format={format.money}/>},
    {id:"empty",label:"Notes",value:<DataValue value={null}/>},
    {id:"date",label:"Date",value:<DataValue value="2026-09-09" format={format.date}/>},
    {id:"status",label:"Status",value:<StatusBadge value="Active"/>},
  ]}/>;
}

