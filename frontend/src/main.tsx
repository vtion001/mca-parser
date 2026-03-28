import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { ExtractionProvider, useExtractionContext } from './contexts/ExtractionContext';
import {
  Header,
  UploadSection,
  SettingsPanel,
  StatementsView,
  DocumentDetailPanel,
  ReviewModal,
} from './components';
import './styles/globals.css';

type View = 'upload' | 'library';

function App() {
  const [activeView, setActiveView] = useState<View>('upload');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<import('./types/extraction').ExtractionResult | null>(null);
  const { state } = useExtractionContext();

  const navItems: { id: View; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'library', label: 'Statements' },
  ];

  const handleCloseDetail = () => {
    setSelectedDocumentId(null);
  };

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
              onReviewStatement={(result) => setSelectedResult(result)}
            />
          )}
        </main>

        <footer className="max-w-6xl mx-auto px-8 py-8 border-t border-bw-100">
          <p className="text-xs text-bw-400 text-center">
            MCA PDF Scrubber. Process your documents securely.
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
        <ReviewModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ExtractionProvider>
    <App />
  </ExtractionProvider>
);
