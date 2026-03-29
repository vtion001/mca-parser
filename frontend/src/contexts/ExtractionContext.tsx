import { createContext, useContext, type ReactNode } from 'react';
import { useExtraction } from '../hooks/useExtraction';

interface BatchEntry {
  filename: string;
  result: import('../types/extraction').ExtractionState['result'];
  status: 'complete' | 'failed';
  error?: string;
}

interface ExtractionContextValue {
  state: import('../types/extraction').ExtractionState;
  batchResults: BatchEntry[];
  startExtraction: (file: File) => Promise<void>;
  startBatchExtraction: (files: File[]) => Promise<void>;
  reset: () => void;
}

const ExtractionContext = createContext<ExtractionContextValue | null>(null);

export function ExtractionProvider({ children }: { children: ReactNode }) {
  const { state, batchResults, startExtraction, startBatchExtraction, reset } = useExtraction();

  return (
    <ExtractionContext.Provider value={{ state, batchResults, startExtraction, startBatchExtraction, reset }}>
      {children}
    </ExtractionContext.Provider>
  );
}

export function useExtractionContext(): ExtractionContextValue {
  const ctx = useContext(ExtractionContext);
  if (!ctx) throw new Error('useExtractionContext must be used inside ExtractionProvider');
  return ctx;
}
