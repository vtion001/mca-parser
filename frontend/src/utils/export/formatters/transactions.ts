// Transaction export formatters

import type { TransactionRow } from '../../../types/transactions';
import { escapeCsvField } from '../../csvCore';
import { findRepeatingTransactions } from '../../balanceAnalysis';

function isTransfer(tx: TransactionRow): boolean {
  return tx.tags.some(t => /transfer|wire|zelle|ach/i.test(t));
}

function isMca(tx: TransactionRow): boolean {
  return tx.tags.some(t => /mca/i.test(t));
}

function isLargeDeposit(tx: TransactionRow): boolean {
  return (tx.credit !== null && tx.credit > 500) || (tx.debit !== null && tx.debit > 500);
}

function getAmount(tx: TransactionRow): number {
  return tx.credit ?? tx.debit ?? 0;
}

function getType(tx: TransactionRow): string {
  if (tx.credit !== null && tx.credit > 0) return 'Credit';
  if (tx.debit !== null && tx.debit > 0) return 'Debit';
  return 'Unknown';
}

const TX_COLS = 'Account,Date,Description,Amount,Memo,Number,Type';

function txRow(account: string, tx: TransactionRow, amount: number, type: string): string {
  return [
    escapeCsvField(account), escapeCsvField(tx.date),
    escapeCsvField(tx.payee), escapeCsvField(amount),
    escapeCsvField(tx.memo), escapeCsvField(tx.checkNumber),
    escapeCsvField(type),
  ].join(',');
}

export function exportAllTransactions(txns: TransactionRow[], name: string): string {
  const rows = txns.map(tx => {
    const amount = tx.credit !== null && tx.credit > 0 ? tx.credit : (tx.debit ?? 0);
    return txRow(name, tx, amount, amount >= 0 ? 'Credit' : 'Debit');
  });
  return [`Statement,Date,Description,Amount,Memo,Number,Type`, ...rows].join('\n');
}

export function exportCreditTransactions(txns: TransactionRow[], account: string): string {
  const credits = txns.filter(t => t.credit !== null && t.credit > 0);
  const rows = credits.map(tx => txRow(account, tx, tx.credit!, 'Credit'));
  return [TX_COLS, ...rows].join('\n');
}

export function exportIncomingTransfers(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(t => (t.credit !== null && t.credit > 0) && isTransfer(t))
    .map(tx => txRow(account, tx, tx.credit!, 'Credit'));
  return [TX_COLS, ...rows].join('\n');
}

export function exportOutgoingTransfers(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(t => (t.debit !== null && t.debit > 0) && isTransfer(t))
    .map(tx => txRow(account, tx, tx.debit!, 'Debit'));
  return [TX_COLS, ...rows].join('\n');
}

export function exportLargeTransactions(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(isLargeDeposit)
    .map(tx => txRow(account, tx, getAmount(tx), getType(tx)));
  return [TX_COLS, ...rows].join('\n');
}

export function exportMcaTransactions(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(isMca)
    .map(tx => txRow(account, tx, getAmount(tx), getType(tx)));
  return [TX_COLS, ...rows].join('\n');
}

export function exportNonTrueCreditTransactions(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(t => (t.credit !== null && t.credit > 0) && isTransfer(t))
    .map(tx => txRow(account, tx, tx.credit!, 'Credit'));
  return [TX_COLS, ...rows].join('\n');
}

export function exportNsfTransactions(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(t => t.tags.some(tag => /nsf/i.test(tag)))
    .map(tx => txRow(account, tx, getAmount(tx), getType(tx)));
  return [TX_COLS, ...rows].join('\n');
}

export function exportOverdraftTransactions(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(t => t.tags.some(tag => /overdraft/i.test(tag)))
    .map(tx => txRow(account, tx, getAmount(tx), getType(tx)));
  return [TX_COLS, ...rows].join('\n');
}

export function exportRepeatingTransactions(txns: TransactionRow[], account: string): string {
  const rows = findRepeatingTransactions(txns)
    .map(tx => txRow(account, tx, getAmount(tx), getType(tx)));
  return [TX_COLS, ...rows].join('\n');
}

export function exportReturnedTransactions(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(t => t.tags.some(tag => /returned/i.test(tag)))
    .map(tx => txRow(account, tx, getAmount(tx), getType(tx)));
  return [TX_COLS, ...rows].join('\n');
}

export function exportTrueCreditTransactions(txns: TransactionRow[], account: string): string {
  const rows = txns
    .filter(t => (t.credit !== null && t.credit > 0) && !isTransfer(t))
    .map(tx => txRow(account, tx, tx.credit!, 'Credit'));
  return [TX_COLS, ...rows].join('\n');
}
