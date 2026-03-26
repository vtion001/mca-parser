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

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(async (jobId: string) => {
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
      }
    } catch (error) {
      console.error('Polling error:', error);
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: 'Failed to get progress',
      }));
      clearPolling();
    }
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
        stage: 'uploading',
        stageLabel: 'Uploading PDF...',
        progressPercent: 5,
      }));

      pollingRef.current = setInterval(() => {
        pollProgress(jobId);
      }, 500);

      pollProgress(jobId);
    } catch (error) {
      console.error('Extraction start error:', error);
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: 'Failed to start extraction',
      }));
    }
  }, [pollProgress]);

  const reset = useCallback(() => {
    clearPolling();
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
    startExtraction,
    reset,
  };
}
