import { useCallback } from 'react';
import api from '../services/api';
import { useExtractionState } from './useExtractionState';
import { useExtractionPolling } from './useExtractionPolling';

export function useExtraction() {
  const {
    state,
    setState,
    batchResults,
    setBatchResults,
    pollingRef,
    currentFileIndexRef,
    remainingFilesRef,
    clearPolling,
    reset,
  } = useExtractionState();

  const { pollProgress } = useExtractionPolling({ setState, clearPolling, pollingRef });

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
      const response = await api.post<{ job_id: string }>(
        '/pdf/full-extract',
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
    } catch {
      setState(prev => ({ ...prev, status: 'failed', error: 'Failed to start extraction' }));
    }
  }, [setState, pollProgress]);

  const startBatchExtraction = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Guard against re-entrancy - if already processing, ignore
    if (state.status === 'processing') return;

    setBatchResults([]);
    currentFileIndexRef.current = 0;
    remainingFilesRef.current = [...files];

    const processNext = async (): Promise<void> => {
      if (currentFileIndexRef.current >= remainingFilesRef.current.length) return;

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
        const response = await api.post<{ job_id: string }>(
          '/pdf/full-extract',
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
            error: progressData?.error ?? 'Extraction timed out or failed',
          };
          return updated;
        });

        currentFileIndexRef.current++;
        if (currentFileIndexRef.current < remainingFilesRef.current.length) {
          await processNext();
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Extraction failed';
        setBatchResults(prev => {
          const updated = [...prev];
          updated[fileIndex] = { filename: file.name, result: null, status: 'failed', error: errorMsg };
          return updated;
        });
        currentFileIndexRef.current++;
        if (currentFileIndexRef.current < remainingFilesRef.current.length) {
          await processNext();
        }
      }
    };

    await processNext();

    setState(prev => ({
      ...prev,
      status: 'complete',
      stage: 'complete',
      stageLabel: `Done — processed ${files.length} file${files.length !== 1 ? 's' : ''}`,
    }));
  }, [setState, setBatchResults, currentFileIndexRef, remainingFilesRef, pollProgress]);

  return {
    state,
    batchResults,
    startExtraction,
    startBatchExtraction,
    reset,
  };
}
