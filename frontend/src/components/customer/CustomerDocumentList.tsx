import { useState, useEffect } from 'react';
import api from '../../services/api';

export interface CustomerDocument {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  document_type: string | null;
  created_at: string;
  balance_summary?: {
    beginning: number | null;
    ending: number | null;
  };
  transaction_summary?: Record<string, number>;
  mca_summary?: {
    transactions: number;
    amount: number;
    providers?: string[];
  };
  ai_summary?: {
    qualification_score: number | null;
    recommendation: string | null;
  };
}

interface CustomerDocumentListProps {
  onSelectDocument?: (id: number) => void;
  refreshTrigger?: number;
}

export function CustomerDocumentList({ onSelectDocument, refreshTrigger = 0 }: CustomerDocumentListProps) {
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [refreshTrigger]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/customer/documents');
      setDocuments(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this document?')) return;

    try {
      await api.delete(`/customer/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete document');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Complete
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            Failed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            Processing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Pending
          </span>
        );
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 text-sm">{error}</p>
        <button onClick={fetchDocuments} className="mt-3 text-sm text-red-600 underline">
          Try again
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-500 font-medium">No documents yet</p>
        <p className="text-sm text-gray-400 mt-1">Upload your first bank statement to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          {documents.length} Document{documents.length !== 1 ? 's' : ''}
        </h3>
        <button
          onClick={fetchDocuments}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            onClick={() => onSelectDocument?.(doc.id)}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  doc.status === 'complete' ? 'bg-green-100 text-green-700' :
                  doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                  doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={doc.filename}>
                    {doc.filename}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(doc.created_at)}</p>
                </div>
              </div>
              {getStatusBadge(doc.status)}
            </div>

            {/* Document Stats */}
            {doc.status === 'complete' && (
              <div className="space-y-2 pt-3 border-t border-gray-100">
                {doc.balance_summary?.ending && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Ending Balance</span>
                    <span className="font-medium text-gray-700">{formatCurrency(doc.balance_summary.ending)}</span>
                  </div>
                )}
                {doc.mca_summary && doc.mca_summary.transactions > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">MCA Payments</span>
                    <span className="font-medium text-orange-600">
                      {doc.mca_summary.transactions} ({formatCurrency(doc.mca_summary.amount)})
                    </span>
                  </div>
                )}
                {doc.ai_summary?.qualification_score !== null && doc.ai_summary?.qualification_score !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Risk Score</span>
                    <span className={`font-medium ${
                      doc.ai_summary.qualification_score >= 7 ? 'text-green-600' :
                      doc.ai_summary.qualification_score >= 4 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {doc.ai_summary.qualification_score}/10
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 mt-3">
              {onSelectDocument && (
                <button className="text-xs text-gray-600 hover:text-gray-900 font-medium">
                  View Details
                </button>
              )}
              <button
                onClick={(e) => handleDelete(doc.id, e)}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
