import { DocumentLibrary } from '../DocumentLibrary';

interface ComparisonSelectorProps {
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onCompare: () => void;
  onClearSelection: () => void;
}

export function ComparisonSelector({
  selectedIds,
  onToggleSelect,
  onCompare,
  onClearSelection,
}: ComparisonSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Comparative Analysis</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select 2 or more documents to compare
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

      {selectedIds.length >= 2 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onCompare}
                className="px-6 py-3 bg-black text-white font-semibold rounded-lg"
              >
                Compare {selectedIds.length} Documents
              </button>
              <button
                onClick={onClearSelection}
                className="px-4 py-2 text-gray-600"
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
