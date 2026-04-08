// Export utilities — barrel re-export + main dispatcher

import type { TransactionRow } from '../../types/transactions';
import { downloadCsv } from '../csvCore';
import * as txFormatters from './formatters/transactions';
import * as balFormatters from './formatters/balances';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  mcaPaymentsByMonth: { month: string; payments: number; count: number; lender: string }[];
  revenueStats: {
    totalCredits: number;
    totalDebits: number;
    grossProfit: number;
    monthlyAvg: number;
  };
}

// ─── Revenue statistics formatter ─────────────────────────────────────────

function exportRevenueStatistics(stats: ExportConfig['revenueStats']): string {
  const header = 'Label,Monthly,Annual';
  const rows = [
    ['Revenue', stats.totalCredits, stats.totalCredits * 12],
    ['True Revenue', stats.totalCredits * 0.9, stats.totalCredits * 12 * 0.9],
    ['Expenses', stats.totalDebits, stats.totalDebits * 12],
    ['Profit', stats.grossProfit, stats.grossProfit * 12],
    ['Balance/Days Negative', 0, 0],
  ].map(([label, monthly, annual]) =>
    [String(label), String(monthly), String(annual)].join(',')
  );
  return [header, ...rows].join('\n');
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function exportData(type: ExportType, config: ExportConfig): string {
  const { transactions, dailyBalances, trueBalances, accountName, bankName, statementPeriod, mcaPaymentsByMonth, revenueStats, begBal, endBal } = config;

  switch (type) {
    case 'all_transactions':
      return txFormatters.exportAllTransactions(transactions, statementPeriod || accountName);
    case 'credit_transactions':
      return txFormatters.exportCreditTransactions(transactions, accountName);
    case 'daily_balances':
      return balFormatters.exportDailyBalances(dailyBalances, trueBalances, accountName);
    case 'daily_cash_flows':
      return balFormatters.exportDailyCashFlows(dailyBalances, trueBalances, accountName);
    case 'incoming_transfers':
      return txFormatters.exportIncomingTransfers(transactions, accountName);
    case 'outgoing_transfers':
      return txFormatters.exportOutgoingTransfers(transactions, accountName);
    case 'large_transactions':
      return txFormatters.exportLargeTransactions(transactions, accountName);
    case 'mca_transactions':
      return txFormatters.exportMcaTransactions(transactions, accountName);
    case 'monthly_cash_flows':
      return balFormatters.exportMonthlyCashFlows(dailyBalances, trueBalances, accountName);
    case 'monthly_mca':
      return balFormatters.exportMonthlyMca(transactions, accountName, mcaPaymentsByMonth);
    case 'monthly_negative_days':
      return balFormatters.exportMonthlyNegativeDays(dailyBalances, accountName);
    case 'non_true_credit_transactions':
      return txFormatters.exportNonTrueCreditTransactions(transactions, accountName);
    case 'nsf_transactions':
      return txFormatters.exportNsfTransactions(transactions, accountName);
    case 'overdraft_transactions':
      return txFormatters.exportOverdraftTransactions(transactions, accountName);
    case 'repeating_transactions':
      return txFormatters.exportRepeatingTransactions(transactions, accountName);
    case 'returned_transactions':
      return txFormatters.exportReturnedTransactions(transactions, accountName);
    case 'revenue_statistics':
      return exportRevenueStatistics(revenueStats);
    case 'statements_summary':
      return balFormatters.exportStatementsSummary(transactions, begBal, endBal, accountName, bankName, statementPeriod);
    case 'true_credit_transactions':
      return txFormatters.exportTrueCreditTransactions(transactions, accountName);
    default:
      throw new Error(`Unknown export type: ${type}`);
  }
}

// ─── Convenience alias ──────────────────────────────────────────────────────
export { downloadCsv };
