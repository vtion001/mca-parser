import { useState, useEffect } from 'react';
import axios from 'axios';

interface Document {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  document_type: string | null;
  type_confidence: number | null;
  balances: {
    beginning_balance: { amount: number | null };
    ending_balance: { amount: number | null };
  } | null;
  ai_analysis: {
    qualification_score: number;
  } | null;
  created_at: string;
}

interface DocumentLibraryProps {
  onSelectDocument?: (id: number) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  selectionMode?: boolean;
}

export function DocumentLibrary({
  onSelectDocument,
  selectedIds = [],
  onToggleSelect,
  selectionMode = false
}: DocumentLibraryProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchDocuments();
  }, [filter, search]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (search) params.append('search', search);

      const response = await axios.get(`/api/v1/documents?${params.toString()}`);
      setDocuments(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      // Use mock data for demo
      setDocuments(getMockDocuments());
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this document?')) return;
    try {
      await axios.delete(`/api/v1/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-4 h-4 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return <span className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-50 border-green-200';
      case 'failed': return 'bg-red-50 border-red-200';
      case 'processing': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getRiskBadge = (doc: Document) => {
    const score = doc.ai_analysis?.qualification_score;
    if (score === undefined) return null;

    const level = score >= 7 ? 'low' : score >= 4 ? 'medium' : 'high';
    const colorClass = level === 'low'
      ? 'bg-green-100 text-green-700 border-green-200'
      : level === 'medium'
        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
        : 'bg-red-100 text-red-700 border-red-200';

    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${colorClass}`}>
        {level.toUpperCase()}
      </span>
    );
  };

  const getDocTypeIcon = (type: string | null) => {
    switch (type) {
      case 'bank_statement':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        );
      case 'receipt':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  const handleCardClick = (doc: Document) => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(doc.id);
    } else if (onSelectDocument) {
      onSelectDocument(doc.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="all">All Status</option>
          <option value="complete">Complete</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>

        <select
          onChange={e => setFilter(e.target.value === filter ? 'all' : e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">All Types</option>
          <option value="bank_statement">Bank Statements</option>
          <option value="receipt">Receipts</option>
        </select>

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        <div className="text-sm text-gray-500">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Document Grid/List */}
      {documents.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-xl">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">No documents found</p>
          <p className="text-sm text-gray-400 mt-1">Upload a PDF to get started</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {documents.map(doc => (
            <div
              key={doc.id}
              onClick={() => handleCardClick(doc)}
              className={`
                relative bg-white rounded-xl border p-4 cursor-pointer transition-all duration-150
                hover:shadow-lg hover:-translate-y-0.5
                ${selectedIds.includes(doc.id) ? 'ring-2 ring-black' : ''}
                ${getStatusColor(doc.status)}
              `}
            >
              {selectionMode && (
                <div className="absolute top-3 right-3">
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center
                    ${selectedIds.includes(doc.id)
                      ? 'bg-black border-black'
                      : 'border-gray-300'
                    }
                  `}>
                    {selectedIds.includes(doc.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 mb-3">
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${doc.status === 'complete' ? 'bg-green-100 text-green-700' :
                    doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                    doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }
                `}>
                  {getDocTypeIcon(doc.document_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" title={doc.filename}>
                    {doc.filename}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {doc.document_type?.replace('_', ' ') || 'Unknown'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(doc.status)}
                  <span className="text-xs font-medium capitalize">{doc.status}</span>
                </div>
                {getRiskBadge(doc)}
              </div>

              {doc.balances?.ending_balance?.amount && (
                <div className="text-sm font-mono mb-3">
                  <span className="text-gray-500">Balance:</span>{' '}
                  <span className="font-semibold">${doc.balances.ending_balance.amount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {new Date(doc.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
                {!selectionMode && (
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDocument?.(doc.id);
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-black transition-colors"
                      title="View"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map(doc => (
                <tr
                  key={doc.id}
                  onClick={() => handleCardClick(doc)}
                  className={`
                    hover:bg-gray-50 cursor-pointer transition-colors
                    ${selectedIds.includes(doc.id) ? 'bg-gray-50' : ''}
                  `}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {selectionMode && (
                        <div className={`
                          w-4 h-4 rounded border
                          ${selectedIds.includes(doc.id) ? 'bg-black border-black' : 'border-gray-300'}
                        `}>
                          {selectedIds.includes(doc.id) && (
                            <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
                      <div className={`
                        w-8 h-8 rounded flex items-center justify-center
                        ${doc.status === 'complete' ? 'bg-green-100 text-green-700' :
                          doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                          doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }
                      `}>
                        {getDocTypeIcon(doc.document_type)}
                      </div>
                      <span className="font-medium text-sm">{doc.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(doc.status)}
                      <span className="text-sm capitalize">{doc.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                    {doc.document_type?.replace('_', ' ') || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {doc.balances?.ending_balance?.amount
                      ? `$${doc.balances.ending_balance.amount.toLocaleString()}`
                      : '-'
                    }
                  </td>
                  <td className="px-4 py-3">
                    {getRiskBadge(doc) || <span className="text-gray-400 text-xs">-</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button className="p-1.5 hover:bg-gray-100 rounded text-gray-500">View</button>
                      <button
                        onClick={(e) => handleDelete(doc.id, e)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-600"
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 pt-4 border-t">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span>Complete</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Processing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>Failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-gray-300" />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}

// Mock data for demo
function getMockDocuments(): Document[] {
  return [
    {
      id: 1,
      filename: 'chase_account_nov2024.pdf',
      status: 'complete',
      document_type: 'bank_statement',
      type_confidence: 0.92,
      balances: { beginning_balance: { amount: 4523.50 }, ending_balance: { amount: 5234.28 } },
      ai_analysis: { qualification_score: 8 },
      created_at: '2024-11-30T00:00:00Z'
    },
    {
      id: 2,
      filename: 'bofa_statements_dec2024.pdf',
      status: 'complete',
      document_type: 'bank_statement',
      type_confidence: 0.89,
      balances: { beginning_balance: { amount: 2150.00 }, ending_balance: { amount: 1892.45 } },
      ai_analysis: { qualification_score: 6 },
      created_at: '2024-12-31T00:00:00Z'
    },
    {
      id: 3,
      filename: 'receipt_amazon_1234.pdf',
      status: 'processing',
      document_type: 'receipt',
      type_confidence: 0.78,
      balances: null,
      ai_analysis: null,
      created_at: '2025-01-15T00:00:00Z'
    },
    {
      id: 4,
      filename: 'wells_fargo_oct.pdf',
      status: 'failed',
      document_type: 'bank_statement',
      type_confidence: 0.45,
      balances: null,
      ai_analysis: null,
      created_at: '2024-10-31T00:00:00Z'
    },
    {
      id: 5,
      filename: 'uber_receipt_jan.pdf',
      status: 'pending',
      document_type: 'receipt',
      type_confidence: null,
      balances: null,
      ai_analysis: null,
      created_at: '2025-01-20T00:00:00Z'
    },
  ];
}
