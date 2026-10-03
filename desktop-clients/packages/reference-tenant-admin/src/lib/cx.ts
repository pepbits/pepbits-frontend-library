import clsx, { type ClassValue } from "clsx";

/** Source class composition (the source's `clsx`). */
export const cx = (...inputs: ClassValue[]) => clsx(inputs);
