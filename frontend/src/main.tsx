import ReactDOM from 'react-dom/client';
import { useState } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import {
  Header,
  UploadSection,
  SettingsPanel,
  DocumentLibrary,
  BatchProcessor,
  ComparativeView
} from './components';
import './styles/globals.css';

type View = 'upload' | 'library' | 'batch' | 'compare';

function App() {
  const [activeView, setActiveView] = useState<View>('upload');

  const navItems: { id: View; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'library', label: 'Document Library' },
    { id: 'batch', label: 'Batch Processing' },
    { id: 'compare', label: 'Comparative Analysis' },
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
            <DocumentLibrary
              selectedIds={[]}
              onToggleSelect={() => {}}
              selectionMode={false}
            />
          )}

          {/* Batch Processing View */}
          {activeView === 'batch' && <BatchProcessor />}

          {/* Comparative Analysis View */}
          {activeView === 'compare' && <ComparativeView />}
        </main>

        <footer className="max-w-6xl mx-auto px-8 py-8 border-t border-bw-100">
          <p className="text-xs text-bw-400 text-center">
            MCA PDF Scrubber. Process your documents securely.
          </p>
        </footer>
      </div>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
