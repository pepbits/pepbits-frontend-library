export interface PrintPageRange {start: number; end: number; final: boolean}
/** Partition measured rows without splitting them. All sizes use the same physical unit.
 * Capacity excludes repeated header/footer. A final summary can occupy its own page.
 * Reject content that cannot fit instead of silently clipping a printed document.
 */
export function paginatePrintRows(heights: readonly number[], options: {capacity: number; broughtForward: number; carriedForward: number; finalHeight: number}): PrintPageRange[] {
  const {capacity, broughtForward, carriedForward, finalHeight} = options;
  if (![capacity, broughtForward, carriedForward, finalHeight, ...heights].every(value => Number.isFinite(value) && value >= 0) || capacity <= 0) throw new Error('Invalid print measurements');
  if (finalHeight > capacity) throw new Error('The summary is too tall for one page.');
  const pages: PrintPageRange[] = [];
  let start = 0;
  while (true) {
    const available = capacity - (pages.length ? broughtForward : 0);
    const remaining = heights.slice(start).reduce((sum, height) => sum + height, 0);
    if (remaining + finalHeight <= available) {pages.push({start, end: heights.length, final: true});break;}
    if (start === heights.length) throw new Error('The summary is too tall for one page.');
    let end = start, used = 0;
    while (end < heights.length && used + heights[end]! + carriedForward <= available) used += heights[end++]!;
    if (end === start) throw new Error('A row is too tall for one page.');
    pages.push({start, end, final: false});start = end;
  }
  return pages;
}
