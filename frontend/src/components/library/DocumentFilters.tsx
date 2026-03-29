interface DocumentFiltersProps {
  filter: string;
  search: string;
  viewMode: 'grid' | 'list';
  documentCount: number;
  onFilterChange: (filter: string) => void;
  onSearchChange: (search: string) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export function DocumentFilters({
  filter,
  search,
  viewMode,
  documentCount,
  onFilterChange,
  onSearchChange,
  onViewModeChange,
}: DocumentFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <select
        value={filter}
        onChange={e => onFilterChange(e.target.value)}
        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
      >
        <option value="all">All Status</option>
        <option value="complete">Complete</option>
        <option value="processing">Processing</option>
        <option value="failed">Failed</option>
        <option value="pending">Pending</option>
      </select>

      <select
        onChange={e => onFilterChange(e.target.value === filter ? 'all' : e.target.value)}
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
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>

      <div className="text-sm text-gray-500">
        {documentCount} document{documentCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
