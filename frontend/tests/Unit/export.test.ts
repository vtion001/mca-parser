import { describe, it, expect } from 'vitest';
import { exportData, type ExportType, type ExportConfig } from '../../src/utils/export/index';
import type { TransactionRow } from '../../src/types/transactions';

describe('export/index', () => {
  // Helper to create minimal transaction rows
  const createTx = (partial: Partial<TransactionRow> & { id: string; date: string; payee: string }): TransactionRow => ({
    credit: null,
    debit: null,
    balance: null,
    memo: '',
    checkNumber: '',
    tags: [],
    isTrue: false,
    isReviewed: false,
    ...partial,
  });

  const minimalConfig: ExportConfig = {
    transactions: [],
    dailyBalances: [],
    trueBalances: [],
    begBal: null,
    endBal: null,
    accountName: 'Test Account',
    bankName: 'Test Bank',
    statementPeriod: 'January 2024',
    mcaPaymentsByMonth: [],
    revenueStats: {
      totalCredits: 0,
      totalDebits: 0,
      grossProfit: 0,
      monthlyAvg: 0,
    },
  };

  describe('exportData', () => {
    it('exportAllTransactions returns non-empty string with header', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'Client Payment', credit: 1000 }),
        ],
      };

      const result = exportData('all_transactions', config);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Statement');
    });

    it('exportCreditTransactions returns CSV with header', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'Credit', credit: 500 }),
          createTx({ id: '2', date: '2024-01-16', payee: 'Debit', debit: 200 }),
        ],
      };

      const result = exportData('credit_transactions', config);

      expect(result).toContain('Account');
      expect(result).toContain('Date');
      expect(result).toContain('Description');
      expect(result).toContain('Amount');
    });

    it('exportDailyBalances returns CSV with header', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        dailyBalances: [
          { date: '2024-01-01', balance: 1000 },
          { date: '2024-01-02', balance: 1500 },
        ],
        trueBalances: [
          { date: '2024-01-01', balance: 1100 },
          { date: '2024-01-02', balance: 1600 },
        ],
      };

      const result = exportData('daily_balances', config);

      expect(result).toContain('Date');
      expect(result).toContain('Balance');
    });

    it('exportMcaTransactions returns filtered CSV', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'MCA Payment', credit: 500, tags: ['mca'] }),
          createTx({ id: '2', date: '2024-01-16', payee: 'Regular', credit: 200 }),
        ],
      };

      const result = exportData('mca_transactions', config);

      expect(result).toContain('MCA Payment');
      expect(result).not.toContain('Regular');
    });

    it('exportNsfTransactions filters by NSF tag', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'NSF Fee', debit: 35, tags: ['nsf'] }),
          createTx({ id: '2', date: '2024-01-16', payee: 'Regular', credit: 200 }),
        ],
      };

      const result = exportData('nsf_transactions', config);

      expect(result).toContain('NSF Fee');
    });

    it('exportReturnedTransactions filters by return tag', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'Returned Item', debit: 100, tags: ['returned'] }),
          createTx({ id: '2', date: '2024-01-16', payee: 'Regular', credit: 200 }),
        ],
      };

      const result = exportData('returned_transactions', config);

      expect(result).toContain('Returned Item');
    });

    it('exportOverdraftTransactions filters by overdraft tag', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'Overdraft Fee', debit: 35, tags: ['overdraft'] }),
          createTx({ id: '2', date: '2024-01-16', payee: 'Regular', credit: 200 }),
        ],
      };

      const result = exportData('overdraft_transactions', config);

      expect(result).toContain('Overdraft Fee');
    });

    it('exportIncomingTransfers filters incoming transfers', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'Wire In', credit: 5000, tags: ['transfer'] }),
          createTx({ id: '2', date: '2024-01-16', payee: 'Regular', credit: 200 }),
        ],
      };

      const result = exportData('incoming_transfers', config);

      expect(result).toContain('Wire In');
    });

    it('exportOutgoingTransfers filters outgoing transfers', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'Wire Out', debit: 3000, tags: ['transfer'] }),
          createTx({ id: '2', date: '2024-01-16', payee: 'Regular', credit: 200 }),
        ],
      };

      const result = exportData('outgoing_transfers', config);

      expect(result).toContain('Wire Out');
    });

    it('exportMonthlyMca returns monthly MCA summary', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'MCA', credit: 1000, debit: 500, tags: ['mca'] }),
        ],
        mcaPaymentsByMonth: [
          { month: '2024-01', payments: 500, count: 1 },
        ],
      };

      const result = exportData('monthly_mca', config);

      expect(result).toContain('2024-01');
    });

    it('exportRevenueStatistics returns revenue CSV', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        revenueStats: {
          totalCredits: 10000,
          totalDebits: 6000,
          grossProfit: 4000,
          monthlyAvg: 3333,
        },
      };

      const result = exportData('revenue_statistics', config);

      expect(result).toContain('Revenue');
      expect(result).toContain('Expenses');
      expect(result).toContain('Profit');
    });

    it('exportStatementsSummary returns statement summary', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [],
        begBal: 5000,
        endBal: 7500,
      };

      const result = exportData('statements_summary', config);

      expect(result).toContain('Account');
      expect(result).toContain('Statement Month');
      expect(result).toContain('Starting Balance');
    });

    it('throws on unknown export type', () => {
      expect(() => exportData('unknown_type' as ExportType, minimalConfig)).toThrow('Unknown export type');
    });
  });

  describe('ExportType coverage', () => {
    const allExportTypes: ExportType[] = [
      'all_transactions',
      'credit_transactions',
      'daily_balances',
      'daily_cash_flows',
      'incoming_transfers',
      'outgoing_transfers',
      'large_transactions',
      'mca_transactions',
      'monthly_cash_flows',
      'monthly_mca',
      'monthly_negative_days',
      'non_true_credit_transactions',
      'nsf_transactions',
      'overdraft_transactions',
      'repeating_transactions',
      'returned_transactions',
      'revenue_statistics',
      'statements_summary',
      'true_credit_transactions',
    ];

    it('all ExportType values are handled', () => {
      const config: ExportConfig = {
        ...minimalConfig,
        transactions: [
          createTx({ id: '1', date: '2024-01-15', payee: 'Test', credit: 100, tags: ['mca'] }),
        ],
        dailyBalances: [{ date: '2024-01-01', balance: 1000 }],
        trueBalances: [{ date: '2024-01-01', balance: 1100 }],
        mcaPaymentsByMonth: [{ month: '2024-01', payments: 500, count: 1 }],
      };

      for (const type of allExportTypes) {
        // Should not throw for any valid type
        expect(typeof exportData(type, config)).toBe('string');
      }
    });
  });
});