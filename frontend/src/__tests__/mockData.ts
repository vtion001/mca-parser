import type { ExtractionResult } from '../types/extraction';

export const mockExtractionResult: ExtractionResult = {
  markdown: '# Bank Statement\n\nOpening Balance: $10,000\nClosing Balance: $15,000',
  document_type: { type: 'bank_statement', confidence: 0.95 },
  key_details: [
    {
      field: 'account_number',
      label: 'Account Number',
      value: '1234567890',
      page: 1,
      confidence: 0.9,
      matched_pattern: 'account_number',
    },
  ],
  scores: {
    completeness: 0.92,
    quality: 0.88,
    pii_detection: 0.95,
    overall: 0.92,
  },
  pii_breakdown: {
    ssn: { found: true, label: 'SSN' },
    email: { found: false, label: 'Email' },
    phone: { found: false, label: 'Phone' },
  },
  recommendations: [
    { type: 'quality', message: 'Document quality is good' },
  ],
  balances: {
    beginning_balance: {
      amount: 10000,
      keyword: 'Opening Balance',
      raw_text: 'Opening Balance: $10,000',
    },
    ending_balance: {
      amount: 15000,
      keyword: 'Closing Balance',
      raw_text: 'Closing Balance: $15,000',
    },
  },
  ai_analysis: {
    success: true,
    analysis: {
      qualification_score: 8,
      is_valid_document: true,
      completeness: {
        score: 0.9,
        is_complete: true,
        concerns: [],
      },
      pii_found: {
        has_ssn: true,
        has_account_numbers: true,
        locations: ['page 1'],
      },
      transaction_summary: {
        credit_count: 15,
        debit_count: 12,
        total_amount_credits: 25000,
        total_amount_debits: 20000,
      },
      risk_indicators: {
        has_large_unusual_transactions: true,
        has_overdraft_signs: false,
        has_high_fee_pattern: false,
        has_returned_items: false,
        details: ['Large/unusual transactions detected'],
      },
      recommendations: [
        'Review large transactions with management',
        'Consider implementing overdraft protection',
      ],
    },
  },
  mca_findings: {
    transactions: [
      {
        description: 'MCA PAYMENT - RAPID FUNDS',
        amount: 2500,
        date: '2024-01-15',
        is_mca: true,
        mca_provider: 'Rapid Funds',
        confidence: 0.92,
        source: 'provider_match',
      },
      {
        description: 'MCA PAYMENT - BLUE CAPITAL',
        amount: 1800,
        date: '2024-01-22',
        is_mca: true,
        mca_provider: 'Blue Capital',
        confidence: 0.87,
        source: 'keyword_match',
      },
      {
        description: 'MCA PAYMENT - PROGRESS FUNDS',
        amount: 3200,
        date: '2024-02-01',
        is_mca: true,
        mca_provider: 'Progress Funds',
        confidence: 0.75,
        source: 'ai_review',
      },
      {
        description: 'MCA PAYMENT - SUMMIT FUNDING',
        amount: 2100,
        date: '2024-02-10',
        is_mca: true,
        mca_provider: 'Summit Funding',
        confidence: 0.55,
        source: 'keyword_match',
      },
      {
        description: 'MCA PAYMENT - ALPHA CAPITAL',
        amount: 1500,
        date: '2024-02-15',
        is_mca: true,
        mca_provider: 'Alpha Capital',
        confidence: 0.42,
        source: 'prefilter_fallback',
      },
    ],
    candidates_reviewed: [
      {
        description: 'POTENTIAL MCA - MERCHANT ADVANCE',
        amount: 3000,
        date: '2024-01-28',
        is_mca: true,
        mca_provider: null,
        confidence: 0.78,
        source: 'ai_review',
        reasoning: 'Pattern matches MCA characteristics',
      },
      {
        description: 'LIKELY VENDOR PAYMENT',
        amount: 500,
        date: '2024-02-05',
        is_mca: false,
        mca_provider: null,
        confidence: 0.6,
        source: 'ai_review',
        reasoning: 'Regular vendor payment pattern',
      },
    ],
    summary: {
      total_mca_transactions: 5,
      total_mca_amount: 11100,
      unique_providers: ['Rapid Funds', 'Blue Capital', 'Progress Funds', 'Summit Funding', 'Alpha Capital'],
      average_confidence: 0.702,
      ai_reviewed_candidates: 2,
      ai_confirmed_mca: 1,
    },
  },
  transaction_classification: {
    transactions: [
      {
        description: 'Wire Transfer',
        amount: 5000,
        date: '2024-01-10',
        classification: {
          tags: ['wire'],
          is_classified: true,
          confidence: 0.95,
          has_withdrawal: true,
          has_deposit: false,
        },
      },
    ],
    summary: {
      total: 1,
      return: 0,
      internal_transfer: 0,
      wire: 1,
      line_of_credit: 0,
      lender: 0,
      cash_app: 0,
    },
  },
  page_count: 3,
};

export const mockExtractionResultEmptyMca: ExtractionResult = {
  ...mockExtractionResult,
  mca_findings: {
    transactions: [],
    summary: {
      total_mca_transactions: 0,
      total_mca_amount: 0,
      unique_providers: [],
      average_confidence: 0,
    },
  },
};

export const mockExtractionResultNoBalances: ExtractionResult = {
  ...mockExtractionResult,
  balances: undefined,
};

export const mockExtractionResultNullBalances: ExtractionResult = {
  ...mockExtractionResult,
  balances: {
    beginning_balance: { amount: null, keyword: null, raw_text: null },
    ending_balance: { amount: null, keyword: null, raw_text: null },
  },
};

export const mockExtractionResultNegativeNetChange: ExtractionResult = {
  ...mockExtractionResult,
  balances: {
    beginning_balance: { amount: 15000, keyword: 'Opening Balance', raw_text: '...' },
    ending_balance: { amount: 10000, keyword: 'Closing Balance', raw_text: '...' },
  },
};

export const mockExtractionResultFallbackAI: ExtractionResult = {
  ...mockExtractionResult,
  ai_analysis: {
    success: false,
    analysis: {
      qualification_score: 5,
      is_valid_document: true,
      completeness: {
        score: 0.7,
        is_complete: true,
        concerns: ['Minor completeness concerns'],
      },
      pii_found: {
        has_ssn: false,
        has_account_numbers: false,
        locations: [],
      },
      transaction_summary: {
        credit_count: 10,
        debit_count: 8,
        total_amount_credits: 15000,
        total_amount_debits: 12000,
      },
      risk_indicators: {
        has_large_unusual_transactions: false,
        has_overdraft_signs: false,
        has_high_fee_pattern: true,
        has_returned_items: false,
        details: ['High fee pattern detected'],
      },
      recommendations: ['Consider reviewing fee patterns'],
    },
    error: 'AI service unavailable',
  },
};
