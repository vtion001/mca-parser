import type { ExtractionResult } from '../../types/extraction';

// ─── Core row type ─────────────────────────────────────────────────────────

export interface StatementRow {
  id: number;
  accountNumber: string;
  accountType: string;
  period: string;
  beginningBalance: number | null;
  endingBalance: number | null;
  totalCredits: number | null;
  creditCount: number | null;
  totalDebits: number | null;
  debitCount: number | null;
  calculatedBalance: number | null;
  difference: number | null;
  nsfCount: number;
  confidence: number;
  originalFilename: string;
  createdAt: string;
  result: ExtractionResult;
}

// ─── Component prop types ─────────────────────────────────────────────────

export interface StatementCardProps {
  row: StatementRow;
  index: number;
  onReview?: (row: StatementRow) => void;
  onDelete?: (id: number) => void;
}

export interface SparklineProps {
  credits: number | null;
  debits: number | null;
}

export interface StatementFiltersProps {
  totalCount: number;
  loading: boolean;
  onRefresh: () => void;
}

export interface StatementsViewProps {
  result: ExtractionResult | null;
  onReviewStatement?: (row: StatementRow) => void;
}
