import type { KeyDetail, ExtractionResult } from '../../types/extraction';
import type { StatementRow } from './types';

// ─── Formatting helpers ────────────────────────────────────────────────────

export function maskAccountNumber(num: string): string {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
}

export function fmtMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? parseFloat(amount.replace(/[$,]/g, '')) : amount;
  if (isNaN(n)) return '—';
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n < 0) return `-$${str}`;
  return `$${str}`;
}

export function fmtCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}

export function getFieldValue(details: KeyDetail[], field: string): string {
  return details.find(d => d.field === field)?.value ?? '';
}

export function getFieldAmount(details: KeyDetail[], field: string): number | null {
  const raw = details.find(d => d.field === field)?.value ?? '';
  const cleaned = raw.replace(/[$,()]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function getBalanceAmount(
  balances: ExtractionResult['balances'],
  key: 'beginning_balance' | 'ending_balance'
): number | null {
  return balances?.[key]?.amount ?? null;
}

// ─── Row validation & building ─────────────────────────────────────────────

export function isValidRow(doc: any): boolean {
  const details = doc.key_details ?? [];
  const analysis = doc.ai_analysis?.analysis ?? null;
  const txn = analysis?.transaction_summary;

  const begBal =
    doc.balances?.beginning_balance?.amount ??
    details.find((d: any) => d.field === 'beginning_balance')?.value ?? null;
  const credits = txn?.total_amount_credits ?? null;
  const debits = txn?.total_amount_debits ?? null;

  // Reject rows with zero or obviously bogus totals (AI hallucination guards)
  if (credits !== null && credits <= 0 && debits !== null && debits <= 0) return false;
  // Reject rows where AI returned absurdly large numbers (likely hallucination)
  // Normal business bank accounts rarely exceed $10M in a month
  if (credits !== null && credits > 10_000_000) return false;
  if (debits !== null && debits > 10_000_000) return false;
  // Reject if credits are 100x larger than debits (suspicious AI hallucination)
  if (credits !== null && debits !== null && credits > 0 && debits > 0 && credits / debits > 50) return false;
  // Reject rows missing both beginning and ending balance
  const endBal = doc.balances?.ending_balance?.amount ?? details.find((d: any) => d.field === 'ending_balance')?.value ?? null;
  if (begBal === null && endBal === null) return false;

  return true;
}

export function buildRow(doc: any): StatementRow | null {
  if (!isValidRow(doc)) return null;

  const details = doc.key_details ?? [];
  const analysis = doc.ai_analysis?.analysis ?? null;
  const txn = analysis?.transaction_summary;

  const begBal =
    getBalanceAmount(doc.balances, 'beginning_balance') ??
    getFieldAmount(details, 'beginning_balance');
  const endBal =
    getBalanceAmount(doc.balances, 'ending_balance') ??
    getFieldAmount(details, 'ending_balance');

  const credits = txn?.total_amount_credits ?? null;
  const debits = txn?.total_amount_debits ?? null;
  const calcBal =
    begBal !== null && credits !== null && debits !== null
      ? begBal + credits - debits
      : null;
  const diff =
    calcBal !== null && endBal !== null ? endBal - calcBal : null;

  const nsfItems = analysis?.risk_indicators?.has_returned_items ? 1 : 0;
  const accountNum = getFieldValue(details, 'account_number');
  const accountType = getFieldValue(details, 'account_type') || 'Bank Account';

  let period = getFieldValue(details, 'statement_period');
  if (!period || period.length > 50) {
    const begDate = getFieldValue(details, 'date') || '';
    period = (begDate && begDate.length < 50) ? begDate : 'Statement';
  }

  const confidence = doc.scores?.overall ?? doc.document_type?.confidence ?? 0.85;

  return {
    id: doc.id,
    accountNumber: accountNum,
    accountType,
    period,
    beginningBalance: begBal,
    endingBalance: endBal,
    totalCredits: credits,
    creditCount: txn?.credit_count ?? null,
    totalDebits: debits,
    debitCount: txn?.debit_count ?? null,
    calculatedBalance: calcBal,
    difference: diff,
    nsfCount: nsfItems,
    confidence,
    originalFilename: doc.original_filename ?? 'Unknown',
    createdAt: doc.created_at ?? '',
    result: {
      markdown: doc.markdown ?? '',
      document_type: doc.document_type ?? { type: 'bank_statement', confidence: 0.85 },
      key_details: doc.key_details ?? [],
      scores: doc.scores ?? { completeness: 0, quality: 0, pii_detection: 0, overall: 0.85 },
      pii_breakdown: doc.pii_breakdown ?? undefined,
      recommendations: doc.recommendations ?? [],
      balances: doc.balances ?? undefined,
      ai_analysis: doc.ai_analysis ?? { success: false, analysis: null },
      page_count: doc.page_count ?? 0,
    },
  };
}
