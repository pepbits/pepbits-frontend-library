import clsx, { type ClassValue } from "clsx";

/** Source class composition. Tailwind conflicts are resolved by order of use in the source, as before. */
export const cx = (...inputs: ClassValue[]) => clsx(inputs);
