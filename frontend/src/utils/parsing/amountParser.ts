/** Convert a raw amount string to a number. Returns null for invalid input. */
export function parseAmount(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[$,()]/g, '').trim();
  const isNegative = cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
  const numStr = cleaned.replace(/[()]/g, '').replace(/^-/, '');
  const n = parseFloat(numStr);
  if (isNaN(n)) return null;
  return isNegative ? -n : n;
}

/** Try to parse a string as a dollar amount. Returns null if it doesn't look like an amount. */
export function tryParseAmount(s: string): number | null {
  const t = s.trim();
  if (!/^\$?[\d,.\-()]+$/.test(t)) return null;
  const cleaned = t.replace(/[$,()]/g, '').trim();
  const isNeg = t.startsWith('(') || t.startsWith('-');
  const numStr = cleaned.replace(/[()]/g, '').replace(/^-/, '');
  const n = parseFloat(numStr);
  if (isNaN(n)) return null;
  return isNeg ? -n : n;
}
