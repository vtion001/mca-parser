/**
 * Converters: transform backend data shapes into frontend TransactionRow format.
 * All functions are pure — no side effects, no React hooks.
 */

import type { TransactionRow } from '../../types/transactions';
import type { ExtractionResult } from '../../types/extraction';

// ─── Tag mapping ───────────────────────────────────────────────────────────────

/**
 * Backend uses snake_case: return, internal_transfer, wire, line_of_credit, lender, cash_app
 * Frontend uses display names that match autoTag() output.
 */
export function mapBackendTagToFrontend(tag: string): string {
  const mapping: Record<string, string> = {
    'return': 'return',
    'internal_transfer': 'transfer',
    'wire': 'wire',
    'line_of_credit': 'lender',
    'lender': 'lender',
    'cash_app': 'cash_app',
  };
  return mapping[tag] ?? tag;
}

// ─── Backend transaction → TransactionRow ─────────────────────────────────────

export function convertBackendTransaction(txn: {
  description: string;
  amount: number | null;
  date: string | null;
  classification: {
    tags: string[];
    is_classified: boolean;
    confidence: number;
    has_withdrawal: boolean;
    has_deposit: boolean;
  };
}): TransactionRow {
  const amount = txn.amount ?? 0;
  return {
    id: `backend_${txn.date}_${txn.description.slice(0, 20)}`,
    date: txn.date ?? '',
    payee: txn.description,
    credit: amount > 0 ? amount : null,
    debit: amount < 0 ? Math.abs(amount) : null,
    balance: null,
    memo: '',
    checkNumber: '',
    tags: txn.classification.tags.map(mapBackendTagToFrontend),
    isTrue: false,
    isReviewed: false,
  };
}

// ─── MCA transaction → TransactionRow ───────────────────────────────────────

export function convertMcaTransaction(txn: {
  description: string;
  amount: number | null;
  date: string | null;
  is_mca: boolean;
  mca_provider: string | null;
  confidence: number;
}): TransactionRow {
  const amount = txn.amount ?? 0;
  return {
    id: `mca_${txn.date}_${txn.description.slice(0, 20)}`,
    date: txn.date ?? '',
    payee: txn.mca_provider ? `${txn.mca_provider}: ${txn.description}` : txn.description,
    credit: amount > 0 ? amount : null,
    debit: amount < 0 ? Math.abs(amount) : null,
    balance: null,
    memo: '',
    checkNumber: '',
    tags: ['mca'],
    isTrue: false,
    isReviewed: false,
  };
}

// ─── MCA deduplication ────────────────────────────────────────────────────────

/**
 * Merge mca_findings transactions into classified transactions.
 * Skips any MCA transaction whose description already appears (case-insensitive)
 * in a transaction already tagged as MCA — avoids double-counting.
 */
export function mergeMcaTransactions(
  classifiedTxns: TransactionRow[],
  mcaFindings: ExtractionResult['mca_findings'],
): TransactionRow[] {
  if (!mcaFindings?.transactions?.length) return classifiedTxns;

  const mcaDescriptions = new Set(
    classifiedTxns
      .filter(t => t.tags.includes('mca'))
      .map(t => t.payee.toLowerCase())
  );

  const merged = [...classifiedTxns];
  for (const mcaTxn of mcaFindings.transactions) {
    if (!mcaDescriptions.has(mcaTxn.description.toLowerCase())) {
      merged.push(convertMcaTransaction(mcaTxn));
    }
  }
  return merged;
}
