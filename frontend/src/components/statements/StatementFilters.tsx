import type { StatementFiltersProps } from './types';

export function StatementFilters({ totalCount, loading, onRefresh }: StatementFiltersProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-bw-900">Statements</h1>
        <div className="flex items-center gap-6 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-bw-400 uppercase tracking-wide">Documents</span>
            <span className="text-xs font-semibold font-mono text-bw-900">{totalCount}</span>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-bw-400 uppercase tracking-wide">Last Updated</span>
              <span className="text-xs font-semibold font-mono text-bw-900">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-medium text-bw-500 hover:text-bw-900 hover:bg-bw-50 rounded-lg transition-colors disabled:opacity-50"
      >
        ↻ Refresh
      </button>
    </div>
  );
}
