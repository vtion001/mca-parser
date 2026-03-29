import { looksLikeDate } from './dateParser';
import { tryParseAmount } from './amountParser';

export type ParsedCheck = { date: string; amount: string; checkNumber: string };

/** Parse a checks-table row (6+ columns: Number, Date, Amount repeating). */
export function parseChecksRow(cells: string[]): ParsedCheck[] {
  const results: ParsedCheck[] = [];
  for (let i = 0; i + 2 < cells.length; i += 3) {
    const numCell = cells[i]?.trim() ?? '';
    const dateCell = cells[i + 1]?.trim() ?? '';
    const amtCell = cells[i + 2]?.trim() ?? '';
    if (!numCell || !dateCell || !amtCell) continue;
    if (/^number$/i.test(numCell)) continue;
    if (!/^\d+\s*\*?\s*i?\s*$/i.test(numCell)) continue;
    if (!looksLikeDate(dateCell)) continue;
    if (tryParseAmount(amtCell) === null) continue;
    results.push({ date: dateCell, amount: amtCell, checkNumber: numCell.replace(/\s+/g, ' ') });
  }
  return results;
}
