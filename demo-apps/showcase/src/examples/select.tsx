"use client";
import React, {useState, useId} from "react";
import {MultiSelect, SearchSelect, Select, optionsFromChildren, splitFieldClasses} from "@pepbits/ui";

export function SelectDemo() {
  const [value, setValue] = useState("active");
  const [many, setMany] = useState<string[]>([]);
  const {options} = optionsFromChildren(<><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></>);
  const control=splitFieldClasses("h-9 text-[length:calc(13px*var(--fs-scale))]");
  return <div className="space-y-3">
    <Select style={control.style} className={control.wrapper} label="Status" options={options} value={value} onChange={e => setValue(e.target.value)} />
    <SearchSelect label="Search" options={options} value={value} onChange={setValue} />
    <MultiSelect label="Filters" options={options} value={many} onChange={setMany} />
  </div>;
}

