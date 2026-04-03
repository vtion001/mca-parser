import ReactDOM from 'react-dom/client';
import { useState, useCallback } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { ExtractionProvider, useExtractionContext } from './contexts/ExtractionContext';
import {
  UploadSection,
  SettingsPanel,
  StatementsView,
  DocumentDetailPanel,
  ReviewModal,
  ErrorBoundary,
} from './components';
import { authApi } from './services/api';
import './styles/globals.css';

type View = 'upload' | 'library';

interface User {
  id: number;
  name: string;
  email: string;
  account_id: number;
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      if (data.success) {
        const user = data.data;
        localStorage.setItem('user', JSON.stringify(user));
        onLogin(user);
      } else {
        setError(data.error || 'Login failed.');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left side - Logo/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-bw-50 flex-col items-center justify-center p-12">
        <div className="max-w-md text-center">
          <img
            src="https://res.cloudinary.com/dbviya1rj/image/upload/q_auto/f_auto/v1775139333/kmdolpscb6piob3qslgt.png"
            alt="Dave Logo"
            className="w-120 h-120 object-contain mx-auto mb-4"
          />  
          <h1 className="text-3xl font-bold text-bw-900 mb-4">Dave</h1>
          <p className="text-bw-500 text-lg leading-relaxed">
            Secure document processing and analysis powered by advanced AI technology.
            Extract, analyze, and manage your documents with confidence.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="w-10 h-10 bg-bw-100 rounded-lg flex items-center justify-center mb-3 mx-auto">
                <svg className="w-5 h-5 text-bw-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-bw-700">PDF Processing</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="w-10 h-10 bg-bw-100 rounded-lg flex items-center justify-center mb-3 mx-auto">
                <svg className="w-5 h-5 text-bw-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-bw-700">PII Scrubbing</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="w-10 h-10 bg-bw-100 rounded-lg flex items-center justify-center mb-3 mx-auto">
                <svg className="w-5 h-5 text-bw-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-bw-700">AI Analysis</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="w-10 h-10 bg-bw-100 rounded-lg flex items-center justify-center mb-3 mx-auto">
                <svg className="w-5 h-5 text-bw-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-bw-700">Secure Storage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <img
              src="https://res.cloudinary.com/dbviya1rj/image/upload/q_auto/f_auto/v1775139333/kmdolpscb6piob3qslgt.png"
              alt="Dave"
              className="w-20 h-20 object-contain mx-auto mb-4"
            />
            <h1 className="text-xl font-bold text-bw-900">Dave</h1>
          </div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-bw-900">Welcome back</h2>
            <p className="text-sm text-bw-400 mt-1">Sign in to your account</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-bw-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-bw-200 rounded-lg text-sm text-bw-900 focus:outline-none focus:border-bw-900 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-bw-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-bw-200 rounded-lg text-sm text-bw-900 focus:outline-none focus:border-bw-900 transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-bw-900 text-white text-sm font-semibold rounded-lg hover:bg-bw-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-xs text-bw-400 mt-6">
            Powered by Alliance Global Solutions
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeView, setActiveView] = useState<View>('upload');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<import('./types/extraction').ExtractionResult | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const { state } = useExtractionContext();

  const handleCloseDetail = useCallback(() => {
    setSelectedDocumentId(null);
  }, []);

  const handleCloseReview = useCallback(() => {
    setSelectedResult(null);
  }, []);

  const handleReviewStatement = useCallback((result: import('./types/extraction').ExtractionResult) => {
    setSelectedResult(result);
  }, []);

  const handleLogout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const navItems: { id: View; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'library', label: 'Statements' },
  ];

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="py-6 px-8 border-b border-bw-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="https://res.cloudinary.com/dbviya1rj/image/upload/q_auto/f_auto/v1775139333/kmdolpscb6piob3qslgt.png"
              alt="Dave Logo"
              className="w-20 h-20 object-contain"
            />
            <div>
              <p className="text-sm font-semibold text-bw-900">Dave</p>
              <p className="text-xs text-bw-400">Powered by Alliance Global Solutions</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-bw-400">{user.name}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-bw-400 hover:text-bw-900 transition-colors underline"
            >
              Sign Out
            </button>
          </div>
        </header>

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
