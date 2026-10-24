/** Date-only arithmetic uses local noon to avoid DST midnight gaps. */
export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function shiftDay(day: string, delta: number) {const date = new Date(day + 'T12:00:00'); date.setDate(date.getDate() + delta); return localDay(date);}
