import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import type { ExtractionState, ProgressResponse } from '../types/extraction';

export function useExtraction() {
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

  const [batchResults, setBatchResults] = useState<Array<{
    filename: string;
    result: ExtractionState['result'];
    status: 'complete' | 'failed';
    error?: string;
  }>>([]);

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
      pollingRef.current = setInterval(async () => {
        try {
          const response = await axios.get<ProgressResponse>(`/api/v1/pdf/progress/${jobId}`);
          const data = response.data;

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
        } catch (error) {
          clearPolling();
          resolve(null);
        }
      }, 500);
    });
  }, [clearPolling]);

  const startExtraction = useCallback(async (file: File) => {
    setState({
      jobId: null,
      status: 'processing',
      stage: 'uploading',
      stageLabel: 'Uploading PDF...',
      progressPercent: 0,
      currentMarkdown: '',
      result: null,
      error: null,
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post<{ job_id: string; status: string }>(
        '/api/v1/pdf/full-extract',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const jobId = response.data.job_id;

      setState(prev => ({
        ...prev,
        jobId,
        stage: 'processing',
        stageLabel: 'Extracting text...',
        progressPercent: 5,
      }));

      await pollProgress(jobId);
    } catch (error) {
      console.error('Extraction start error:', error);
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: 'Failed to start extraction',
      }));
    }
  }, [pollProgress]);

  /**
   * Process multiple files sequentially.
   * Updates batchResults as each file completes so the UI can reflect progress.
   * Resolves when all files are done.
   */
  const startBatchExtraction = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setBatchResults([]);
    currentFileIndexRef.current = 0;
    remainingFilesRef.current = [...files];

    const processNext = async (): Promise<void> => {
      if (currentFileIndexRef.current >= remainingFilesRef.current.length) {
        return;
      }

      const file = remainingFilesRef.current[currentFileIndexRef.current];
      const fileIndex = currentFileIndexRef.current;

      setState({
        jobId: null,
        status: 'processing',
        stage: 'uploading',
        stageLabel: `Uploading ${file.name} (${fileIndex + 1}/${remainingFilesRef.current.length})...`,
        progressPercent: 0,
        currentMarkdown: '',
        result: null,
        error: null,
      });

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post<{ job_id: string; status: string }>(
          '/api/v1/pdf/full-extract',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );

        const jobId = response.data.job_id;

        setState(prev => ({
          ...prev,
          jobId,
          stage: 'processing',
          stageLabel: `Extracting ${file.name} (${fileIndex + 1}/${remainingFilesRef.current.length})...`,
          progressPercent: 5,
        }));

        const progressData = await pollProgress(jobId);

        setBatchResults(prev => {
          const updated = [...prev];
          updated[fileIndex] = {
            filename: file.name,
            result: progressData?.result ?? null,
            status: progressData?.status === 'complete' ? 'complete' : 'failed',
            error: progressData?.error,
          };
          return updated;
        });

        // Move to next file
        currentFileIndexRef.current++;
        if (currentFileIndexRef.current < remainingFilesRef.current.length) {
          await processNext();
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Extraction failed';
        setBatchResults(prev => {
          const updated = [...prev];
          updated[fileIndex] = {
            filename: file.name,
            result: null,
            status: 'failed',
            error: errorMsg,
          };
          return updated;
        });
        currentFileIndexRef.current++;
        if (currentFileIndexRef.current < remainingFilesRef.current.length) {
          await processNext();
        }
      }
    };

    await processNext();

    // Final state — mark complete if any results exist
    setState(prev => ({
      ...prev,
      status: 'complete',
      stage: 'complete',
      stageLabel: `Done — processed ${files.length} file${files.length !== 1 ? 's' : ''}`,
    }));
  }, [pollProgress]);

  const reset = useCallback(() => {
    clearPolling();
    setBatchResults([]);
    currentFileIndexRef.current = 0;
    remainingFilesRef.current = [];
    setState({
      jobId: null,
      status: 'idle',
      stage: '',
      stageLabel: '',
      progressPercent: 0,
      currentMarkdown: '',
      result: null,
      error: null,
    });
  }, [clearPolling]);

  return {
    state,
    batchResults,
    startExtraction,
    startBatchExtraction,
    reset,
  };
}
