// Transaction types for the MoneyThumb-style review panel

export interface TransactionRow {
  id: string;
  date: string;
  payee: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  memo: string;
  checkNumber: string;
  tags: string[];
  isTrue: boolean;
  isReviewed: boolean;
}

export interface TagCategory {
  name: string;
  tags: string[];
}

export const TAG_CATEGORIES: TagCategory[] = [
  { name: 'MCA', tags: ['MCA', 'MCA Related', 'MCA Advance', 'MCA Payment'] },
  { name: 'Transfer', tags: ['Transfer', 'Internal Transfer', 'Wire Transfer', 'ACH Transfer'] },
  { name: 'Loans & Credit', tags: ['Loan Payment', 'Interest Charge', 'Credit Card Payment', 'Credit Card Processor'] },
  { name: 'Inflows', tags: ['Deposit', 'Credit', 'Refund', 'Return', 'Reversal', 'Return Reversal'] },
  { name: 'Outflows', tags: ['Withdrawal', 'Debit', 'Fee', 'Service Charge', 'All Other Debits'] },
  { name: 'Risk & Exceptions', tags: ['Non-Sufficient Funds', 'Overdraft', 'Returned Item', 'Large/Unusual'] },
  { name: 'Payments', tags: ['Payment', 'Bill Pay', 'Auto Pay'] },
  { name: 'Ecommerce', tags: ['Online Purchase', 'Card Transaction'] },
  { name: 'Other', tags: ['Non-Descript Revenue', 'Miscellaneous', 'Uncategorized'] },
];

export interface ParsedStatement {
  accountNumber: string;
  accountName: string;
  statementPeriod: string;
  transactions: TransactionRow[];
  beginningBalance: number | null;
  endingBalance: number | null;
}
