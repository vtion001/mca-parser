import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface MarkdownViewerProps {
  markdown: string;
}

export function MarkdownViewer({ markdown }: MarkdownViewerProps) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-bw-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-bw-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-bw-700">Raw Markdown</span>
        </div>
        <svg
          className={`w-5 h-5 text-bw-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-bw-700 bg-bw-50 p-4 rounded-lg border border-bw-100 overflow-auto max-h-96 font-mono">
            {markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
