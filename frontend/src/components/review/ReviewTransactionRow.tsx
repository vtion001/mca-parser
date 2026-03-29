import type { TransactionRow } from '../../types/transactions';
import { getTagColor } from '../../utils/transactionParser';
import { fmtMoney } from './utils';

interface ReviewTransactionRowProps {
  txn: TransactionRow;
  globalIdx: number;
  editMode: boolean;
  onTagEdit: (txn: TransactionRow) => void;
  onToggleTrue: (id: string) => void;
}

export function ReviewTransactionRow({
  txn,
  globalIdx,
  editMode,
  onTagEdit,
  onToggleTrue,
}: ReviewTransactionRowProps) {
  const isCredit = txn.credit !== null && txn.credit > 0;
  const isDebit = txn.debit !== null && txn.debit > 0;

  return (
    <div
      className={`grid grid-cols-[2rem_3.5rem_1fr_6.5rem_6.5rem_auto_2.5rem] gap-0 px-4 py-1.5 border-b border-bw-100 hover:bg-bw-50 transition-colors cursor-default ${
        txn.isTrue ? 'bg-emerald-50/60' : ''
      }`}
    >
      {/* # */}
      <div className="text-[10px] font-mono text-bw-300 self-center">{globalIdx + 1}</div>

      {/* Date */}
      <div className="text-[10px] font-mono text-bw-600 self-center whitespace-nowrap">{txn.date}</div>

      {/* Payee */}
      <div className="flex flex-col justify-center min-w-0 pr-2">
        <span className="text-[11px] text-bw-900 truncate" title={txn.payee}>{txn.payee}</span>
        {txn.checkNumber && (
          <span className="text-[9px] text-bw-400 font-mono">#{txn.checkNumber}</span>
        )}
      </div>

      {/* Debit */}
      <div className={`text-[11px] font-mono text-right self-center ${isDebit ? 'text-red-600' : 'text-bw-300'}`}>
        {isDebit ? fmtMoney(txn.debit) : '—'}
      </div>

      {/* Credit */}
      <div className={`text-[11px] font-mono text-right self-center ${isCredit ? 'text-emerald-700' : 'text-bw-300'}`}>
        {isCredit ? fmtMoney(txn.credit) : '—'}
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1 self-center flex-wrap">
        {txn.tags.slice(0, 3).map(tag => {
          const colors = getTagColor(tag);
          return (
            <span
              key={tag}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
            >
              {tag}
            </span>
          );
        })}
        {txn.tags.length > 3 && (
          <span className="text-[9px] text-bw-400">+{txn.tags.length - 3}</span>
        )}
        {editMode && (
          <button
            onClick={() => onTagEdit(txn)}
            className="w-5 h-5 rounded border border-dashed border-bw-300 text-bw-400 hover:text-bw-700 hover:border-bw-500 flex items-center justify-center text-[10px]"
          >
            +
          </button>
        )}
      </div>

      {/* True checkbox */}
      <div className="flex items-center justify-center self-center">
        <button
          onClick={() => onToggleTrue(txn.id)}
          className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
            txn.isTrue
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-bw-300 hover:border-bw-500'
          }`}
        >
          {txn.isTrue && (
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
