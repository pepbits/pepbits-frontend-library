const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
/** Explicit English spelling, not a localized formatter. Hosts must label the language. */
export function englishNumberWords(value: number): string {
  if (!Number.isSafeInteger(value)) throw new RangeError('A safe integer is required');
  if (value < 0) return 'Minus ' + englishNumberWords(-value);
  if (value < 20) return ONES[value]!;
  if (value < 100) return TENS[Math.floor(value / 10)] + (value % 10 ? ' ' + ONES[value % 10] : '');
  for (const [scale, name] of [[1e15, 'Quadrillion'], [1e12, 'Trillion'], [1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand'], [100, 'Hundred']] as const) {
    if (value >= scale) return englishNumberWords(Math.floor(value / scale)) + ' ' + name + (value % scale ? ' ' + englishNumberWords(value % scale) : '');
  }
  return '';
}

/** Explicit English spelling in the Indian numbering system (crore, lakh, thousand, hundred), as used
 * on Indian receipts. Like englishNumberWords, it is not a localized formatter; hosts label the language. */
export function indianNumberWords(value: number): string {
  if (!Number.isSafeInteger(value)) throw new RangeError('A safe integer is required');
  if (value < 0) return 'Minus ' + indianNumberWords(-value);
  if (value < 1000) return englishNumberWords(value);
  for (const [scale, name] of [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']] as const) {
    if (value >= scale) return indianNumberWords(Math.floor(value / scale)) + ' ' + name + (value % scale ? ' ' + indianNumberWords(value % scale) : '');
  }
  return '';
}
