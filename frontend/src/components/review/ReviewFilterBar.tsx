import type { FilterTab, FilterCounts } from './types';

interface ReviewFilterBarProps {
  activeFilter: FilterTab;
  onFilterChange: (filter: FilterTab) => void;
  filterCounts: FilterCounts;
  editMode: boolean;
  onEditModeToggle: () => void;
  onReset: () => void;
}

export function ReviewFilterBar({
  activeFilter,
  onFilterChange,
  filterCounts,
  editMode,
  onEditModeToggle,
  onReset,
}: ReviewFilterBarProps) {
  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: `All ${filterCounts.all}` },
    { id: 'transfers', label: `Transfer ${filterCounts.transfers}` },
    { id: 'wires', label: `Wire ${filterCounts.wires}` },
    { id: 'credits', label: `Credit ${filterCounts.credits}` },
    { id: 'debits', label: `Debit ${filterCounts.debits}` },
    { id: 'mca', label: `MCA ${filterCounts.mca}` },
  ];

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-bw-200 bg-white flex-shrink-0">
      {/* Filter tabs */}
      <div className="flex items-center gap-0.5">
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
              activeFilter === tab.id
                ? 'bg-bw-900 text-white'
                : 'text-bw-500 hover:text-bw-900 hover:bg-bw-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onReset}
          className="px-2 py-1 text-[10px] font-medium text-bw-400 hover:text-bw-900 rounded-md transition-colors"
        >
          Reset
        </button>
        <button
          onClick={onEditModeToggle}
          className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
            editMode
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'text-bw-500 hover:text-bw-900'
          }`}
        >
          {editMode ? '✓ Editing' : 'Edit'}
        </button>
        <button
          onClick={() => {
            // TODO: wire to save endpoint or state commit
            window.alert('Save is not yet connected — tag edits are saved in-memory only.');
          }}
          className="px-2.5 py-1 text-[10px] font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
        >
          SAVE
        </button>
      </div>
    </div>
  );
}
