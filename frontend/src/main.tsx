import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './hooks/useTheme';
import { Header, UploadSection, SettingsPanel } from './components';
import './styles/globals.css';

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="max-w-6xl mx-auto px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <UploadSection />
            </div>
            <div>
              <SettingsPanel />
            </div>
          </div>
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
