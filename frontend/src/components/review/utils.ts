// ─── Formatting helpers ────────────────────────────────────────────────────────

export function fmtMoney(amount: number | null | undefined, showSign = false): string {
  if (amount === null || amount === undefined) return '—';
  const abs = Math.abs(amount);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (amount < 0) return showSign ? `-$${str}` : `($${str})`;
  if (showSign && amount > 0) return `$${str}`;
  return `$${str}`;
}

// ─── Account number helper ────────────────────────────────────────────────────

export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '••••••••';
  const digits = accountNumber.replace(/\D/g, '');
  return `••••${digits.slice(-4)}`;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

export function getConfidenceColor(confidence: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (confidence >= 90) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  if (confidence >= 70) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
}
