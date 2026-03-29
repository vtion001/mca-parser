import type { StatementCardProps } from './types';
import { Sparkline } from './Sparkline';
import { maskAccountNumber, fmtMoney, fmtCount } from './utils';

export function StatementCard({ row, index, onReview, onDelete }: StatementCardProps) {
  const isReconciles = row.difference !== null && Math.abs(row.difference) < 0.01;
  const hasNsf = row.nsfCount > 0;
  const isCurrent = row.id === -1;
  const diffClass = isReconciles ? 'text-bw-900' : 'text-bw-600';

  return (
    <div
      className={`
        sv-row-animate relative overflow-hidden rounded-xl border
        transition-all duration-200 hover:shadow-elevated
        ${isReconciles
          ? 'bg-white border-bw-100 hover:border-bw-300'
          : 'bg-white border-bw-200 hover:border-bw-400'
        }
      `}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Reconciliation status stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        isReconciles ? 'bg-bw-900' : 'bg-bw-400'
      }`} />

      <div className="flex items-center gap-4 px-6 py-5 pl-8">
        {/* ── Account Info ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isReconciles ? 'bg-bw-100' : 'bg-bw-50'
            }`}>
              <svg className={`w-4 h-4 ${isReconciles ? 'text-bw-900' : 'text-bw-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-bw-900 tracking-wide">
                  {row.accountNumber ? maskAccountNumber(row.accountNumber) : '••••••••'}
                </span>
                {isCurrent && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 rounded">Current</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-bw-400">{row.accountType}</span>
                <span className="text-bw-200">·</span>
                <span className="font-mono text-xs text-bw-400">{row.period || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Balances ── */}
        <div className="w-36 text-right">
          <div className="space-y-1">
            <div>
              <div className="text-[10px] text-bw-400 mb-0.5">Starting</div>
              <div className={`font-mono text-sm font-medium ${(row.beginningBalance ?? 0) < 0 ? 'text-red-600' : 'text-bw-700'}`}>
                {fmtMoney(row.beginningBalance)}
              </div>
            </div>
            <div className="pt-1 border-t border-bw-100">
              <div className="text-[10px] text-bw-400 mb-0.5">Ending</div>
              <div className={`font-mono text-sm font-bold ${(row.endingBalance ?? 0) < 0 ? 'text-red-600' : 'text-bw-900'}`}>
                {fmtMoney(row.endingBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Activity (Credits / Debits) ── */}
        <div className="w-48">
          <div className="flex items-center gap-4">
            <div className="flex-1 text-right">
              <div className="text-[10px] text-bw-400 mb-1">Deposits</div>
              <div className="font-mono text-sm font-semibold text-bw-800">
                {fmtMoney(row.totalCredits)}
              </div>
              <div className="font-mono text-[11px] text-bw-400 mt-0.5">
                {row.creditCount !== null ? `${fmtCount(row.creditCount)} items` : ''}
              </div>
            </div>
            <div className="flex-1 text-right">
              <div className="text-[10px] text-bw-400 mb-1">Withdrawals</div>
              <div className="font-mono text-sm font-semibold text-bw-800">
                {fmtMoney(row.totalDebits)}
              </div>
              <div className="font-mono text-[11px] text-bw-400 mt-0.5">
                {row.debitCount !== null ? `${fmtCount(row.debitCount)} items` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* ── Reconciliation Status ── */}
        <div className="w-44 text-center">
          <div className="flex flex-col items-center gap-1.5">
            {/* Difference — the hero metric */}
            <div className={`font-mono text-xl font-bold ${diffClass}`} style={{ lineHeight: 1.2 }}>
              {fmtMoney(row.difference)}
            </div>

            {/* Calculated balance */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-bw-400">Calc:</span>
              <span className="font-mono text-bw-500">
                {row.calculatedBalance !== null ? fmtMoney(row.calculatedBalance) : '—'}
              </span>
            </div>

            {/* Status badge */}
            <div className={`mt-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
              isReconciles
                ? 'bg-bw-900 text-white'
                : hasNsf
                  ? 'bg-bw-200 text-bw-900'
                  : 'bg-bw-100 text-bw-600'
            }`}>
              {isReconciles ? 'Reconciled' : hasNsf ? 'NSF Issue' : 'Variance'}
            </div>
          </div>
        </div>

        {/* ── Flow Chart ── */}
        <div className="w-28 flex justify-center">
          <Sparkline credits={row.totalCredits} debits={row.totalDebits} />
        </div>

        {/* ── Action ── */}
        <div className="w-32 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReview?.(row.result)}
              className={`
                inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg
                transition-all duration-150 shadow-sm
                ${isReconciles
                  ? 'bg-bw-900 text-white hover:bg-bw-800 active:bg-bw-700'
                  : 'bg-bw-600 text-white hover:bg-bw-700 active:bg-bw-800'
                }
              `}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Review
            </button>
            <button
              onClick={() => onDelete?.(row.id)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-bw-50 text-bw-400 hover:bg-red-50 hover:text-red-600 transition-all duration-150 border border-bw-100 hover:border-red-200"
              title="Delete statement"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          {hasNsf && (
            <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full font-mono text-xs font-bold bg-bw-200 text-bw-900">
              {row.nsfCount} NSF
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
