import type { FilterCounts, BalanceSummary } from './types';
import type { ExtractionResult } from '../../types/extraction';
import { fmtMoney } from './utils';

interface ReviewFooterProps {
  filtered: FilterCounts;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  balanceSummary: BalanceSummary;
  result: ExtractionResult;
  confidence: number;
}

export function ReviewFooter({
  filtered,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  balanceSummary,
  result,
  confidence,
}: ReviewFooterProps) {
  const filteredLength = filtered.all;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-bw-200 bg-bw-50 flex-shrink-0">
      {/* Left: pagination */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-bw-400">
          {filteredLength > 0
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredLength)} of ${filteredLength}`
            : '0 transactions'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="w-6 h-6 flex items-center justify-center rounded text-bw-500 hover:bg-bw-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[10px] text-bw-500 font-medium px-1">{page}/{totalPages}</span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="w-6 h-6 flex items-center justify-center rounded text-bw-500 hover:bg-bw-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="appearance-none px-1.5 py-0.5 bg-white border border-bw-200 rounded text-[10px] text-bw-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-bw-900"
        >
          {[25, 50, 100, 200].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Center: balance summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-widest text-bw-400 font-semibold">Beg.</span>
          <span className="text-[11px] font-mono font-semibold text-bw-800">{fmtMoney(balanceSummary.begBal)}</span>
        </div>
        <div className="w-px h-3 bg-bw-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-widest text-bw-400 font-semibold">End</span>
          <span className="text-[11px] font-mono font-semibold text-bw-800">{fmtMoney(balanceSummary.endBal)}</span>
        </div>
        <div className="w-px h-3 bg-bw-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-widest text-bw-400 font-semibold text-red-600">Dr</span>
          <span className="text-[11px] font-mono font-semibold text-red-600">{fmtMoney(balanceSummary.debits)}</span>
        </div>
        <div className="w-px h-3 bg-bw-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-widest text-bw-400 font-semibold text-emerald-700">Cr</span>
          <span className="text-[11px] font-mono font-semibold text-emerald-700">{fmtMoney(balanceSummary.credits)}</span>
        </div>
      </div>

      {/* Right: risk + confidence */}
      <div className="flex items-center gap-2">
        {result.ai_analysis?.analysis?.risk_indicators && (
          <div className="flex items-center gap-1">
            {result.ai_analysis.analysis.risk_indicators.has_large_unusual_transactions && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-700 border border-red-200">
                ⚠ Large
              </span>
            )}
            {result.ai_analysis.analysis.risk_indicators.has_overdraft_signs && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                ⚠ OD
              </span>
            )}
          </div>
        )}
        <span className="text-[10px] text-bw-400 font-medium">Conf. {confidence}%</span>
      </div>
    </div>
  );
}
