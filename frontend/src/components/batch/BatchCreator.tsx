import { BatchDocument } from './BatchDocumentList';

interface BatchCreatorProps {
  batchName: string;
  onBatchNameChange: (name: string) => void;
  selectedIds: number[];
  documents: BatchDocument[];
  onRemoveDocument: (id: number) => void;
  onStartProcessing: () => void;
  onBack: () => void;
  uploading: boolean;
}

export function BatchCreator({
  batchName,
  onBatchNameChange,
  selectedIds,
  documents,
  onRemoveDocument,
  onStartProcessing,
  onBack,
  uploading,
}: BatchCreatorProps) {
  const selectedDocs = documents.filter(d => selectedIds.includes(d.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Review Batch</h2>
          <p className="text-sm text-gray-500 mt-1">
            {selectedIds.length} document{selectedIds.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Batch Name (optional)
          </label>
          <input
            type="text"
            value={batchName}
            onChange={e => onBatchNameChange(e.target.value)}
            placeholder={`Batch ${new Date().toLocaleDateString()}`}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

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
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onStartProcessing}
          disabled={uploading || selectedIds.length === 0}
          className="px-6 py-3 bg-black text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Starting...' : 'Start Processing'}
        </button>
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 hover:text-black"
        >
          Back
        </button>
      </div>
    </div>
  );
}
