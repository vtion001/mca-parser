import { useMemo } from 'react';
import type { ExtractionResult } from '../types/extraction';
import type { ParsedStatement, TransactionRow } from '../types/transactions';
import { parseTransactionsFromMarkdown, autoTag } from '../utils/transactionParser';

interface DailyBalance {
  date: string;
  balance: number;
}

interface McAByMonth {
  month: string;
  payments: number;
  count: number;
  lender: string;
}

interface RevenueStats {
  totalCredits: number;
  totalDebits: number;
  grossProfit: number;
  monthlyAvg: number;
  highestMonth: { month: string; amount: number } | null;
  lowestMonth: { month: string; amount: number } | null;
}

interface InsightsCalculations {
  transactions: TransactionRow[];
  revenueStats: RevenueStats;
  mcaPaymentsByMonth: McAByMonth[];
  dailyBalances: DailyBalance[];
  begBal: number | null;
  endBal: number | null;
}

function filterByTag(txns: TransactionRow[], tag: string): TransactionRow[] {
  return txns.filter(t => t.tags.some(tg => tg.toLowerCase().includes(tag.toLowerCase())));
}

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

function buildDailyBalances(txns: TransactionRow[], begBal: number | null): DailyBalance[] {
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  const balances: DailyBalance[] = [];
  let running = begBal ?? 0;
  for (const t of sorted) {
    running += (t.credit ?? 0) - (t.debit ?? 0);
    balances.push({ date: t.date, balance: running });
  }
  return balances;
}

function buildMCAByMonth(txns: TransactionRow[], mcaFindings: ExtractionResult['mca_findings']): McAByMonth[] {
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
  // Get the primary lender from mca_findings (most common provider)
  const lender = mcaFindings?.summary?.unique_providers?.[0] ?? 'MCA Provider';
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, payments: v.payments, count: v.count, lender }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function useInsightsCalculations(result: ExtractionResult): InsightsCalculations {
  return useMemo(() => {
    if (!result.markdown || result.markdown.length === 0) {
      return {
        transactions: [],
        revenueStats: { totalCredits: 0, totalDebits: 0, grossProfit: 0, monthlyAvg: 0, highestMonth: null, lowestMonth: null },
        mcaPaymentsByMonth: [],
        dailyBalances: [],
        begBal: null,
        endBal: null,
      };
    }

    let statement: ParsedStatement | null = null;
    try {
      statement = parseTransactionsFromMarkdown(result.markdown);
    } catch {
      return {
        transactions: [],
        revenueStats: { totalCredits: 0, totalDebits: 0, grossProfit: 0, monthlyAvg: 0, highestMonth: null, lowestMonth: null },
        mcaPaymentsByMonth: [],
        dailyBalances: [],
        begBal: null,
        endBal: null,
      };
    }

    const transactions = statement.transactions.map(t => ({
      ...t,
      tags: autoTag(t.payee, t.credit ?? null, t.debit ?? null),
    }));

    const begBal = statement.beginningBalance ?? result.balances?.beginning_balance?.amount ?? null;
    const endBal = statement.endingBalance ?? result.balances?.ending_balance?.amount ?? null;

    let totalCredits = 0;
    let totalDebits = 0;
    for (const t of transactions) {
      if (t.credit) totalCredits += t.credit;
      if (t.debit) totalDebits += t.debit;
    }
    const grossProfit = totalCredits - totalDebits;
    const monthly = getMonthlyCredits(transactions);
    const months = Array.from(monthly.entries());
    const monthlyAvg = months.length > 0 ? months.reduce((s, [, v]) => s + v, 0) / months.length : 0;
    const highest = months.length > 0 ? months.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
    const lowest = months.length > 0 ? months.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
    const revenueStats: RevenueStats = {
      totalCredits,
      totalDebits,
      grossProfit,
      monthlyAvg,
      highestMonth: highest ? { month: highest[0], amount: highest[1] } : null,
      lowestMonth: lowest ? { month: lowest[0], amount: lowest[1] } : null,
    };

    return {
      transactions,
      revenueStats,
      mcaPaymentsByMonth: buildMCAByMonth(transactions, result.mca_findings),
      dailyBalances: buildDailyBalances(transactions, begBal),
      begBal,
      endBal,
    };
  }, [result]);
}
