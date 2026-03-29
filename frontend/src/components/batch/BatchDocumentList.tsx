import { DocumentLibrary } from '../DocumentLibrary';

export interface BatchDocument {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  balances: {
    beginning_balance: { amount: number | null };
    ending_balance: { amount: number | null };
  } | null;
  ai_analysis: {
    qualification_score: number;
  } | null;
}

interface BatchDocumentListProps {
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onClearSelection: () => void;
  onCreateBatch: () => void;
}

export function BatchDocumentList({
  selectedIds,
  onToggleSelect,
  onClearSelection,
  onCreateBatch,
}: BatchDocumentListProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Document Library</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select documents to process in a batch (max 50)
          </p>
        </div>
        <div className="text-sm">
          <span className="font-medium">{selectedIds.length}</span>
          <span className="text-gray-500"> selected</span>
        </div>
      </div>

      <DocumentLibrary
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        selectionMode={true}
      />

      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onCreateBatch}
                disabled={selectedIds.length === 0}
                className="px-6 py-3 bg-black text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Process {selectedIds.length} Document{selectedIds.length !== 1 ? 's' : ''}
              </button>
              <button
                onClick={onClearSelection}
                className="px-4 py-2 text-gray-600 hover:text-black"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DocumentSelectionReviewProps {
  documents: BatchDocument[];
  selectedIds: number[];
  onRemoveDocument: (id: number) => void;
}

export function DocumentSelectionReview({
  documents,
  selectedIds,
  onRemoveDocument,
}: DocumentSelectionReviewProps) {
  const selectedDocs = documents.filter(d => selectedIds.includes(d.id));

  return (
    <div className="border-t pt-4">
      <h3 className="font-medium mb-3">Selected Documents</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {selectedDocs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-sm">{doc.filename}</span>
            </div>
            <button
              onClick={() => onRemoveDocument(doc.id)}
              className="text-gray-400 hover:text-red-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
