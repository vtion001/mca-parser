import { useCallback, useRef } from 'react';
import api from '../services/api';
import { isAxiosError } from 'axios';
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

      // Throttle: only update markdown if it has changed (string comparison)
      // This prevents unnecessary re-renders when content hasn't changed
      let lastMarkdownLength = 0;

      pollingRef.current = setInterval(async () => {
        try {
          const response = await api.get<ProgressResponse>(`/pdf/progress/${jobId}`);
          const data = response.data;
          consecutiveErrorsRef.current = 0; // reset on success

          // Only update markdown if it actually changed - skip DOM update if identical
          const newMarkdown = data.current_markdown || '';
          const markdownChanged = newMarkdown.length !== lastMarkdownLength;
          if (markdownChanged) {
            lastMarkdownLength = newMarkdown.length;
          }

          setState(prev => ({
            ...prev,
            status: data.status,
            stage: data.stage,
            stageLabel: data.stage_label,
            progressPercent: data.progress_percent,
            currentMarkdown: markdownChanged ? newMarkdown : prev.currentMarkdown,
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
          if (isAxiosError(err) && err.response?.status === 404) {
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
      }, 1500); // Increased from 500ms to 1500ms to reduce main thread blocking
    });
  }, [setState, clearPolling, pollingRef]);

  return { pollProgress };
}
