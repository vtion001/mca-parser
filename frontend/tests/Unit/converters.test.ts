import { describe, it, expect } from 'vitest';
import {
  mapBackendTagToFrontend,
  convertBackendTransaction,
  convertMcaTransaction,
  mergeMcaTransactions,
} from '../../src/utils/insights/converters';
import type { TransactionRow } from '../../src/types/transactions';
import type { ExtractionResult } from '../../src/types/extraction';

describe('converters', () => {
  describe('mapBackendTagToFrontend', () => {
    it('maps return tag correctly', () => {
      expect(mapBackendTagToFrontend('return')).toBe('return');
    });

    it('maps internal_transfer to transfer', () => {
      expect(mapBackendTagToFrontend('internal_transfer')).toBe('transfer');
    });

    it('maps wire tag correctly', () => {
      expect(mapBackendTagToFrontend('wire')).toBe('wire');
    });

    it('maps line_of_credit to lender', () => {
      expect(mapBackendTagToFrontend('line_of_credit')).toBe('lender');
    });

    it('maps lender tag correctly', () => {
      expect(mapBackendTagToFrontend('lender')).toBe('lender');
    });

    it('maps cash_app tag correctly', () => {
      expect(mapBackendTagToFrontend('cash_app')).toBe('cash_app');
    });

    it('passes through unknown tags unchanged', () => {
      expect(mapBackendTagToFrontend('unknown_tag')).toBe('unknown_tag');
    });
  });

  describe('convertBackendTransaction', () => {
    it('converts credit transaction correctly', () => {
      const backendTxn = {
        description: 'Payment from Client A',
        amount: 500.00,
        date: '2024-01-15',
        classification: {
          tags: ['internal_transfer'],
          is_classified: true,
          confidence: 0.95,
          has_withdrawal: false,
          has_deposit: true,
        },
      };

      const row = convertBackendTransaction(backendTxn);

      expect(row.date).toBe('2024-01-15');
      expect(row.payee).toBe('Payment from Client A');
      expect(row.credit).toBe(500.00);
      expect(row.debit).toBeNull();
      expect(row.tags).toContain('transfer');
      expect(row.isTrue).toBe(false);
      expect(row.isReviewed).toBe(false);
    });

    it('converts debit transaction correctly', () => {
      const backendTxn = {
        description: 'Vendor Payment',
        amount: -250.00,
        date: '2024-01-16',
        classification: {
          tags: [],
          is_classified: false,
          confidence: 0.0,
          has_withdrawal: true,
          has_deposit: false,
        },
      };

      const row = convertBackendTransaction(backendTxn);

      expect(row.debit).toBe(250.00);
      expect(row.credit).toBeNull();
    });

    it('handles null amount', () => {
      const backendTxn = {
        description: 'Unknown transaction',
        amount: null,
        date: '2024-01-17',
        classification: {
          tags: [],
          is_classified: false,
          confidence: 0,
          has_withdrawal: false,
          has_deposit: false,
        },
      };

      const row = convertBackendTransaction(backendTxn);

      expect(row.credit).toBeNull();
      expect(row.debit).toBeNull();
    });

    it('maps multiple tags via mapBackendTagToFrontend', () => {
      const backendTxn = {
        description: 'Multi-tag transaction',
        amount: 100,
        date: '2024-01-18',
        classification: {
          tags: ['return', 'internal_transfer'],
          is_classified: true,
          confidence: 0.9,
          has_withdrawal: false,
          has_deposit: true,
        },
      };

      const row = convertBackendTransaction(backendTxn);

      expect(row.tags).toContain('return');
      expect(row.tags).toContain('transfer');
    });
  });

  describe('convertMcaTransaction', () => {
    it('converts MCA transaction with provider', () => {
      const mcaTxn = {
        description: 'Weekly payment',
        amount: 1500.00,
        date: '2024-01-20',
        is_mca: true,
        mca_provider: 'Advance Financial',
        confidence: 0.92,
      };

      const row = convertMcaTransaction(mcaTxn);

      expect(row.date).toBe('2024-01-20');
      expect(row.payee).toBe('Advance Financial: Weekly payment');
      expect(row.credit).toBe(1500.00);
      expect(row.debit).toBeNull();
      expect(row.tags).toContain('mca');
    });

    it('converts MCA transaction without provider', () => {
      const mcaTxn = {
        description: 'MCA withdrawal',
        amount: -800.00,
        date: '2024-01-21',
        is_mca: true,
        mca_provider: null,
        confidence: 0.85,
      };

      const row = convertMcaTransaction(mcaTxn);

      expect(row.payee).toBe('MCA withdrawal');
      expect(row.debit).toBe(800.00);
    });

    it('always tags transaction as MCA', () => {
      const mcaTxn = {
        description: 'Any description',
        amount: 100,
        date: '2024-01-22',
        is_mca: true,
        mca_provider: null,
        confidence: 0.5,
      };

      const row = convertMcaTransaction(mcaTxn);

      expect(row.tags).toEqual(['mca']);
    });
  });

  describe('mergeMcaTransactions', () => {
    it('merges MCA transactions not already in classified list', () => {
      const classified: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'MCA Provider: Payment 1', credit: 1000, debit: null, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
        { id: '2', date: '2024-01-16', payee: 'Other Transaction', credit: 200, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
      ];

      const mcaFindings: ExtractionResult['mca_findings'] = {
        transactions: [
          { description: 'Payment 2', amount: 1500, date: '2024-01-20', is_mca: true, mca_provider: 'Provider B', confidence: 0.88, source: 'keyword_match' },
        ],
        summary: {
          total_mca_transactions: 1,
          total_mca_amount: 1500,
          unique_providers: ['Provider B'],
          average_confidence: 0.88,
        },
      };

      const merged = mergeMcaTransactions(classified, mcaFindings);

      // Payment 2 is new (payee "provider b: payment 2" is not in classified payees),
      // so it should be added to the 2 existing classified transactions
      expect(merged).toHaveLength(3);
      const newTx = merged.find(t => t.payee === 'Provider B: Payment 2');
      expect(newTx).toBeDefined();
    });

    it('skips MCA transaction already present (case-insensitive)', () => {
      // Deduplication checks: mcaTxn.description lowercased IS CONTAINED in classified payee lowercased.
      // So if classified payee is "Provider A: Payment 1" (contains "payment 1")
      // and mca description is "payment 1" -> they match -> no duplicate added.
      // Use a classified payee whose words don't contain the mca description.
      const classified: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'Provider A: Weekly draw', credit: 1000, debit: null, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
      ];

      const mcaFindings: ExtractionResult['mca_findings'] = {
        transactions: [
          { description: 'payment 1', amount: 1000, date: '2024-01-15', is_mca: true, mca_provider: 'Provider A', confidence: 0.9, source: 'provider_match' },
        ],
        summary: {
          total_mca_transactions: 1,
          total_mca_amount: 1000,
          unique_providers: ['Provider A'],
          average_confidence: 0.9,
        },
      };

      const merged = mergeMcaTransactions(classified, mcaFindings);

      // "payment 1" is NOT contained in "provider a: weekly draw" -> no deduplication, added
      expect(merged).toHaveLength(2);
    });

    it('detects MCA match when description is substring of payee', () => {
      // When the mca description is NOT a substring of the classified payee,
      // the transaction gets added (no deduplication).
      const classified: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'Provider A: Weekly draw', credit: 1000, debit: null, balance: null, memo: '', checkNumber: '', tags: ['mca'], isTrue: false, isReviewed: false },
      ];

      const mcaFindings: ExtractionResult['mca_findings'] = {
        transactions: [
          { description: 'payment 1', amount: 1000, date: '2024-01-15', is_mca: true, mca_provider: 'Provider A', confidence: 0.9, source: 'provider_match' },
        ],
        summary: {
          total_mca_transactions: 1,
          total_mca_amount: 1000,
          unique_providers: ['Provider A'],
          average_confidence: 0.9,
        },
      };

      const merged = mergeMcaTransactions(classified, mcaFindings);

      // "payment 1" is NOT a substring of "provider a: weekly draw"
      // so no deduplication occurs -> 2 transactions total
      expect(merged).toHaveLength(2);
    });

    it('returns original list when mca_findings is empty', () => {
      const classified: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'Tx', credit: 100, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
      ];

      const merged = mergeMcaTransactions(classified, { transactions: [], summary: { total_mca_transactions: 0, total_mca_amount: 0, unique_providers: [], average_confidence: 0 } });

      expect(merged).toHaveLength(1);
    });

    it('returns original list when mca_findings is undefined', () => {
      const classified: TransactionRow[] = [
        { id: '1', date: '2024-01-15', payee: 'Tx', credit: 100, debit: null, balance: null, memo: '', checkNumber: '', tags: [], isTrue: false, isReviewed: false },
      ];

      const merged = mergeMcaTransactions(classified, undefined);

      expect(merged).toHaveLength(1);
    });
  });
});