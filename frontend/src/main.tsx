import ReactDOM from 'react-dom/client';
import { useState, useCallback } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { ExtractionProvider, useExtractionContext } from './contexts/ExtractionContext';
import {
  Header,
  UploadSection,
  SettingsPanel,
  StatementsView,
  DocumentDetailPanel,
  ReviewModal,
  ErrorBoundary,
} from './components';
import './styles/globals.css';

type View = 'upload' | 'library';

function App() {
  const [activeView, setActiveView] = useState<View>('upload');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<import('./types/extraction').ExtractionResult | null>(null);
  const { state } = useExtractionContext();

  // ─── Stable callbacks (prevent effect churn and React reconciler instability) ───
  const handleCloseDetail = useCallback(() => {
    setSelectedDocumentId(null);
  }, []);

  const handleCloseReview = useCallback(() => {
    setSelectedResult(null);
  }, []);

  const handleReviewStatement = useCallback((result: import('./types/extraction').ExtractionResult) => {
    setSelectedResult(result);
  }, []);

  const navItems: { id: View; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'library', label: 'Statements' },
  ];

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white">
        <Header />

        {/* Navigation Tabs */}
        <nav className="border-b border-bw-100">
          <div className="max-w-6xl mx-auto px-8">
            <div className="flex gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                    activeView === item.id
                      ? 'text-bw-900'
                      : 'text-bw-400 hover:text-bw-600'
                  }`}
                >
                  {item.label}
                  {activeView === item.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-8 py-8">
          {/* Upload View */}
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

          {/* Document Library View */}
          {activeView === 'library' && (
            <StatementsView
              result={state.result}
              onReviewStatement={handleReviewStatement}
            />
          )}
        </main>

        <footer className="max-w-6xl mx-auto px-8 py-8 border-t border-bw-100">
          <p className="text-xs text-bw-400 text-center">
            Doc Scrappy · Powered by Alliance Global Solutions
          </p>
        </footer>
      </div>

      {/* Document Detail Slide-Over Panel */}
      <DocumentDetailPanel
        documentId={selectedDocumentId}
        onClose={handleCloseDetail}
      />

      {/* Review Modal — full-screen slide-over for statement details */}
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
          <ReviewModal
            result={selectedResult}
            onClose={handleCloseReview}
          />
        </ErrorBoundary>
      )}
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ExtractionProvider>
    <App />
  </ExtractionProvider>
);
