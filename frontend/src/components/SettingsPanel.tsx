import { useTheme } from '../hooks/useTheme';
import { fontSizes, type FontSizeName } from '../styles/themes';

export function SettingsPanel() {
  const { fontSize, setFontSize } = useTheme();

  return (
    <div className="bg-white rounded-xl p-8 border border-bw-100 shadow-card">
      <h3 className="text-sm font-semibold tracking-wide uppercase text-bw-900 mb-6">Preferences</h3>

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-medium text-bw-500 uppercase tracking-wider mb-3">
            Font Size
          </label>
          <div className="flex gap-3">
            {(Object.keys(fontSizes) as FontSizeName[]).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 border ${
                  fontSize === size
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-bw-600 border-bw-200 hover:border-bw-400'
                }`}
              >
                {size === 'small' ? 'Small' : 'Large'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-bw-100">
        <h4 className="text-xs font-medium text-bw-500 uppercase tracking-wider mb-3">About</h4>
        <p className="text-sm text-bw-400 leading-relaxed">
          Doc Scrappy uses advanced document analysis to detect and remove personally identifiable information from your PDFs.
        </p>
      </div>
    </div>
  );
}
