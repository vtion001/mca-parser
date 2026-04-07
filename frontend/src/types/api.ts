// Shared API response types for Document, Batch, and related structures

// ─── Document ────────────────────────────────────────────────────────────────

export interface Document {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  document_type: string | null;
  type_confidence: number | null;
  balances: {
    beginning_balance: { amount: number | null };
    ending_balance: { amount: number | null };
  } | null;
  ai_analysis: {
    qualification_score: number;
  } | null;
  created_at: string;
}

// ─── Batch ───────────────────────────────────────────────────────────────────

export interface BatchDocument {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  balances: {
    beginning_balance: { amount: number | null };
    ending_balance: { amount: number | null };
  } | null;
  ai_analysis: {
    qualification_score: number;
  } | null;
}

export interface Batch {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  total_documents: number;
  completed_documents: number;
  documents: BatchDocument[];
}
