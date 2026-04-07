// Shared formatting utilities — single source of truth for all components

/**
 * Format a number (or numeric string) as USD currency.
 * - `showSign: true` shows `+$X.XX` for positive, `-$X.XX` for negative
 * - Negative numbers show as `-$X.XX` by default, or `($${abs})` if `showSign: false`
 */
export function fmtMoney(
  amount: number | string | null | undefined,
  showSign = false,
): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? parseFloat(amount.replace(/[$,]/g, '')) : amount;
  if (isNaN(n)) return '—';
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n < 0) return showSign ? `-$${str}` : `($${str})`;
  if (showSign && n > 0) return `+$${str}`;
  return `$${str}`;
}

/**
 * Mask an account number, showing only the last 4 digits.
 * Always 8+ chars total (•••• + last 4 digits).
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '••••••••';
  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length < 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
}
