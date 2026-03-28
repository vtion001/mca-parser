import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import axios from 'axios';
import type { ExtractionState, ProgressResponse } from '../types/extraction';

interface BatchEntry {
  filename: string;
  result: ExtractionState['result'];
  status: 'complete' | 'failed';
  error?: string;
}

interface ExtractionContextValue {
  state: ExtractionState;
  batchResults: BatchEntry[];
  startExtraction: (file: File) => Promise<void>;
  startBatchExtraction: (files: File[]) => Promise<void>;
  reset: () => void;
}

const ExtractionContext = createContext<ExtractionContextValue | null>(null);

export function ExtractionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ExtractionState>({
    jobId: null,
    status: 'idle',
    stage: '',
    stageLabel: '',
    progressPercent: 0,
    currentMarkdown: '',
    result: null,
    error: null,
  });

  const [batchResults, setBatchResults] = useState<BatchEntry[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const currentFileIndexRef = useRef<number>(0);
  const remainingFilesRef = useRef<File[]>([]);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(async (jobId: string): Promise<ProgressResponse | null> => {
    return new Promise((resolve) => {
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 10; // stop after 5s of 404s (job never picked up)

      pollingRef.current = setInterval(async () => {
        try {
          const response = await axios.get<ProgressResponse>(`/api/v1/pdf/progress/${jobId}`);
          const data = response.data;
          consecutiveErrors = 0; // reset on success
          setState(prev => ({
            ...prev,
            status: data.status,
            stage: data.stage,
            stageLabel: data.stage_label,
            progressPercent: data.progress_percent,
            currentMarkdown: data.current_markdown || prev.currentMarkdown,
            result: data.result,
            error: data.error || null,
          }));
          if (data.status === 'complete' || data.status === 'failed') {
            clearPolling();
            resolve(data);
          }
        } catch (err) {
          consecutiveErrors++;
          // 404 means job dispatched but queue worker hasn't created cache entry yet
          // Keep polling — the worker will process it shortly
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            if (consecutiveErrors >= maxConsecutiveErrors) {
              clearPolling();
              setState(prev => ({
                ...prev,
                status: 'failed',
                error: 'Extraction timed out — queue worker may not be running. Check docker-compose.',
              }));
              resolve(null);
            }
            return; // keep polling
          }
          // Non-404 error (network, server error) — stop immediately
          clearPolling();
          setState(prev => ({
            ...prev,
            status: 'failed',
            error: 'Failed to poll extraction progress',
          }));
          resolve(null);
        }
      }, 500);
    });
  }, [clearPolling]);

  const startExtraction = useCallback(async (file: File) => {
    setState({
      jobId: null, status: 'processing', stage: 'uploading',
      stageLabel: 'Uploading PDF...', progressPercent: 0,
      currentMarkdown: '', result: null, error: null,
    });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post<{ job_id: string }>(
        '/api/v1/pdf/full-extract', formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const jobId = response.data.job_id;
      setState(prev => ({ ...prev, jobId, stage: 'processing', stageLabel: 'Extracting text...', progressPercent: 5 }));
      await pollProgress(jobId);
    } catch {
      setState(prev => ({ ...prev, status: 'failed', error: 'Failed to start extraction' }));
    }
  }, [pollProgress]);

  const startBatchExtraction = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setBatchResults([]);
    currentFileIndexRef.current = 0;
    remainingFilesRef.current = [...files];
    const processNext = async (): Promise<void> => {
      if (currentFileIndexRef.current >= remainingFilesRef.current.length) return;
      const file = remainingFilesRef.current[currentFileIndexRef.current];
      const fileIndex = currentFileIndexRef.current;
      setState({
        jobId: null, status: 'processing', stage: 'uploading',
        stageLabel: `Uploading ${file.name} (${fileIndex + 1}/${remainingFilesRef.current.length})...`,
        progressPercent: 0, currentMarkdown: '', result: null, error: null,
      });
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await axios.post<{ job_id: string }>(
          '/api/v1/pdf/full-extract', formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const jobId = response.data.job_id;
        setState(prev => ({ ...prev, jobId, stage: 'processing', stageLabel: `Extracting ${file.name}...`, progressPercent: 5 }));
        const progressData = await pollProgress(jobId);
        setBatchResults(prev => {
          const updated = [...prev];
          updated[fileIndex] = { filename: file.name, result: progressData?.result ?? null, status: progressData?.status === 'complete' ? 'complete' : 'failed', error: progressData?.error };
          return updated;
        });
        currentFileIndexRef.current++;
        if (currentFileIndexRef.current < remainingFilesRef.current.length) await processNext();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Extraction failed';
        setBatchResults(prev => {
          const updated = [...prev];
          updated[fileIndex] = { filename: file.name, result: null, status: 'failed', error: errorMsg };
          return updated;
        });
        currentFileIndexRef.current++;
        if (currentFileIndexRef.current < remainingFilesRef.current.length) await processNext();
      }
    };
    await processNext();
    setState(prev => ({ ...prev, status: 'complete', stage: 'complete', stageLabel: `Done — processed ${files.length} file${files.length !== 1 ? 's' : ''}` }));
  }, [pollProgress]);

  const reset = useCallback(() => {
    clearPolling();
    setBatchResults([]);
    currentFileIndexRef.current = 0;
    remainingFilesRef.current = [];
    setState({ jobId: null, status: 'idle', stage: '', stageLabel: '', progressPercent: 0, currentMarkdown: '', result: null, error: null });
  }, [clearPolling]);

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
