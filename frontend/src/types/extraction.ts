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
  recommendations: Recommendation[];
  page_count: number;
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
