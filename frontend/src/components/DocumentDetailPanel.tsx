import { useEffect, useState } from 'react';
import axios from 'axios';
import { MarkdownViewer } from './MarkdownViewer';
import { KeyDetailsPanel } from './KeyDetailsPanel';
import { ScoreDashboard } from './ScoreDashboard';
import { AnalysisResults } from './AnalysisResults';
import type { ExtractionResult } from '../types/extraction';

interface DocumentDetailPanelProps {
  documentId: number | null;
  onClose: () => void;
}

interface DocumentData {
  id: number;
  filename: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  document_type: string | null;
  type_confidence: number | null;
  balances: ExtractionResult['balances'];
  ai_analysis: ExtractionResult['ai_analysis'];
  markdown: string | null;
  key_details: ExtractionResult['key_details'];
  scores: ExtractionResult['scores'] | null;
  pii_breakdown: ExtractionResult['pii_breakdown'];
  recommendations: ExtractionResult['recommendations'];
  page_count: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function DocumentDetailPanel({ documentId, onClose }: DocumentDetailPanelProps) {
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'markdown' | 'analysis'>('overview');

  useEffect(() => {
    if (!documentId) return;

    setLoading(true);
    setError(null);
    setDocument(null);

    axios.get(`/api/v1/documents/${documentId}`)
      .then(res => {
        setDocument(res.data.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load document');
        setLoading(false);
      });
  }, [documentId]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    globalThis.document.addEventListener('keydown', handler);
    return () => globalThis.document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!documentId) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const result: ExtractionResult | null = document ? {
    markdown: document.markdown || '',
    document_type: {
      type: document.document_type || 'unknown',
      confidence: document.type_confidence || 0,
    },
    key_details: document.key_details || [],
    scores: document.scores || { completeness: 0, quality: 0, pii_detection: 0, overall: 0 },
    pii_breakdown: document.pii_breakdown,
    recommendations: document.recommendations || [],
    balances: document.balances,
    ai_analysis: document.ai_analysis,
    page_count: document.page_count || 0,
  } : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in">

        {/* Header */}
        <div className="flex-shrink-0 border-b border-bw-100 px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                document?.status === 'complete' ? 'bg-green-50 text-green-700 border border-green-200' :
                document?.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
                document?.status === 'processing' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                'bg-gray-50 text-gray-600 border border-gray-200'
              }`}>
                {document?.status === 'complete' ? '✓' : document?.status === 'failed' ? '✗' : document?.status === 'processing' ? '◌' : '○'}
                <span className="ml-1 capitalize">{document?.status || 'loading'}</span>
              </span>
              {document?.document_type && (
                <span className="text-xs text-bw-400 capitalize">
                  {document.document_type.replace('_', ' ')}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-bw-900 truncate" title={document?.original_filename}>
              {document?.original_filename || 'Loading...'}
            </h2>
            {document && (
              <p className="text-xs text-bw-400 mt-0.5">
                Processed {formatDate(document.created_at)}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 hover:bg-bw-50 rounded-lg transition-colors text-bw-400 hover:text-bw-700"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex-shrink-0 border-b border-bw-100 px-6">
          <div className="flex gap-1">
            {[
              { id: 'overview' as const, label: 'Overview' },
              { id: 'markdown' as const, label: 'Extracted Text' },
              { id: 'analysis' as const, label: 'AI Analysis' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-bw-900'
                    : 'text-bw-400 hover:text-bw-600'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-7 h-7 border-2 border-black border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="mx-6 mt-8 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && document?.status === 'failed' && (
            <div className="mx-6 mt-8 p-6 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg mt-0.5">✗</span>
                <div>
                  <p className="text-sm font-semibold text-red-800">Extraction Failed</p>
                  <p className="text-sm text-red-600 mt-1">{document.error || 'An unknown error occurred during processing.'}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && result && document?.status === 'complete' && activeTab === 'overview' && (
            <div className="px-6 py-5 space-y-5">
              {/* Balance Summary Strip */}
              {result.balances && (
                <div className="bg-bw-50 border border-bw-100 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest mb-1">Beginning Balance</p>
                      <p className="text-xl font-semibold text-bw-900 font-mono">
                        {result.balances.beginning_balance.amount !== null
                          ? `$${result.balances.beginning_balance.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest mb-1">Ending Balance</p>
                      <p className="text-xl font-semibold text-bw-900 font-mono">
                        {result.balances.ending_balance.amount !== null
                          ? `$${result.balances.ending_balance.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk / Score Badge */}
              {result.ai_analysis?.analysis && (
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                    result.ai_analysis.analysis.qualification_score >= 7
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : result.ai_analysis.analysis.qualification_score >= 4
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    Score {result.ai_analysis.analysis.qualification_score}/10
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    result.ai_analysis.analysis.is_valid_document
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {result.ai_analysis.analysis.is_valid_document ? 'Valid Document' : 'May Not Be Valid'}
                  </div>
                </div>
              )}

              {/* Key Details */}
              {result.key_details.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">Extracted Fields</h3>
                  <div className="space-y-2">
                    {result.key_details.slice(0, 8).map((detail, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-bw-50 last:border-0">
                        <span className="text-xs text-bw-400 flex-shrink-0">{detail.label}</span>
                        <span className="text-xs font-medium text-bw-800 text-right truncate" title={detail.value}>{detail.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scores */}
              {result.scores && (
                <div>
                  <h3 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">Quality Scores</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Completeness', value: result.scores.completeness },
                      { label: 'Quality', value: result.scores.quality },
                      { label: 'PII Detection', value: result.scores.pii_detection },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-bw-50 border border-bw-100 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-bw-400 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-lg font-semibold text-bw-900">{(value * 10).toFixed(0)}</p>
                        <div className="mt-1.5 h-1 bg-bw-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black rounded-full transition-all"
                            style={{ width: `${value * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">Recommendations</h3>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-bw-600">
                        <span className="w-4 h-4 rounded-full bg-bw-100 text-bw-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-medium">{i + 1}</span>
                        {'message' in rec ? rec.message : String(rec)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* View Full Analysis Button */}
              <button
                onClick={() => setActiveTab('analysis')}
                className="w-full py-2.5 border-2 border-bw-200 rounded-lg text-sm font-medium text-bw-600 hover:border-bw-400 hover:text-bw-900 transition-colors"
              >
                View Full AI Analysis
              </button>
            </div>
          )}

          {!loading && !error && result && activeTab === 'markdown' && (
            <div className="px-6 py-5">
              {result.markdown ? (
                <MarkdownViewer markdown={result.markdown} />
              ) : (
                <div className="text-center py-16 text-bw-400 text-sm">
                  No extracted text available
                </div>
              )}
            </div>
          )}

          {!loading && !error && result && activeTab === 'analysis' && (
            <div className="px-6 py-5 space-y-5">
              <KeyDetailsPanel
                details={result.key_details}
                documentType={result.document_type.type}
                typeConfidence={result.document_type.confidence}
              />
              <ScoreDashboard
                scores={result.scores}
                pii_breakdown={result.pii_breakdown}
                recommendations={result.recommendations}
              />
              <AnalysisResults result={result} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
}
