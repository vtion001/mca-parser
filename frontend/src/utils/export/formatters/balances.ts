// Balance and cash flow export formatters

import type { TransactionRow } from '../../../types/transactions';
import { escapeCsvField } from '../../csvCore';
import {
  calculateDailyCashFlows,
  calculateMonthlyCashFlows,
  getWorkDaysInMonth,
} from '../../balanceAnalysis';

export function exportDailyBalances(
  dailyBalances: { date: string; balance: number }[],
  trueBalances: { date: string; balance: number }[],
  account: string
): string {
  const header = `Date,[${account}] Balance,[${account}] True Balance`;
  const rows = dailyBalances.map((db, i) => [
    escapeCsvField(db.date),
    escapeCsvField(db.balance),
    escapeCsvField(trueBalances[i]?.balance ?? db.balance),
  ].join(','));
  return [header, ...rows].join('\n');
}

export function exportDailyCashFlows(
  dailyBalances: { date: string; balance: number }[],
  trueBalances: { date: string; balance: number }[],
  account: string
): string {
  const cashFlows = calculateDailyCashFlows(dailyBalances, trueBalances);
  const header = `Date,[${account}] Cash Flow,[${account}] True Cash Flow`;
  const rows = cashFlows.map(dc => [
    escapeCsvField(dc.date),
    escapeCsvField(dc.cashFlow),
    escapeCsvField(dc.trueCashFlow),
  ].join(','));
  return [header, ...rows].join('\n');
}

export function exportMonthlyCashFlows(
  dailyBalances: { date: string; balance: number }[],
  trueBalances: { date: string; balance: number }[],
  account: string
): string {
  const dailyFlows = calculateDailyCashFlows(dailyBalances, trueBalances);
  const monthly = calculateMonthlyCashFlows(dailyFlows);
  const header = `Month,[${account}] Cash Flow,[${account}] True Cash Flow`;
  const rows = monthly.map(mc => [
    escapeCsvField(mc.month),
    escapeCsvField(mc.cashFlow),
    escapeCsvField(mc.trueCashFlow),
  ].join(','));
  return [header, ...rows].join('\n');
}

