import { describe, it, expect } from 'vitest';
import { computeRevenueStats, buildDailyBalances, buildMCAByMonth, filterByTag } from '../../src/utils/insights/statistics';
import type { TransactionRow } from '../../src/types/transactions';

describe('statistics', () => {
  describe('computeRevenueStats', () => {
    it('computes total credits and debits correctly', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-01', payee: 'Client A', credit: 1000, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-01-02', payee: 'Vendor B', credit: null, debit: 300, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '3', date: '2024-01-03', payee: 'Client B', credit: 500, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
      ];

      const stats = computeRevenueStats(transactions);

      expect(stats.totalCredits).toBe(1500);
      expect(stats.totalDebits).toBe(300);
      expect(stats.grossProfit).toBe(1200);
    });

    it('handles empty transaction list', () => {
      const stats = computeRevenueStats([]);

      expect(stats.totalCredits).toBe(0);
      expect(stats.totalDebits).toBe(0);
      expect(stats.grossProfit).toBe(0);
      expect(stats.monthlyAvg).toBe(0);
      expect(stats.highestMonth).toBeNull();
      expect(stats.lowestMonth).toBeNull();
    });

    it('computes monthly average correctly', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'Jan payment', credit: 1000, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-02-15', payee: 'Feb payment', credit: 2000, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '3', date: '2024-03-15', payee: 'Mar payment', credit: 3000, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
      ];

      const stats = computeRevenueStats(transactions);

      expect(stats.monthlyAvg).toBe(2000);
      expect(stats.highestMonth?.month).toBe('2024-03');
      expect(stats.highestMonth?.amount).toBe(3000);
      expect(stats.lowestMonth?.month).toBe('2024-01');
      expect(stats.lowestMonth?.amount).toBe(1000);
    });

    it('returns highest and lowest month correctly', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-06-01', payee: 'June', credit: 500, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-07-01', payee: 'July', credit: 9000, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '3', date: '2024-08-01', payee: 'August', credit: 300, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
      ];

      const stats = computeRevenueStats(transactions);

      expect(stats.highestMonth?.month).toBe('2024-07');
      expect(stats.highestMonth?.amount).toBe(9000);
      expect(stats.lowestMonth?.month).toBe('2024-08');
      expect(stats.lowestMonth?.amount).toBe(300);
    });
  });

  describe('buildDailyBalances', () => {
    it('computes running balance from transactions', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-01', payee: 'Start', credit: null, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-01-02', payee: 'Credit 1', credit: 1000, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '3', date: '2024-01-03', payee: 'Debit 1', credit: null, debit: 200, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
      ];

      const balances = buildDailyBalances(transactions, 1000);

      expect(balances).toHaveLength(3);
      expect(balances[0].balance).toBe(1000);
      expect(balances[1].balance).toBe(2000);
      expect(balances[2].balance).toBe(1800);
    });

    it('uses zero as default beginning balance', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-01', payee: 'First', credit: 500, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
      ];

      const balances = buildDailyBalances(transactions, null);

      expect(balances[0].balance).toBe(500);
    });

    it('handles empty transaction list', () => {
      const balances = buildDailyBalances([], 1000);

      expect(balances).toHaveLength(0);
    });
  });

  describe('buildMCAByMonth', () => {
    it('aggregates MCA debits by month', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'MCA Payment 1', credit: null, debit: 500, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-01-20', payee: 'MCA Payment 2', credit: null, debit: 300, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
        { id: '3', date: '2024-02-10', payee: 'MCA Payment 3', credit: null, debit: 700, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
      ];

      const mcaByMonth = buildMCAByMonth(transactions);

      expect(mcaByMonth).toHaveLength(2);
      expect(mcaByMonth[0].month).toBe('2024-01');
      expect(mcaByMonth[0].payments).toBe(800);
      expect(mcaByMonth[0].count).toBe(2);
      expect(mcaByMonth[1].month).toBe('2024-02');
      expect(mcaByMonth[1].payments).toBe(700);
      expect(mcaByMonth[1].count).toBe(1);
    });

    it('sorts months chronologically', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-03-01', payee: 'MCA March', credit: null, debit: 100, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-01-01', payee: 'MCA January', credit: null, debit: 200, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
        { id: '3', date: '2024-02-01', payee: 'MCA February', credit: null, debit: 150, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
      ];

      const mcaByMonth = buildMCAByMonth(transactions);

      expect(mcaByMonth[0].month).toBe('2024-01');
      expect(mcaByMonth[1].month).toBe('2024-02');
      expect(mcaByMonth[2].month).toBe('2024-03');
    });

    it('ignores non-MCA transactions', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'Regular payment', credit: null, debit: 500, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-01-20', payee: 'MCA payment', credit: null, debit: 300, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
      ];

      const mcaByMonth = buildMCAByMonth(transactions);

      expect(mcaByMonth).toHaveLength(1);
      expect(mcaByMonth[0].count).toBe(1);
      expect(mcaByMonth[0].payments).toBe(300);
    });

    it('ignores credit transactions even if tagged MCA', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'MCA deposit', credit: 1000, debit: null, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
      ];

      const mcaByMonth = buildMCAByMonth(transactions);

      expect(mcaByMonth).toHaveLength(0);
    });
  });

  describe('filterByTag', () => {
    it('filters transactions by tag', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-01', payee: 'Tx 1', credit: 100, debit: null, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-01-02', payee: 'Tx 2', credit: 200, debit: null, balance: null, memo: '', checkNumber: '', tags: ['transfer'], isTrue: false, isReviewed: false },
        { id: '3', date: '2024-01-03', payee: 'Tx 3', credit: 300, debit: null, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
      ];

      const filtered = filterByTag(transactions, 'mca');

      expect(filtered).toHaveLength(2);
    });

    it('is case insensitive', () => {
      const transactions: TransactionRow[] = [
        { id: '1', date: '2024-01-01', payee: 'Tx 1', credit: 100, debit: null, balance: null, memo: '', checkNumber: '', tags: ['MCA'], isTrue: false, isReviewed: false },
      ];

      const filtered = filterByTag(transactions, 'mca');

      expect(filtered).toHaveLength(1);
    });
  });
});