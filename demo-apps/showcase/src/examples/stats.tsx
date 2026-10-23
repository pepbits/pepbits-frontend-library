"use client";
import React, {useState, useId} from "react";
import {CardGrid, StatCard} from "@pepbits/components";
import {useFormatters} from "@pepbits/patterns/screen-host";

export function StatsDemo() {
  const format = useFormatters();
  return <CardGrid columns={2}><StatCard label="Total" value={format.number(1200)} trend={{direction:"up",delta:"+12%",comparedTo:"vs last month"}} />
    <StatCard label="Pending" value={format.number(24)} tone="inverse" trend={{direction:"down",delta:"-8%",comparedTo:"vs last month"}} /></CardGrid>;
}

