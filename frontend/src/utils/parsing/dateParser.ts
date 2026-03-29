/** Month name array for parsing long-form dates (e.g., "November 15, 2025"). */
export const monthNames = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Normalize a date string to MM/DD/YYYY format. */
export function parseDate(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  const trimmed = raw.trim();
  const mdyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${year}`;
  }
  const longMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (longMatch) {
    const monthIdx = monthNames.indexOf(longMatch[1].toLowerCase());
    if (monthIdx >= 0) {
      return `${String(monthIdx + 1).padStart(2, '0')}/${longMatch[2].padStart(2, '0')}/${longMatch[3]}`;
    }
  }
  return trimmed;
}

/** "Looks like a date" — handles mm/dd, mm-dd, mm/dd/yyyy, yyyy-mm-dd, MMM DD, YYYY
 *  Rejects bare mm/dd (2-digit) without year to avoid matching account-summary cells. */
export function looksLikeDate(s: string): boolean {
  const t = s.trim();
  // mm/dd/yyyy or mm-dd-yyyy
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(t)) return true;
  // mm/dd or mm-dd (2-digit year — common in bank statement transactions)
  if (/^\d{1,2}[\/\-]\d{1,2}$/.test(t)) return true;
  // yyyy-mm-dd
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(t)) return true;
  // "November 15, 2025" style
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(t)) return true;
  return false;
}
