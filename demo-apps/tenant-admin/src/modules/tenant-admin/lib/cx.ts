/** Source class composition (the source's `clsx` for strings and conditional fragments). Classes are never merged or reordered. */
export type ClassValue = string | false | null | undefined | 0;
export const cx = (...inputs: ClassValue[]) => inputs.filter(Boolean).join(" ");
