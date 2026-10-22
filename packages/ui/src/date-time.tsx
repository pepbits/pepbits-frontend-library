import React from "react";
import { Input } from "./form-controls";

export type DateTimeInputProps = Omit<React.ComponentProps<typeof Input>, "type">;
/** ISO values stay unchanged in forms and API payloads. Browser controls provide
 * keyboard entry and native pickers; display formatting is a separate concern. */
export function DateInput(props: DateTimeInputProps) { return <Input {...props} type="date" />; }
export function TimeInput(props: DateTimeInputProps) { return <Input {...props} type="time" />; }
/** A local wall-clock value, without an implied timezone or conversion to UTC. */
export function DateTimeInput(props: DateTimeInputProps) { return <Input {...props} type="datetime-local" />; }
export function MonthInput(props: DateTimeInputProps) { return <Input {...props} type="month" />; }
export function WeekInput(props: DateTimeInputProps) { return <Input {...props} type="week" />; }

export function DateRangeInput({ start, end, className }: {
  start: DateTimeInputProps; end: DateTimeInputProps; className?: string;
}) {
  const startValue = typeof start.value === "string" ? start.value : undefined;
  const endValue = typeof end.value === "string" ? end.value : undefined;
  const max = endValue && (!start.max || endValue < String(start.max)) ? endValue : start.max;
  const min = startValue && (!end.min || startValue > String(end.min)) ? startValue : end.min;
  return <div className={className ?? "grid grid-cols-2 gap-3"}><DateInput {...start} max={max} /><DateInput {...end} min={min} /></div>;
}
