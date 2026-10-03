/** Central clock so the seeder can replay history at past timestamps. */
let frozen: Date | null = null;
export const setClock = (d: Date | null) => { frozen = d; };
export const nowDate = () => (frozen ? new Date(frozen) : new Date());
export const now = () => nowDate().toISOString();
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
