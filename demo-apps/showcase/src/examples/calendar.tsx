"use client";
import React, {useState, useId} from "react";
import {DateRangeInput} from "@pepbits/ui";
import {Calendar} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";

export function CalendarDemo() {
  const {language} = useLocalization();
  const [start, setStart] = useState("2026-09-09");
  const [end, setEnd] = useState("2026-09-20");
  return <div className="space-y-3"><DateRangeInput start={{label:"Start date",value:start,onChange:e => setStart(e.target.value)}} end={{label:"End date",value:end,onChange:e => setEnd(e.target.value)}} />
    <Calendar locale={language} label="Date" value={start} onChange={setStart} max={end} />
  </div>;
}

