import { useCallback, useRef } from 'react';
import axios from 'axios';
import type { ExtractionState, ProgressResponse } from '../types/extraction';

interface UseExtractionPollingDeps {
  setState: React.Dispatch<React.SetStateAction<ExtractionState>>;
  clearPolling: () => void;
  pollingRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
}

export function useExtractionPolling({ setState, clearPolling, pollingRef }: UseExtractionPollingDeps) {
  const consecutiveErrorsRef = useRef<number>(0);

  const pollProgress = useCallback(async (jobId: string): Promise<ProgressResponse | null> => {
    return new Promise((resolve) => {
      consecutiveErrorsRef.current = 0;
      const maxConsecutiveErrors = 10; // stop after 5s of 404s (job never picked up)

      pollingRef.current = setInterval(async () => {
        try {
          const response = await axios.get<ProgressResponse>(`/api/v1/pdf/progress/${jobId}`);
          const data = response.data;
          consecutiveErrorsRef.current = 0; // reset on success

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
          consecutiveErrorsRef.current++;
          // 404 means job dispatched but queue worker hasn't created cache entry yet
          // Keep polling — the worker will process it shortly
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            if (consecutiveErrorsRef.current >= maxConsecutiveErrors) {
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
  }, [setState, clearPolling, pollingRef]);

  return { pollProgress };
}