export function exportMonthlyMca(
  transactions: TransactionRow[],
  account: string,
  mcaPaymentsByMonth: { month: string; payments: number; count: number; lender: string }[]
): string {
  const header = 'Month,Work Days,Account,Lender,Withdrawal Count,Withdrawal Total,Deposit Total,Deposit Dates,Latest Withdrawal Amount';
  const rows = mcaPaymentsByMonth.map(mpm => {
    const [year, month] = mpm.month.split('-').map(Number);
    const workDays = getWorkDaysInMonth(year, month - 1);

    const mcaTxns = transactions.filter(t =>
      /mca/i.test(t.tags.join(' ')) &&
      t.date.startsWith(mpm.month) &&
      t.credit !== null && t.credit > 0
    );
    const depositTotal = mcaTxns.reduce((sum, t) => sum + (t.credit ?? 0), 0);
    const depositDates = mcaTxns.map(t => t.date).join('; ');

    const mcaWithdrawals = transactions.filter(t =>
      /mca/i.test(t.tags.join(' ')) &&
      t.date.startsWith(mpm.month) &&
      t.debit !== null && t.debit > 0
    );
    const latestWithdrawalAmount = mcaWithdrawals.length > 0
      ? mcaWithdrawals[mcaWithdrawals.length - 1].debit ?? 0
      : 0;

    return [
      escapeCsvField(mpm.month), escapeCsvField(workDays),
      escapeCsvField(account), escapeCsvField(mpm.lender),
      escapeCsvField(mpm.count), escapeCsvField(mpm.payments),
      escapeCsvField(depositTotal), escapeCsvField(depositDates),
      escapeCsvField(latestWithdrawalAmount),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export function exportMonthlyNegativeDays(
  dailyBalances: { date: string; balance: number }[],
  account: string
): string {
  const header = 'Month,Work Days,Account,Lender,With. Count,With. Total,Avg Daily Bal,Low Bal,Neg Bal Days';

  // Sort daily balances by date to compute day-over-day changes
  const sorted = [...dailyBalances].sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = new Map<string, { balances: number[]; count: number; withdrawalCount: number; withdrawalTotal: number }>();

  for (let i = 0; i < sorted.length; i++) {
    const db = sorted[i];
    const month = db.date.slice(0, 7);
    const entry = byMonth.get(month) ?? { balances: [], count: 0, withdrawalCount: 0, withdrawalTotal: 0 };
    entry.balances.push(db.balance);
    if (db.balance < 0) entry.count++;
    // Check for significant withdrawal: balance decreased by more than $500 from previous day
    if (i > 0) {
      const prev = sorted[i - 1];
      const change = prev.balance - db.balance;
      if (change > 500) {
        entry.withdrawalCount++;
        entry.withdrawalTotal += change;
      }
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
      escapeCsvField(month), escapeCsvField(workDays), escapeCsvField(account),
      escapeCsvField('N/A'), escapeCsvField(data.withdrawalCount), escapeCsvField(data.withdrawalTotal),
      escapeCsvField(avgDailyBal), escapeCsvField(lowBal), escapeCsvField(data.count),
    ].join(','));
  }

  return [header, ...rows].join('\n');
}

export function exportStatementsSummary(
  transactions: TransactionRow[],
  begBal: number | null,
  endBal: number | null,
  account: string,
  bank: string,
  period: string
): string {
  const header = 'Account,Bank Name,Statement Month,Starting Balance,Total Credits,# Credits,True Credits,# True Credits,Total Debits,# Debits,Ending Balance,Avg Balance,Avg True Balance,Days Neg,# OD\'s,# NSF\'s,Low Days,MCA Withhold Percent';

  const credits = transactions.filter(t => t.credit !== null && t.credit > 0);
  const trueCredits = credits.filter(t => !t.tags.some(tag => /transfer|wire|zelle|ach/i.test(tag)));
  const debits = transactions.filter(t => t.debit !== null && t.debit > 0);
  const overdrafts = transactions.filter(t => t.tags.some(tag => /overdraft/i.test(tag)));
  const nsfs = transactions.filter(t => t.tags.some(tag => /nsf/i.test(tag)));

  const totalCredits = credits.reduce((sum, t) => sum + (t.credit ?? 0), 0);
  const trueCreditsTotal = trueCredits.reduce((sum, t) => sum + (t.credit ?? 0), 0);
  const totalDebits = debits.reduce((sum, t) => sum + (t.debit ?? 0), 0);
  const avgBalance = begBal !== null && endBal !== null
    ? (begBal + endBal) / 2 : (begBal ?? endBal ?? 0);
  const avgTrueBalance = trueCreditsTotal > 0 ? avgBalance * 0.9 : avgBalance;

  let running = begBal ?? 0;
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let negDays = 0, lowDays = 0, minBalance = running;

  for (const t of sorted) {
    running += (t.credit ?? 0) - (t.debit ?? 0);
    if (running < 0) negDays++;
    if (running < minBalance) { minBalance = running; lowDays = 1; }
  }

  const row = [
    escapeCsvField(account), escapeCsvField(bank), escapeCsvField(period),
    escapeCsvField(begBal ?? 0), escapeCsvField(totalCredits),
    escapeCsvField(credits.length), escapeCsvField(trueCreditsTotal),
    escapeCsvField(trueCredits.length), escapeCsvField(totalDebits),
    escapeCsvField(debits.length), escapeCsvField(endBal ?? 0),
    escapeCsvField(avgBalance), escapeCsvField(avgTrueBalance),
    escapeCsvField(negDays), escapeCsvField(overdrafts.length),
    escapeCsvField(nsfs.length), escapeCsvField(lowDays),
    // TODO: MCA Withhold Percent requires withholding data not currently in mca_findings
    escapeCsvField(0),
  ].join(',');

  return [header, row].join('\n');
}
