"use client";
import React, {useState, useId} from "react";
import {MultiSelect, SearchSelect, Select} from "@pepbits/ui";

export function SelectDemo() {
  const [value, setValue] = useState("active");
  const [many, setMany] = useState<string[]>([]);
  const options = [{value:"active",label:"Active"},{value:"pending",label:"Pending"},{value:"inactive",label:"Inactive"}];
  return <div className="space-y-3">
    <Select label="Status" options={options} value={value} onChange={e => setValue(e.target.value)} />
    <SearchSelect label="Search" options={options} value={value} onChange={setValue} />
    <MultiSelect label="Filters" options={options} value={many} onChange={setMany} />
  </div>;
}

