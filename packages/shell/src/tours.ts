/** Host-authored steps target data-tour anchors; absent anchors are skipped. */
export interface TourStep {target: string; title: string; text: string}
export type ShellTours = Readonly<Record<string, readonly TourStep[]>>;
