import type { ReviewModalProps } from './types';

interface ReviewHeaderProps {
  period: string;
  maskedAccount: string;
  search: string;
  onSearchChange: (value: string) => void;
  onClose: ReviewModalProps['onClose'];
  selectedAccountIdx: number;
  onAccountIdxChange: (idx: number) => void;
}

export function ReviewHeader({
  period,
  maskedAccount,
  search,
  onSearchChange,
  onClose,
  selectedAccountIdx,
  onAccountIdxChange,
}: ReviewHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-bw-200 bg-bw-50 flex-shrink-0">
      {/* Account selector */}
      <div className="relative flex-shrink-0">
        <select
          value={selectedAccountIdx}
          onChange={e => onAccountIdxChange(Number(e.target.value))}
          className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-bw-200 rounded-lg text-xs font-semibold text-bw-900 cursor-pointer hover:border-bw-300 focus:outline-none focus:ring-1 focus:ring-bw-900"
        >
          <option value={0}>{maskedAccount} · {period || 'Statement'}</option>
        </select>
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-bw-400"
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-[260px]">
        <svg
          className="absolute left-2 top-1/2 -translate-y-1/2 text-bw-400"
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search payee, tag..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-7 pr-7 py-1.5 bg-white border border-bw-200 rounded-lg text-xs text-bw-900 placeholder-bw-400 focus:outline-none focus:ring-1 focus:ring-bw-900"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-bw-400 hover:text-bw-700"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 ml-auto">
        <button className="px-2.5 py-1.5 text-[10px] font-medium text-bw-600 bg-white border border-bw-200 rounded-lg hover:bg-bw-50 transition-colors">
          ADD
        </button>
        <button className="px-2.5 py-1.5 text-[10px] font-medium text-bw-600 bg-white border border-bw-200 rounded-lg hover:bg-bw-50 transition-colors">
          EDIT
        </button>
        <button className="px-2.5 py-1.5 text-[10px] font-medium text-bw-600 bg-white border border-bw-200 rounded-lg hover:bg-bw-50 transition-colors">
          UNDO
        </button>
        <button className="px-2.5 py-1.5 text-[10px] font-semibold text-white bg-bw-900 rounded-lg hover:bg-bw-800 transition-colors">
          FIND
        </button>
        <button className="px-2.5 py-1.5 text-[10px] font-semibold text-white bg-bw-900 rounded-lg hover:bg-bw-800 transition-colors">
          FIXUP
        </button>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-bw-400 hover:text-bw-900 hover:bg-bw-100 transition-colors ml-0.5"
          aria-label="Close"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
