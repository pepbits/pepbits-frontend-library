"use client";
import React, {useState, useId} from "react";
import {DashboardSkeleton, FormSkeleton, Select, Skeleton, TableSkeleton} from "@pepbits/ui";

export function SkeletonsDemo() {
  const [view,setView] = useState("table");
  return <div className="space-y-3"><Select label="View" value={view} onChange={e => setView(e.target.value)} options={[{value:"table",label:"TableSkeleton"},{value:"form",label:"FormSkeleton"},{value:"dashboard",label:"DashboardSkeleton"}]}/>
    <Skeleton className="h-6 w-32"/>{view === "table" ? <TableSkeleton rows={3}/> : view === "form" ? <FormSkeleton/> : <DashboardSkeleton/>}
  </div>;
}

