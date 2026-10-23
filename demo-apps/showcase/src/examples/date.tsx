"use client";
import React, {useState, useId} from "react";
import {DateInput, DateTimeInput, MonthInput, TimeInput, WeekInput} from "@pepbits/ui";

export function DateDemo() {
  const [date, setDate] = useState("2026-09-09");
  const [time, setTime] = useState("09:30");
  const [dateTime, setDateTime] = useState("2026-09-09T09:30");
  const [month, setMonth] = useState("2026-09");
  const [week, setWeek] = useState("2026-W37");
  return <div className="space-y-3">
    <DateInput label="Date" value={date} onChange={e => setDate(e.target.value)} />
    <TimeInput label="Time" value={time} onChange={e => setTime(e.target.value)} />
    <DateTimeInput label="Date and time" value={dateTime} onChange={e => setDateTime(e.target.value)} />
    <MonthInput label="Month" value={month} onChange={e => setMonth(e.target.value)} />
    <WeekInput label="Week" value={week} onChange={e => setWeek(e.target.value)} />
  </div>;
}

