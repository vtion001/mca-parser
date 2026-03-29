import { useState, useCallback, useRef } from 'react';
import type { ExtractionState } from '../types/extraction';

export const INITIAL_STATE: ExtractionState = {
  jobId: null,
  status: 'idle',
  stage: '',
  stageLabel: '',
  progressPercent: 0,
  currentMarkdown: '',
  result: null,
  error: null,
};

export interface BatchEntry {
  filename: string;
  result: ExtractionState['result'];
  status: 'complete' | 'failed';
  error?: string;
}

export function useExtractionState() {
  const [state, setState] = useState<ExtractionState>(INITIAL_STATE);
  const [batchResults, setBatchResults] = useState<BatchEntry[]>([]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentFileIndexRef = useRef<number>(0);
  const remainingFilesRef = useRef<File[]>([]);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearPolling();
    setBatchResults([]);
    currentFileIndexRef.current = 0;
    remainingFilesRef.current = [];
    setState(INITIAL_STATE);
  }, [clearPolling]);

  return {
    state,
    setState,
    batchResults,
    setBatchResults,
    pollingRef,
    currentFileIndexRef,
    remainingFilesRef,
    clearPolling,
    reset,
  };
}
