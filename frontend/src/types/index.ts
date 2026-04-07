// Barrel export — re-export all public types

// Extraction / server response shapes
export type {
  ExtractionState,
  ExtractionResult,
  AiAnalysis,
  KeyDetail,
  Recommendation,
  McaTransaction,
  McaFindings,
  TransactionTag,
  ClassifiedTransaction,
  TransactionClassificationSummary,
  TransactionClassificationResult,
  ProgressResponse,
  BatchEntry,
} from './extraction';

// Transaction shapes
export type { TransactionRow, ParsedStatement } from './transactions';
export { TAG_CATEGORIES } from './transactions';

// API response shapes
export type { Document, Batch, BatchDocument } from './api';

// Export types
export type { ExportType, ExportOption, TransactionData } from './export';
export { EXPORT_OPTIONS } from './export';
