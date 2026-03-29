import type { ExtractionResult } from '../../types/extraction';
import type { TransactionRow } from '../../types/transactions';

// ─── ReviewModal props ─────────────────────────────────────────────────────────

export interface ReviewModalProps {
  result: ExtractionResult;
  onClose: () => void;
}

// ─── Filter tab ───────────────────────────────────────────────────────────────

export type FilterTab = 'all' | 'transfers' | 'wires' | 'credits' | 'debits' | 'mca';

export interface FilterTabDef {
  id: FilterTab;
  label: string;
}

// ─── Filter counts ─────────────────────────────────────────────────────────────

export interface FilterCounts {
  all: number;
  transfers: number;
  wires: number;
  credits: number;
  debits: number;
  mca: number;
}

// ─── Balance summary ──────────────────────────────────────────────────────────

export interface BalanceSummary {
  begBal: number | null;
  endBal: number | null;
  debits: number;
  credits: number;
}

// ─── Tag editor props ─────────────────────────────────────────────────────────

export interface TagEditorModalProps {
  transaction: TransactionRow;
  onSave: (tags: string[]) => void;
  onClose: () => void;
}
