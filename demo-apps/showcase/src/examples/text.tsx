"use client";
import React, {useState, useId} from "react";
import {Highlight, Input, QuantityUnitField, ScannerInput, SearchInput, Textarea} from "@pepbits/ui";

export function TextDemo() {
  const [quantityUnit, setQuantityUnit] = useState({quantity:"1",unit:"EA"});
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  return <div className="space-y-3">
    <QuantityUnitField label="Amount" quantityLabel="template.field.quantity" unitLabel="template.field.unit" value={quantityUnit} onChange={setQuantityUnit} options={[{value:"EA",label:"EA"},{value:"BOX",label:"BOX"}]} />
    <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />
    <Input label="Email" type="email" placeholder="Email" />
    <Input label="Password" type="password" autoComplete="new-password" />
    <Input label="Amount" type="number" min={0} />
    <SearchInput aria-label="Search" value={search} onChange={setSearch} onClear={() => setSearch("")} />
    <Highlight text="Example searchable record" query={search} />
    <ScannerInput label="devices.code" hint="devices.scanHint" onScan={async value => { setSearch(value); return true; }} />
    <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
  </div>;
}

