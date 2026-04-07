/**
 * Statistics: pure functions for computing revenue stats, daily balances, MCA by month.
 * All functions are side-effect free and fully testable.
 */

import type { TransactionRow } from '../../types/transactions';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DailyBalance {
  date: string;
  balance: number;
}

export interface McAByMonth {
  month: string;
  payments: number;
  count: number;
}

export interface RevenueStats {
  totalCredits: number;
  totalDebits: number;
  grossProfit: number;
  monthlyAvg: number;
  highestMonth: { month: string; amount: number } | null;
  lowestMonth: { month: string; amount: number } | null;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export function filterByTag(txns: TransactionRow[], tag: string): TransactionRow[] {
  return txns.filter(t => t.tags.some(tg => tg.toLowerCase().includes(tag.toLowerCase())));
}

// ─── Revenue Stats ───────────────────────────────────────────────────────────

function getMonthlyCredits(txns: TransactionRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.credit && t.credit > 0) {
      const month = t.date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + t.credit);
    }
  }
  return map;
}

export function computeRevenueStats(txns: TransactionRow[]): RevenueStats {
  let totalCredits = 0;
  let totalDebits = 0;
  for (const t of txns) {
    if (t.credit) totalCredits += t.credit;
    if (t.debit) totalDebits += t.debit;
  }

  const grossProfit = totalCredits - totalDebits;
  const monthly = getMonthlyCredits(txns);
  const months = Array.from(monthly.entries());
  const monthlyAvg = months.length > 0
    ? months.reduce((s, [, v]) => s + v, 0) / months.length
    : 0;
  const highest = months.length > 0
    ? months.reduce((a, b) => (b[1] > a[1] ? b : a))
    : null;
  const lowest = months.length > 0
    ? months.reduce((a, b) => (b[1] < a[1] ? b : a))
    : null;

  return {
    totalCredits,
    totalDebits,
    grossProfit,
    monthlyAvg,
    highestMonth: highest ? { month: highest[0], amount: highest[1] } : null,
    lowestMonth: lowest ? { month: lowest[0], amount: lowest[1] } : null,
  };
}

// ─── Daily Balances ──────────────────────────────────────────────────────────

export function buildDailyBalances(txns: TransactionRow[], begBal: number | null): DailyBalance[] {
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  const balances: DailyBalance[] = [];
  let running = begBal ?? 0;
  for (const t of sorted) {
    running += (t.credit ?? 0) - (t.debit ?? 0);
    balances.push({ date: t.date, balance: running });
  }
  return balances;
}

// ─── MCA by Month ────────────────────────────────────────────────────────────

export function buildMCAByMonth(txns: TransactionRow[]): McAByMonth[] {
  const mcaTxns = filterByTag(txns, 'mca');
  const map = new Map<string, { payments: number; count: number }>();
  for (const t of mcaTxns) {
    if (t.debit && t.debit > 0) {
      const month = t.date.slice(0, 7);
      const entry = map.get(month) ?? { payments: 0, count: 0 };
      entry.payments += t.debit;
      entry.count += 1;
      map.set(month, entry);
    }
  }
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, payments: v.payments, count: v.count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
