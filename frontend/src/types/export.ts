// CSV Export type definitions for MoneyThumb-style exports

import type { TransactionRow } from './transactions';

// Base transaction export row
export interface BaseTransactionExport {
  account: string;
  date: string;
  description: string;
  amount: number;
  memo: string;
  number: string;
  type: string;
}

// All Transactions export
export interface AllTransactionsExport {
  statement: string;
  date: string;
  description: string;
  amount: number;
  memo: string;
  number: string;
  type: string;
}

// Credit Transactions export
export interface CreditTransactionExport extends BaseTransactionExport {}

// Daily Balance export
export interface DailyBalanceExport {
  date: string;
  balance: number;
  trueBalance: number;
}

// Daily Cash Flow export
export interface DailyCashFlowExport {
  date: string;
  cashFlow: number;
  trueCashFlow: number;
}

// Incoming/Outgoing Transfer export
export interface TransferExport extends BaseTransactionExport {}

// Large Transaction export
export interface LargeTransactionExport extends BaseTransactionExport {}

// MCA Transaction export
export interface McaTransactionExport extends BaseTransactionExport {}

// Monthly Cash Flow export
export interface MonthlyCashFlowExport {
  month: string;
  cashFlow: number;
  trueCashFlow: number;
}

// Monthly MCA summary
export interface MonthlyMcaExport {
  month: string;
  workDays: number;
  account: string;
  lender: string;
  withdrawalCount: number;
  withdrawalTotal: number;
  depositTotal: number;
  depositDates: string;
  latestWithdrawalAmount: number;
}

// Monthly Negative Days
export interface MonthlyNegativeDaysExport {
  month: string;
  workDays: number;
  account: string;
  lender: string;
  withCount: number;
  withTotal: number;
  avgDailyBal: number;
  lowBal: number;
  negBalDays: number;
}

// Non-True Credit Transaction export
export interface NonTrueCreditTransactionExport extends BaseTransactionExport {}

// NSF Transaction export
export interface NsfTransactionExport extends BaseTransactionExport {}

// Overdraft Transaction export
export interface OverdraftTransactionExport extends BaseTransactionExport {}

// Repeating Transaction export
export interface RepeatingTransactionExport extends BaseTransactionExport {}

// Returned Transaction export
export interface ReturnedTransactionExport extends BaseTransactionExport {}

// Revenue Statistics
export interface RevenueStatisticsExport {
  label: string;
  monthly: number;
  annual: number;
}

// Statements Summary
export interface StatementsSummaryExport {
  account: string;
  bankName: string;
  statementMonth: string;
  startingBalance: number;
  totalCredits: number;
  creditCount: number;
  trueCredits: number;
  trueCreditCount: number;
  totalDebits: number;
  debitCount: number;
  endingBalance: number;
  avgBalance: number;
  avgTrueBalance: number;
  daysNeg: number;
  overdraftCount: number;
  nsfCount: number;
  lowDays: number;
  mcaWithholdPercent: number;
}

// True Credit Transaction export
export interface TrueCreditTransactionExport extends BaseTransactionExport {}

// Export options enum
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

export interface ExportOption {
  type: ExportType;
  label: string;
  description: string;
  filename: string;
}

export const EXPORT_OPTIONS: ExportOption[] = [
  { type: 'all_transactions', label: 'All Transactions', description: 'All transactions from the statement', filename: 'all_transactions.csv' },
  { type: 'credit_transactions', label: 'Credit Transactions', description: 'Positive amount transactions (credits/deposits)', filename: 'Credit_Transactions.csv' },
  { type: 'daily_balances', label: 'Daily Balances', description: 'Daily balance tracking', filename: 'Daily_Balances.csv' },
  { type: 'daily_cash_flows', label: 'Daily Cash Flows', description: 'Daily cash flow with true cash flow', filename: 'Daily_Cash_Flows.csv' },
  { type: 'incoming_transfers', label: 'Incoming Transfers', description: 'Transfers IN from other accounts', filename: 'Incoming_Transfers.csv' },
  { type: 'outgoing_transfers', label: 'Outgoing Transfers', description: 'Transfers OUT to other accounts', filename: 'Outgoing_Transfers.csv' },
  { type: 'large_transactions', label: 'Large Transactions', description: 'Large deposits (typically > $500)', filename: 'Large_Transactions.csv' },
  { type: 'mca_transactions', label: 'MCA Transactions', description: 'Merchant Cash Advance transactions', filename: 'MCA_Transactions.csv' },
  { type: 'monthly_cash_flows', label: 'Monthly Cash Flows', description: 'Monthly aggregated cash flows', filename: 'Monthly_Cash_Flows.csv' },
  { type: 'monthly_mca', label: 'Monthly MCA', description: 'Monthly MCA summary', filename: 'Monthly_MCA.csv' },
  { type: 'monthly_negative_days', label: 'Monthly Negative Days', description: 'Days with negative balance', filename: 'Monthly_Negative_Days.csv' },
  { type: 'non_true_credit_transactions', label: 'Non-True Credit Transactions', description: 'Credits that are NOT true deposits', filename: 'Non-True_Credit_Transactions.csv' },
  { type: 'nsf_transactions', label: 'NSF Transactions', description: 'Non-sufficient funds transactions', filename: 'NSF_Transactions.csv' },
  { type: 'overdraft_transactions', label: 'Overdraft Transactions', description: 'Overdraft transactions', filename: 'Overdraft_Transactions.csv' },
  { type: 'repeating_transactions', label: 'Repeating Transactions', description: 'Recurring/repeating transactions', filename: 'Repeating_Transactions.csv' },
  { type: 'returned_transactions', label: 'Returned Transactions', description: 'Returned items', filename: 'Returned_Transactions.csv' },
  { type: 'revenue_statistics', label: 'Revenue Statistics', description: 'Revenue summary', filename: 'Revenue_Statistics.csv' },
  { type: 'statements_summary', label: 'Statements Summary', description: 'Statement summary', filename: 'Statements_Summary.csv' },
  { type: 'true_credit_transactions', label: 'True Credit Transactions', description: 'True deposits (not transfers)', filename: 'True_Credit_Transactions.csv' },
];

// Helper interface for working with transaction data
export interface TransactionData {
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
