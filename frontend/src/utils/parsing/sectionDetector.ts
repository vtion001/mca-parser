export type SectionType = 'unknown' | 'withdrawals' | 'deposits' | 'checks';

/** Is this a GFM table separator row?  e.g.  |---|---|---| */
export function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every(cell => /^-{3,}$/.test(cell) || /^:-+$/.test(cell) || /:-?:/.test(cell));
}

/** Determine section type by scanning ALL cells for section keywords.
 *  Docling puts section names in the first cell of multi-column rows. */
export function detectSectionType(cells: string[]): SectionType {
  if (cells.length < 1) return 'unknown';
  const allText = cells.map(c => c.toLowerCase()).join(' ');
  if (/checks?\s+totaling/i.test(allText)) return 'checks';
  if (/^checks?\s*$/i.test(cells[0] ?? '')) return 'checks';
  if (/withdrawals?\s*\/?\s*debits?/i.test(allText)) return 'withdrawals';
  if (/deposits?\s*\/?\s*credits?/i.test(allText)) return 'deposits';
  if (/electronic\s*(credits?|debits?)/i.test(allText)) {
    if (/credit/.test(allText)) return 'deposits';
    if (/debit|withdrawal/.test(allText)) return 'withdrawals';
  }
  return 'unknown';
}

/** Is this a column header row? (first cell is "date", "description", etc.) */
export function isColumnHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const first = cells[0].toLowerCase().trim();
  const headerWords = ['date', 'description', 'amount', 'memo', 'balance', 'payee', 'transaction', 'number', 'type'];
  if (headerWords.some(w => first === w)) return true;
  // If ALL cells look like short lowercase header labels, skip
  if (cells.every(c => /^[a-z]{2,12}$/.test(c.trim()))) return true;
  return false;
}

/** Is this a section summary/totals row? e.g. "38 checks totaling $122,356.96" */
export function isSectionSummaryRow(cells: string[]): boolean {
  if (cells.length < 1) return false;
  const first = cells[0].toLowerCase();
  const allText = cells.map(c => c.toLowerCase()).join(' ');
  if (/^\d+\s+checks?\s+totaling/i.test(first)) return true;
  if (/\d+\s+items?\s+totaling/i.test(allText)) return true;
  return false;
}
