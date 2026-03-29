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

interface DocumentItemProps {
  doc: Document;
  selectedIds: number[];
  selectionMode: boolean;
  onSelectDocument?: (id: number) => void;
  onToggleSelect?: (id: number) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
}

export function DocumentItem({
  doc,
  selectedIds,
  selectionMode,
  onSelectDocument,
  onToggleSelect,
  onDelete,
}: DocumentItemProps) {
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

  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(doc.id);
    } else if (onSelectDocument) {
      onSelectDocument(doc.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(doc.id, e);
  };

  return (
    <div
      onClick={handleCardClick}
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
              onClick={handleDelete}
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
  );
}
