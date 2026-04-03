import { useEffect, useState } from 'react';
import api from '../services/api';
import { DetailTabNav, type DetailTabId } from './detail/DetailTabNav';
import { DetailMarkdownTab } from './detail/DetailMarkdownTab';
import { DetailKeyDetailsTab } from './detail/DetailKeyDetailsTab';
import { DetailScoresTab } from './detail/DetailScoresTab';
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
  const [activeTab, setActiveTab] = useState<DetailTabId>('markdown');

  useEffect(() => {
    if (!documentId) return;

    setLoading(true);
    setError(null);
    setDocument(null);

    api.get(`/documents/${documentId}`)
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

  const renderPiiTab = () => {
    if (!result?.pii_breakdown) {
      return (
        <div className="px-6 py-5">
          <div className="text-center py-16 text-bw-400 text-sm">
            No PII breakdown available
          </div>
        </div>
      );
    }

    return (
      <div className="px-6 py-5">
        <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-bw-100">
            <h3 className="text-sm font-semibold text-bw-700">PII Detection Results</h3>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-3">
              {result.pii_breakdown.ssn && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm ${
                  result.pii_breakdown.ssn.found
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${result.pii_breakdown.ssn.found ? 'bg-red-500' : 'bg-gray-400'}`} />
                  <span className="font-medium">{result.pii_breakdown.ssn.label}</span>
                  <span className="text-xs opacity-75">{result.pii_breakdown.ssn.found ? 'Found' : 'Not found'}</span>
                </div>
              )}
              {result.pii_breakdown.email && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm ${
                  result.pii_breakdown.email.found
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${result.pii_breakdown.email.found ? 'bg-red-500' : 'bg-gray-400'}`} />
                  <span className="font-medium">{result.pii_breakdown.email.label}</span>
                  <span className="text-xs opacity-75">{result.pii_breakdown.email.found ? 'Found' : 'Not found'}</span>
                </div>
              )}
              {result.pii_breakdown.phone && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm ${
                  result.pii_breakdown.phone.found
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${result.pii_breakdown.phone.found ? 'bg-red-500' : 'bg-gray-400'}`} />
                  <span className="font-medium">{result.pii_breakdown.phone.label}</span>
                  <span className="text-xs opacity-75">{result.pii_breakdown.phone.found ? 'Found' : 'Not found'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
        <DetailTabNav activeTab={activeTab} onTabChange={setActiveTab} />

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

          {!loading && !error && result && document?.status === 'complete' && (
            <>
              {activeTab === 'markdown' && (
                <DetailMarkdownTab markdown={result.markdown} />
              )}

              {activeTab === 'key_details' && (
                <DetailKeyDetailsTab
                  details={result.key_details}
                  documentType={result.document_type.type}
                  typeConfidence={result.document_type.confidence}
                />
              )}

              {activeTab === 'scores' && (
                <DetailScoresTab
                  scores={result.scores}
                  pii_breakdown={result.pii_breakdown}
                  recommendations={result.recommendations}
                />
              )}

              {activeTab === 'pii' && renderPiiTab()}

              {activeTab === 'ai' && (
                <div className="px-6 py-5">
                  <AnalysisResults result={result} />
                </div>
              )}
            </>
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
