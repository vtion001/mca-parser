// CSV Export utility functions for MoneyThumb-style exports

import type { TransactionRow } from '../types/transactions';

// ─── CSV Formatting Helpers ────────────────────────────────────────────────────

/**
 * Escape a CSV field value - wrap in quotes if contains comma, quote, or newline
 * Also escape existing quotes by doubling them
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV string
 */
export function toCsv<T extends Record<string, string | number | null | undefined>>(
  data: T[],
  columns: (keyof T)[]
): string {
  const header = columns.map(col => escapeCsvField(String(col))).join(',');
  const rows = data.map(row =>
    columns.map(col => escapeCsvField(row[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Download a CSV string as a file
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Transaction Classification Helpers ──────────────────────────────────────

/**
 * Check if a transaction is a transfer (based on tags or description patterns)
 */
function isTransfer(tx: TransactionRow): boolean {
  return tx.tags.some(tag =>
    tag.toLowerCase().includes('transfer') ||
    tag.toLowerCase().includes('wire') ||
    tag.toLowerCase().includes('zelle') ||
    tag.toLowerCase().includes('ach')
  );
}

/**
 * Check if a transaction is an MCA transaction
 */
function isMca(tx: TransactionRow): boolean {
  return tx.tags.some(tag => tag.toLowerCase().includes('mca'));
}

/**
 * Check if a transaction is a large deposit (typically > $500)
 */
function isLargeDeposit(tx: TransactionRow): boolean {
  return (tx.credit !== null && tx.credit > 500) ||
         (tx.debit !== null && tx.debit > 500);
}

/**
 * Get the amount (credit or debit as positive number)
 */
function getAmount(tx: TransactionRow): number {
  return tx.credit ?? tx.debit ?? 0;
}

/**
 * Get the transaction type (credit or debit)
 */
function getType(tx: TransactionRow): string {
  if (tx.credit !== null && tx.credit > 0) return 'Credit';
  if (tx.debit !== null && tx.debit > 0) return 'Debit';
  return 'Unknown';
}

// ─── Balance Calculation Helpers ───────────────────────────────────────────────

/**
 * Build daily balances from transactions
 */
export function buildDailyBalances(
  transactions: TransactionRow[],
  begBal: number | null
): { date: string; balance: number }[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const balances: { date: string; balance: number }[] = [];
  let running = begBal ?? 0;
  for (const t of sorted) {
    running += (t.credit ?? 0) - (t.debit ?? 0);
    balances.push({ date: t.date, balance: running });
  }
  return balances;
}

/**
 * Build daily true balances (excluding internal transfers)
 */
export function buildTrueBalances(
  transactions: TransactionRow[],
  begBal: number | null
): { date: string; balance: number }[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const balances: { date: string; balance: number }[] = [];
  let running = begBal ?? 0;
  for (const t of sorted) {
    // Only include non-transfer amounts in true balance
    if (!isTransfer(t)) {
      running += (t.credit ?? 0) - (t.debit ?? 0);
    }
    balances.push({ date: t.date, balance: running });
  }
  return balances;
}

/**
 * Calculate daily cash flows
 */
export function calculateDailyCashFlows(
  dailyBalances: { date: string; balance: number }[],
  trueBalances: { date: string; balance: number }[]
): { date: string; cashFlow: number; trueCashFlow: number }[] {
  if (dailyBalances.length === 0) return [];

  const cashFlows: { date: string; cashFlow: number; trueCashFlow: number }[] = [];
  for (let i = 0; i < dailyBalances.length; i++) {
    const current = dailyBalances[i];
    const prev = i > 0 ? dailyBalances[i - 1] : null;
    const cashFlow = prev ? current.balance - prev.balance : current.balance;
    const truePrev = i > 0 ? trueBalances[i - 1] : null;
    const trueCashFlow = truePrev ? trueBalances[i].balance - truePrev.balance : trueBalances[i].balance;
    cashFlows.push({
      date: current.date,
      cashFlow,
      trueCashFlow,
    });
  }
  return cashFlows;
}

/**
 * Calculate monthly cash flows
 */
export function calculateMonthlyCashFlows(
  dailyCashFlows: { date: string; cashFlow: number; trueCashFlow: number }[]
): { month: string; cashFlow: number; trueCashFlow: number }[] {
  const map = new Map<string, { cashFlow: number; trueCashFlow: number }>();
  for (const dc of dailyCashFlows) {
    const month = dc.date.slice(0, 7);
    const entry = map.get(month) ?? { cashFlow: 0, trueCashFlow: 0 };
    entry.cashFlow += dc.cashFlow;
    entry.trueCashFlow += dc.trueCashFlow;
    map.set(month, entry);
  }
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, cashFlow: v.cashFlow, trueCashFlow: v.trueCashFlow }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Detect repeating transactions (same amount on regular intervals)
 */
export function findRepeatingTransactions(
  transactions: TransactionRow[]
): TransactionRow[] {
  const repeating: TransactionRow[] = [];
  const amountMap = new Map<number, TransactionRow[]>();

  // Group transactions by absolute amount
  for (const tx of transactions) {
    const amount = getAmount(tx);
    if (amount > 0) {
      const existing = amountMap.get(amount) ?? [];
      existing.push(tx);
      amountMap.set(amount, existing);
    }
  }

  // Find amounts that appear on regular intervals (within 5 days tolerance)
  for (const [, txs] of amountMap) {
    if (txs.length < 2) continue;

    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    let isRepeating = true;

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].date);
      const currDate = new Date(sorted[i].date);
      const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      // If not a regular interval (allow weekly/biweekly/monthly patterns)
      if (diffDays > 35 || diffDays < 3) {
        isRepeating = false;
        break;
      }
    }

    if (isRepeating) {
      repeating.push(...sorted);
    }
  }

  return repeating;
}

/**
 * Calculate work days in a month (simplified - weekdays only)
 */
export function getWorkDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workDays++;
    }
  }
  return workDays;
}

