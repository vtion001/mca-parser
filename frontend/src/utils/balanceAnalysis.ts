// Balance and cash flow analysis utilities

import type { TransactionRow } from '../types/transactions';

/**
 * Build daily balances from transactions.
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
 * Build daily true balances (excluding internal transfers).
 */
export function buildTrueBalances(
  transactions: TransactionRow[],
  begBal: number | null
): { date: string; balance: number }[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const balances: { date: string; balance: number }[] = [];
  let running = begBal ?? 0;
  for (const t of sorted) {
    if (!isTransfer(t)) {
      running += (t.credit ?? 0) - (t.debit ?? 0);
    }
    balances.push({ date: t.date, balance: running });
  }
  return balances;
}

/**
 * Calculate daily cash flows (change in balance per day).
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
    const trueCashFlow = truePrev
      ? trueBalances[i].balance - truePrev.balance
      : trueBalances[i].balance;
    cashFlows.push({ date: current.date, cashFlow, trueCashFlow });
  }
  return cashFlows;
}

/**
 * Aggregate daily cash flows into monthly totals.
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
 * Count weekdays (Mon–Fri) in a given month.
 */
export function getWorkDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) workDays++;
  }
  return workDays;
}

/**
 * Find transactions that repeat on regular intervals (weekly / biweekly / monthly).
 */
export function findRepeatingTransactions(
  transactions: TransactionRow[]
): TransactionRow[] {
  const amountMap = new Map<number, TransactionRow[]>();

  for (const tx of transactions) {
    const amount = tx.credit ?? tx.debit ?? 0;
    if (amount > 0) {
      const existing = amountMap.get(amount) ?? [];
      existing.push(tx);
      amountMap.set(amount, existing);
    }
  }

  const repeating: TransactionRow[] = [];
  for (const [, txs] of amountMap) {
    if (txs.length < 2) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    let isRepeating = true;

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].date);
      const currDate = new Date(sorted[i].date);
      const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 35 || diffDays < 3) {
        isRepeating = false;
        break;
      }
    }

    if (isRepeating) repeating.push(...sorted);
  }

  return repeating;
}

// ─── Classification helpers (used by balance analysis) ──────────────────────────

function isTransfer(tx: TransactionRow): boolean {
  return tx.tags.some(tag =>
    /transfer|wire|zelle|ach/i.test(tag)
  );
}
