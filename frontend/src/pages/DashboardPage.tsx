import { useState, useCallback, lazy, Suspense } from 'react';
import { ThemeProvider } from '../hooks/useTheme';
import { useExtractionContext } from '../contexts/ExtractionContext';
import {
  UploadSection,
  SettingsPanel,
  StatementsView,
  DocumentDetailPanel,
  ErrorBoundary,
} from '../components';
import { Header } from '../components/layout/Header';
import type { ExtractionResult } from '../types/extraction';
import type { User } from './LoginPage';

const ReviewModal = lazy(() => import('../components/ReviewModal').then(m => ({ default: m.ReviewModal })));

type View = 'upload' | 'library';

export function DashboardPage({ user }: { user: User }) {
  const [activeView, setActiveView] = useState<View>('upload');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<ExtractionResult | null>(null);
  const { state } = useExtractionContext();

  const handleCloseDetail = useCallback(() => {
    setSelectedDocumentId(null);
  }, []);

  const handleCloseReview = useCallback(() => {
    setSelectedResult(null);
  }, []);

  const handleReviewStatement = useCallback((result: ExtractionResult) => {
    setSelectedResult(result);
  }, []);

  if (!user) return null;

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white">
        <Header
          user={user}
          activeView={activeView}
          onViewChange={setActiveView}
        />

        <main className="max-w-6xl mx-auto px-8 py-8">
          {activeView === 'upload' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2">
                <UploadSection />
              </div>
              <div>
                <SettingsPanel />
              </div>
            </div>
          )}

          {activeView === 'library' && (
            <StatementsView
              result={state.result}
              onReviewStatement={handleReviewStatement}
            />
          )}
        </main>

        <footer className="max-w-6xl mx-auto px-8 py-6 border-t border-bw-100">
          <p className="text-xs text-bw-400 text-center">
            Dave · Powered by Alliance Global Solutions
          </p>
        </footer>
      </div>

      <DocumentDetailPanel
        documentId={selectedDocumentId}
        onClose={handleCloseDetail}
      />

      {selectedResult && (
        <ErrorBoundary
          fallback={
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90">
              <div className="text-center">
                <p className="text-sm text-bw-900 font-semibold mb-1">Review modal failed to load</p>
                <p className="text-xs text-bw-400 mb-3">Try refreshing the page</p>
                <button onClick={handleCloseReview} className="px-4 py-2 text-xs font-medium text-white bg-bw-900 rounded-lg">
                  Close
                </button>
              </div>
            </div>
          }
        >
          <Suspense fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-bw-200 border-t-bw-900 rounded-full animate-spin" />
                <p className="text-xs text-bw-400">Loading review...</p>
              </div>
            </div>
          }>
            <ReviewModal
              result={selectedResult}
              onClose={handleCloseReview}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </ThemeProvider>
  );
}
