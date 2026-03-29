import { Document } from '../DocumentLibrary';
import { DocumentItem } from './DocumentItem';

interface DocumentListProps {
  documents: Document[];
  viewMode: 'grid' | 'list';
  selectedIds: number[];
  selectionMode: boolean;
  onSelectDocument?: (id: number) => void;
  onToggleSelect?: (id: number) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
}

export function DocumentList({
  documents,
  viewMode,
  selectedIds,
  selectionMode,
  onSelectDocument,
  onToggleSelect,
  onDelete,
}: DocumentListProps) {
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

  const handleCardClick = (doc: Document) => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(doc.id);
    } else if (onSelectDocument) {
      onSelectDocument(doc.id);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-xl">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-500">No documents found</p>
        <p className="text-sm text-gray-400 mt-1">Upload a PDF to get started</p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {documents.map(doc => (
          <DocumentItem
            key={doc.id}
            doc={doc}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
            onSelectDocument={onSelectDocument}
            onToggleSelect={onToggleSelect}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  // List/Table view
  return (
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
                    onClick={(e) => onDelete(doc.id, e)}
                    className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-600"
                  >Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
