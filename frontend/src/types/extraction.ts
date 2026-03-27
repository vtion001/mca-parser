export interface ExtractionState {
  jobId: string | null;
  status: 'idle' | 'processing' | 'complete' | 'failed';
  stage: string;
  stageLabel: string;
  progressPercent: number;
  currentMarkdown: string;
  result: ExtractionResult | null;
  error: string | null;
}

export interface ExtractionResult {
  markdown: string;
  document_type: {
    type: string;
    confidence: number;
  };
  key_details: KeyDetail[];
  scores: {
    completeness: number;
    quality: number;
    pii_detection: number;
    overall: number;
  };
  pii_breakdown?: {
    ssn: { found: boolean; label: string };
    email: { found: boolean; label: string };
    phone: { found: boolean; label: string };
  };
  recommendations: Recommendation[];
  balances?: {
    beginning_balance: {
      amount: number | null;
      keyword: string | null;
      raw_text: string | null;
    };
    ending_balance: {
      amount: number | null;
      keyword: string | null;
      raw_text: string | null;
    };
  };
  ai_analysis?: {
    success: boolean;
    analysis: AiAnalysis | null;
    error?: string;
  };
  page_count: number;
}

export interface AiAnalysis {
  qualification_score: number;
  is_valid_document: boolean;
  completeness: {
    score: number;
    is_complete: boolean;
    concerns: string[];
  };
  pii_found: {
    has_ssn: boolean;
    has_account_numbers: boolean;
    locations: string[];
  };
  transaction_summary: {
    credit_count: number | null;
    debit_count: number | null;
    total_amount_credits: number | null;
    total_amount_debits: number | null;
  };
  risk_indicators: {
    has_large_unusual_transactions: boolean;
    has_overdraft_signs: boolean;
    has_high_fee_pattern: boolean;
    has_returned_items: boolean;
    details: string[];
  };
  recommendations: string[];
}

export interface KeyDetail {
  field: string;
  label: string;
  value: string;
  page: number;
  confidence: number;
  matched_pattern: string;
}

export interface Recommendation {
  type: 'quality' | 'completeness' | 'pii' | 'structure';
  message: string;
}

export interface ProgressResponse {
  job_id: string;
  status: 'processing' | 'complete' | 'failed';
  stage: string;
  stage_label: string;
  progress_percent: number;
  current_markdown: string | null;
  result: ExtractionResult | null;
  error?: string;
}