// ─── Export Functions ──────────────────────────────────────────────────────────

/**
 * Export all transactions
 */
export function exportAllTransactions(
  transactions: TransactionRow[],
  statementName: string
): string {
  const header = 'Statement,Date,Description,Amount,Memo,Number,Type';

  const rows = transactions.map(tx => {
    const amount = tx.credit !== null && tx.credit > 0 ? tx.credit : (tx.debit ?? 0);
    const type = tx.credit !== null && tx.credit > 0 ? 'Credit' : 'Debit';
    return [
      escapeCsvField(statementName),
      escapeCsvField(tx.date),
      escapeCsvField(tx.payee),
      escapeCsvField(amount),
      escapeCsvField(tx.memo),
      escapeCsvField(tx.checkNumber),
      escapeCsvField(type),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Export credit transactions
 */
export function exportCreditTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const credits = transactions.filter(t => t.credit !== null && t.credit > 0);
  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = credits.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(tx.credit),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField('Credit'),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export daily balances
 */
export function exportDailyBalances(
  dailyBalances: { date: string; balance: number }[],
  trueBalances: { date: string; balance: number }[],
  accountName: string
): string {
  const header = `Date,[${accountName}] Balance,[${accountName}] True Balance`;

  const rows = dailyBalances.map((db, i) => [
    escapeCsvField(db.date),
    escapeCsvField(db.balance),
    escapeCsvField(trueBalances[i]?.balance ?? db.balance),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export daily cash flows
 */
export function exportDailyCashFlows(
  dailyCashFlows: { date: string; cashFlow: number; trueCashFlow: number }[],
  accountName: string
): string {
  const header = `Date,[${accountName}] Cash Flow,[${accountName}] True Cash Flow`;

  const rows = dailyCashFlows.map(dc => [
    escapeCsvField(dc.date),
    escapeCsvField(dc.cashFlow),
    escapeCsvField(dc.trueCashFlow),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export incoming transfers (positive amounts that are transfers)
 */
export function exportIncomingTransfers(
  transactions: TransactionRow[],
  accountName: string
): string {
  const incoming = transactions.filter(t =>
    (t.credit !== null && t.credit > 0) && isTransfer(t)
  );

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = incoming.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(tx.credit),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField('Credit'),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export outgoing transfers (negative amounts that are transfers)
 */
export function exportOutgoingTransfers(
  transactions: TransactionRow[],
  accountName: string
): string {
  const outgoing = transactions.filter(t =>
    (t.debit !== null && t.debit > 0) && isTransfer(t)
  );

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = outgoing.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(tx.debit),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField('Debit'),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export large transactions (typically > $500)
 */
export function exportLargeTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const large = transactions.filter(t => isLargeDeposit(t));

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = large.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(getAmount(tx)),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField(getType(tx)),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export MCA transactions
 */
export function exportMcaTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const mca = transactions.filter(t => isMca(t));

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = mca.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(getAmount(tx)),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField(getType(tx)),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export monthly cash flows
 */
export function exportMonthlyCashFlows(
  monthlyCashFlows: { month: string; cashFlow: number; trueCashFlow: number }[],
  accountName: string
): string {
  const header = `Month,[${accountName}] Cash Flow,[${accountName}] True Cash Flow`;

  const rows = monthlyCashFlows.map(mc => [
    escapeCsvField(mc.month),
    escapeCsvField(mc.cashFlow),
    escapeCsvField(mc.trueCashFlow),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export monthly MCA summary
 */
export function exportMonthlyMca(
  transactions: TransactionRow[],
  accountName: string,
  mcaPaymentsByMonth: { month: string; payments: number; count: number }[]
): string {
  const header = 'Month,Work Days,Account,Lender,Withdrawal Count,Withdrawal Total,Deposit Total,Deposit Dates,Latest Withdrawal Amount';

  const rows = mcaPaymentsByMonth.map(mpm => {
    const [year, month] = mpm.month.split('-').map(Number);
    const workDays = getWorkDaysInMonth(year, month - 1);

    // Get MCA deposits for this month
    const mcaTxns = transactions.filter(t =>
      isMca(t) &&
      t.date.startsWith(mpm.month) &&
      t.credit !== null && t.credit > 0
    );
    const depositTotal = mcaTxns.reduce((sum, t) => sum + (t.credit ?? 0), 0);
    const depositDates = mcaTxns.map(t => t.date).join('; ');

    // Get MCA withdrawals for this month
    const mcaWithdrawals = transactions.filter(t =>
      isMca(t) &&
      t.date.startsWith(mpm.month) &&
      t.debit !== null && t.debit > 0
    );
    const latestWithdrawalAmount = mcaWithdrawals.length > 0
      ? mcaWithdrawals[mcaWithdrawals.length - 1].debit ?? 0
      : 0;

    return [
      escapeCsvField(mpm.month),
      escapeCsvField(workDays),
      escapeCsvField(accountName),
      escapeCsvField('MCA Provider'),
      escapeCsvField(mpm.count),
      escapeCsvField(mpm.payments),
      escapeCsvField(depositTotal),
      escapeCsvField(depositDates),
      escapeCsvField(latestWithdrawalAmount),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Export monthly negative days
 */
export function exportMonthlyNegativeDays(
  dailyBalances: { date: string; balance: number }[],
  accountName: string
): string {
  const header = 'Month,Work Days,Account,Lender,With. Count,With. Total,Avg Daily Bal,Low Bal,Neg Bal Days';

  // Group by month
  const byMonth = new Map<string, { balances: number[]; withdrawals: number; count: number }>();
  for (const db of dailyBalances) {
    const month = db.date.slice(0, 7);
    const entry = byMonth.get(month) ?? { balances: [], withdrawals: 0, count: 0 };
    entry.balances.push(db.balance);
    if (db.balance < 0) {
      entry.count++;
    }
    byMonth.set(month, entry);
  }

  const rows: string[] = [];
  for (const [month, data] of byMonth) {
    const [year, m] = month.split('-').map(Number);
    const workDays = getWorkDaysInMonth(year, m - 1);
    const avgDailyBal = data.balances.reduce((a, b) => a + b, 0) / data.balances.length;
    const lowBal = Math.min(...data.balances);

    rows.push([
      escapeCsvField(month),
      escapeCsvField(workDays),
      escapeCsvField(accountName),
      escapeCsvField('N/A'),
      escapeCsvField(0),
      escapeCsvField(0),
      escapeCsvField(avgDailyBal),
      escapeCsvField(lowBal),
      escapeCsvField(data.count),
    ].join(','));
  }

  return [header, ...rows].join('\n');
}

/**
 * Export non-true credit transactions (credits that are NOT true deposits)
 */
export function exportNonTrueCreditTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const nonTrueCredits = transactions.filter(t =>
    (t.credit !== null && t.credit > 0) && isTransfer(t)
  );

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = nonTrueCredits.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(tx.credit),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField('Credit'),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export NSF transactions
 */
export function exportNsfTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const nsf = transactions.filter(t =>
    t.tags.some(tag => tag.toLowerCase().includes('nsf'))
  );

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = nsf.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(getAmount(tx)),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField(getType(tx)),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export overdraft transactions
 */
export function exportOverdraftTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const overdraft = transactions.filter(t =>
    t.tags.some(tag => tag.toLowerCase().includes('overdraft'))
  );

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = overdraft.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(getAmount(tx)),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField(getType(tx)),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export repeating transactions
 */
export function exportRepeatingTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const repeating = findRepeatingTransactions(transactions);

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = repeating.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(getAmount(tx)),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField(getType(tx)),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export returned transactions
 */
export function exportReturnedTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const returned = transactions.filter(t =>
    t.tags.some(tag => tag.toLowerCase().includes('returned'))
  );

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = returned.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(getAmount(tx)),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField(getType(tx)),
  ].join(','));

  return [header, ...rows].join('\n');
}

/**
 * Export revenue statistics
 */
export function exportRevenueStatistics(
  revenueStats: {
    totalCredits: number;
    totalDebits: number;
    grossProfit: number;
    monthlyAvg: number;
  }
): string {
  const header = 'Label,Monthly,Annual';

  const rows = [
    ['Revenue', revenueStats.totalCredits, revenueStats.totalCredits * 12],
    ['True Revenue', revenueStats.totalCredits * 0.9, revenueStats.totalCredits * 12 * 0.9],
    ['Expenses', revenueStats.totalDebits, revenueStats.totalDebits * 12],
    ['Profit', revenueStats.grossProfit, revenueStats.grossProfit * 12],
    ['Balance/Days Negative', 0, 0],
  ].map(([label, monthly, annual]) =>
    [escapeCsvField(label), escapeCsvField(monthly), escapeCsvField(annual)].join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Export statements summary
 */
export function exportStatementsSummary(
  transactions: TransactionRow[],
  begBal: number | null,
  endBal: number | null,
  accountName: string,
  bankName: string,
  statementPeriod: string
): string {
  const header = 'Account,Bank Name,Statement Month,Starting Balance,Total Credits,# Credits,True Credits,# True Credits,Total Debits,# Debits,Ending Balance,Avg Balance,Avg True Balance,Days Neg,# OD\'s,# NSF\'s,Low Days,MCA Withhold Percent';

  const credits = transactions.filter(t => t.credit !== null && t.credit > 0);
  const trueCredits = credits.filter(t => !isTransfer(t));
  const debits = transactions.filter(t => t.debit !== null && t.debit > 0);
  const overdrafts = transactions.filter(t => t.tags.some(tag => tag.toLowerCase().includes('overdraft')));
  const nsfs = transactions.filter(t => t.tags.some(tag => tag.toLowerCase().includes('nsf')));

  const totalCredits = credits.reduce((sum, t) => sum + (t.credit ?? 0), 0);
  const trueCreditsTotal = trueCredits.reduce((sum, t) => sum + (t.credit ?? 0), 0);
  const totalDebits = debits.reduce((sum, t) => sum + (t.debit ?? 0), 0);

  const avgBalance = begBal !== null && endBal !== null
    ? (begBal + endBal) / 2
    : (begBal ?? endBal ?? 0);
  const avgTrueBalance = trueCreditsTotal > 0 ? avgBalance * 0.9 : avgBalance;

  // Count days with negative balance
  let running = begBal ?? 0;
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let negDays = 0;
  let lowDays = 0;
  let minBalance = running;

  for (const t of sorted) {
    running += (t.credit ?? 0) - (t.debit ?? 0);
    if (running < 0) negDays++;
    if (running < minBalance) {
      minBalance = running;
      lowDays = 1;
    }
  }

  const row = [
    escapeCsvField(accountName),
    escapeCsvField(bankName),
    escapeCsvField(statementPeriod),
    escapeCsvField(begBal ?? 0),
    escapeCsvField(totalCredits),
    escapeCsvField(credits.length),
    escapeCsvField(trueCreditsTotal),
    escapeCsvField(trueCredits.length),
    escapeCsvField(totalDebits),
    escapeCsvField(debits.length),
    escapeCsvField(endBal ?? 0),
    escapeCsvField(avgBalance),
    escapeCsvField(avgTrueBalance),
    escapeCsvField(negDays),
    escapeCsvField(overdrafts.length),
    escapeCsvField(nsfs.length),
    escapeCsvField(lowDays),
    escapeCsvField(0),
  ].join(',');

  return [header, row].join('\n');
}

/**
 * Export true credit transactions (credits that are NOT transfers)
 */
export function exportTrueCreditTransactions(
  transactions: TransactionRow[],
  accountName: string
): string {
  const trueCredits = transactions.filter(t =>
    (t.credit !== null && t.credit > 0) && !isTransfer(t)
  );

  const header = 'Account,Date,Description,Amount,Memo,Number,Type';

  const rows = trueCredits.map(tx => [
    escapeCsvField(accountName),
    escapeCsvField(tx.date),
    escapeCsvField(tx.payee),
    escapeCsvField(tx.credit),
    escapeCsvField(tx.memo),
    escapeCsvField(tx.checkNumber),
    escapeCsvField('Credit'),
  ].join(','));

  return [header, ...rows].join('\n');
}

// ─── Main Export Dispatcher ───────────────────────────────────────────────────

export type ExportType =
  | 'all_transactions'
  | 'credit_transactions'
  | 'daily_balances'
  | 'daily_cash_flows'
  | 'incoming_transfers'
  | 'outgoing_transfers'
  | 'large_transactions'
  | 'mca_transactions'
  | 'monthly_cash_flows'
  | 'monthly_mca'
  | 'monthly_negative_days'
  | 'non_true_credit_transactions'
  | 'nsf_transactions'
  | 'overdraft_transactions'
  | 'repeating_transactions'
  | 'returned_transactions'
  | 'revenue_statistics'
  | 'statements_summary'
  | 'true_credit_transactions';

export interface ExportConfig {
  transactions: TransactionRow[];
  dailyBalances: { date: string; balance: number }[];
  trueBalances: { date: string; balance: number }[];
  begBal: number | null;
  endBal: number | null;
  accountName: string;
  bankName: string;
  statementPeriod: string;
  mcaPaymentsByMonth: { month: string; payments: number; count: number }[];
  revenueStats: {
    totalCredits: number;
    totalDebits: number;
    grossProfit: number;
    monthlyAvg: number;
  };
}

export function exportData(type: ExportType, config: ExportConfig): string {
  const { transactions, dailyBalances, trueBalances, begBal, endBal, accountName, bankName, statementPeriod, mcaPaymentsByMonth, revenueStats } = config;

  switch (type) {
    case 'all_transactions':
      return exportAllTransactions(transactions, statementPeriod || accountName);
    case 'credit_transactions':
      return exportCreditTransactions(transactions, accountName);
    case 'daily_balances':
      return exportDailyBalances(dailyBalances, trueBalances, accountName);
    case 'daily_cash_flows':
      return exportDailyCashFlows(
        calculateDailyCashFlows(dailyBalances, trueBalances),
        accountName
      );
    case 'incoming_transfers':
      return exportIncomingTransfers(transactions, accountName);
    case 'outgoing_transfers':
      return exportOutgoingTransfers(transactions, accountName);
    case 'large_transactions':
      return exportLargeTransactions(transactions, accountName);
    case 'mca_transactions':
      return exportMcaTransactions(transactions, accountName);
    case 'monthly_cash_flows':
      return exportMonthlyCashFlows(
        calculateMonthlyCashFlows(
          calculateDailyCashFlows(dailyBalances, trueBalances)
        ),
        accountName
      );
    case 'monthly_mca':
      return exportMonthlyMca(transactions, accountName, mcaPaymentsByMonth);
    case 'monthly_negative_days':
      return exportMonthlyNegativeDays(dailyBalances, accountName);
    case 'non_true_credit_transactions':
      return exportNonTrueCreditTransactions(transactions, accountName);
    case 'nsf_transactions':
      return exportNsfTransactions(transactions, accountName);
    case 'overdraft_transactions':
      return exportOverdraftTransactions(transactions, accountName);
    case 'repeating_transactions':
      return exportRepeatingTransactions(transactions, accountName);
    case 'returned_transactions':
      return exportReturnedTransactions(transactions, accountName);
    case 'revenue_statistics':
      return exportRevenueStatistics(revenueStats);
    case 'statements_summary':
      return exportStatementsSummary(transactions, begBal, endBal, accountName, bankName, statementPeriod);
    case 'true_credit_transactions':
      return exportTrueCreditTransactions(transactions, accountName);
    default:
      throw new Error(`Unknown export type: ${type}`);
  }
}
