"use client";
import React, {useState, useId} from "react";
import {Select} from "@pepbits/ui";
import {DescriptionList, InlineEdit, InlineEditDate, InlineEditNumber, InlineEditSelect, InlineEditStatus} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";

export function InlineDemo() {
  const format = useFormatters();
  const {t} = useLocalization();
  const [name,setName] = useState("DEMO-001");
  const [amount,setAmount] = useState(100);
  const [status,setStatus] = useState("active");
  const [date,setDate] = useState("2026-09-09");
  const options = [{value:"active",label:"Active"},{value:"pending",label:"Pending"}];
  return <DescriptionList layout="stacked" items={[
    {id:"name",label:"Name",value:<InlineEdit label="Name" value={name} onCommit={setName} validate={next => next.trim() ? null : t("Required")}/>},
    {id:"amount",label:"Amount",value:<InlineEditNumber label="Amount" value={amount} display={format.number(amount)} min={0} onCommit={setAmount}/>},
    {id:"select",label:"Select",value:<InlineEditSelect label="Select" value={status} options={options} onCommit={setStatus}/>},
    {id:"date",label:"Date",value:<InlineEditDate label="Date" value={date} display={format.date(date)} onCommit={setDate}/>},
    {id:"status",label:"Status",value:<InlineEditStatus label="Status" value={status} options={options} onCommit={setStatus} allowedTransitions={{active:["pending"],pending:["active"]}}/>},
  ]}/>;
}

