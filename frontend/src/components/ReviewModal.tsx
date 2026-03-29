import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ExtractionResult } from '../types/extraction';
import type { ParsedStatement, TransactionRow } from '../types/transactions';
import { TAG_CATEGORIES } from '../types/transactions';
import { getTagColor, parseTransactionsFromMarkdown, autoTag } from '../utils/transactionParser';

interface ReviewModalProps {
  result: ExtractionResult;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(amount: number | null | undefined, showSign = false): string {
  if (amount === null || amount === undefined) return '—';
  const abs = Math.abs(amount);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (amount < 0) return showSign ? `-$${str}` : `($${str})`;
  if (showSign && amount > 0) return `$${str}`;
  return `$${str}`;
}

// ─── Tag Editor Modal ─────────────────────────────────────────────────────────

function TagEditorModal({
  transaction,
  onSave,
  onClose,
}: {
  transaction: TransactionRow;
  onSave: (tags: string[]) => void;
  onClose: () => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>([...transaction.tags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed inset-x-4 top-[10%] mx-auto max-w-sm z-[70] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bw-100">
          <div>
            <h3 className="text-sm font-semibold text-bw-900">Edit Tags</h3>
            <p className="text-xs text-bw-400 mt-0.5 truncate max-w-[200px]">{transaction.payee}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-bw-400 hover:text-bw-900 hover:bg-bw-50 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {TAG_CATEGORIES.map(cat => (
            <div key={cat.name}>
              <p className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest mb-2">{cat.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {cat.tags.map(tag => {
                  const active = selectedTags.includes(tag);
                  const colors = getTagColor(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${active ? `${colors.bg} ${colors.text} ${colors.border}` : 'bg-white text-bw-400 border-bw-200 hover:border-bw-300'}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-bw-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-bw-600 bg-bw-50 rounded-lg hover:bg-bw-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(selectedTags); onClose(); }}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-bw-900 rounded-lg hover:bg-bw-800 transition-colors"
          >
            Save Tags
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main ReviewModal ─────────────────────────────────────────────────────────

type FilterTab = 'all' | 'transfers' | 'wires' | 'credits' | 'debits' | 'mca';

export function ReviewModal({ result, onClose }: ReviewModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [editingTxn, setEditingTxn] = useState<TransactionRow | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [statement, setStatement] = useState<ParsedStatement | null>(null);
  const [selectedAccountIdx, setSelectedAccountIdx] = useState(0);
  const [editMode, setEditMode] = useState(false);

  // Parse transactions from markdown on mount
  useEffect(() => {
    console.log('[ReviewModal] useEffect triggered, markdown length:', result.markdown?.length ?? 'undefined/null');
    if (result.markdown && result.markdown.length > 0) {
      try {
        const parsed = parseTransactionsFromMarkdown(result.markdown);
        console.log('[ReviewModal] parsed transactions:', parsed.transactions.length);
        if (parsed.transactions.length > 0) {
          console.log('[ReviewModal] sample txn:', JSON.stringify(parsed.transactions[0]));
        }
        setStatement(parsed);
        const tagged = parsed.transactions.map(t => ({
          ...t,
          tags: autoTag(t.payee, t.credit ?? null, t.debit ?? null),
        }));
        setTransactions(tagged);
      } catch (err) {
        console.error('[ReviewModal] Error parsing markdown:', err);
      }
    } else {
      console.warn('[ReviewModal] result.markdown is empty or undefined, skipping parse');
      console.warn('[ReviewModal] result keys:', Object.keys(result));
    }
  }, [result.markdown]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Filter transactions
  const filtered = useMemo(() => {
    let list = transactions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.payee.toLowerCase().includes(q) ||
        t.date.includes(q) ||
        t.memo.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    if (activeFilter !== 'all') {
      list = list.filter(t => {
        const tagSet = t.tags.map(tag => tag.toLowerCase());
        switch (activeFilter) {
          case 'transfers': return tagSet.some(tag => tag.includes('transfer'));
          case 'wires': return tagSet.some(tag => tag.includes('wire'));
          case 'credits': return t.credit !== null && t.credit > 0;
          case 'debits': return t.debit !== null && t.debit > 0;
          case 'mca': return tagSet.some(tag => tag.toLowerCase().includes('mca'));
          default: return true;
        }
      });
    }
    return list;
  }, [transactions, search, activeFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page when filter/search changes
  useEffect(() => { setPage(1); }, [search, activeFilter, pageSize]);

  // Totals
  const totals = useMemo(() => {
    let debits = 0, credits = 0;
    for (const t of filtered) {
      if (t.debit) debits += t.debit;
      if (t.credit) credits += t.credit;
    }
    return { debits, credits };
  }, [filtered]);

  // Count by filter
  const filterCounts = useMemo(() => {
    const countTag = (tag: string) => transactions.filter(t => t.tags.some(tg => tg.toLowerCase().includes(tag.toLowerCase()))).length;
    const countAmount = (pred: (t: TransactionRow) => boolean) => transactions.filter(pred).length;
    return {
      all: transactions.length,
      transfers: countTag('transfer'),
      wires: countTag('wire'),
      credits: countAmount(t => t.credit !== null && t.credit > 0),
      debits: countAmount(t => t.debit !== null && t.debit > 0),
      mca: countTag('mca'),
    };
  }, [transactions]);

  // Toggle "True" checkbox
  const toggleTrue = useCallback((id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, isTrue: !t.isTrue } : t));
  }, []);

  // Save tags
  const handleSaveTags = useCallback((id: string, tags: string[]) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, tags } : t));
  }, []);

  const accountNumber = statement?.accountNumber || result.key_details?.find(d => d.field === 'account_number')?.value || '';
  const maskedAccount = accountNumber ? `••••${accountNumber.replace(/\D/g, '').slice(-4)}` : '••••••••';
  const period = statement?.statementPeriod || result.key_details?.find(d => d.field === 'statement_period')?.value || 'Statement';

  const begBal = statement?.beginningBalance ?? result.balances?.beginning_balance?.amount ?? null;
  const endBal = statement?.endingBalance ?? result.balances?.ending_balance?.amount ?? null;

  const confidence = Math.round((result.scores?.overall ?? result.document_type?.confidence ?? 0.85) * 100);

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: `All ${filterCounts.all}` },
    { id: 'transfers', label: `Transfer ${filterCounts.transfers}` },
    { id: 'wires', label: `Wire ${filterCounts.wires}` },
    { id: 'credits', label: `Credit ${filterCounts.credits}` },
    { id: 'debits', label: `Debit ${filterCounts.debits}` },
    { id: 'mca', label: `MCA ${filterCounts.mca}` },
  ];

  return (
    <>
      <style>{`
        @keyframes sv-slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .sv-review-panel { animation: sv-slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1) both; }
        .row-flash { animation: flash-in 0.4s ease-out; }
        @keyframes flash-in { 0% { background-color: #fef9c3; } 100% { background-color: transparent; } }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-full max-w-6xl bg-white z-50 shadow-2xl flex flex-col sv-review-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Statement review"
      >
        {/* ═══ TOP BAR: Account + Search + Actions ═══ */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-bw-200 bg-bw-50 flex-shrink-0">
          {/* Account selector */}
          <div className="relative flex-shrink-0">
            <select
              value={selectedAccountIdx}
              onChange={e => setSelectedAccountIdx(Number(e.target.value))}
              className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-bw-200 rounded-lg text-xs font-semibold text-bw-900 cursor-pointer hover:border-bw-300 focus:outline-none focus:ring-1 focus:ring-bw-900"
            >
              <option value={0}>{maskedAccount} · {period || 'Statement'}</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-bw-400" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-[260px]">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-bw-400" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search payee, tag..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 pr-7 py-1.5 bg-white border border-bw-200 rounded-lg text-xs text-bw-900 placeholder-bw-400 focus:outline-none focus:ring-1 focus:ring-bw-900"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-bw-400 hover:text-bw-700">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Action buttons — compact icon+text */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button className="px-2.5 py-1.5 text-[10px] font-medium text-bw-600 bg-white border border-bw-200 rounded-lg hover:bg-bw-50 transition-colors">ADD</button>
            <button className="px-2.5 py-1.5 text-[10px] font-medium text-bw-600 bg-white border border-bw-200 rounded-lg hover:bg-bw-50 transition-colors">EDIT</button>
            <button className="px-2.5 py-1.5 text-[10px] font-medium text-bw-600 bg-white border border-bw-200 rounded-lg hover:bg-bw-50 transition-colors">UNDO</button>
            <button className="px-2.5 py-1.5 text-[10px] font-semibold text-white bg-bw-900 rounded-lg hover:bg-bw-800 transition-colors">FIND</button>
            <button className="px-2.5 py-1.5 text-[10px] font-semibold text-white bg-bw-900 rounded-lg hover:bg-bw-800 transition-colors">FIXUP</button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-bw-400 hover:text-bw-900 hover:bg-bw-100 transition-colors ml-0.5" aria-label="Close">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* ═══ FILTER TABS + EDIT CONTROLS ═══ */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-bw-200 bg-white flex-shrink-0">
          {/* Filter tabs — dense inline */}
          <div className="flex items-center gap-0.5">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
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
              onClick={() => { setActiveFilter('all'); setSearch(''); }}
              className="px-2 py-1 text-[10px] font-medium text-bw-400 hover:text-bw-900 rounded-md transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setEditMode(m => !m)}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                editMode ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'text-bw-500 hover:text-bw-900'
              }`}
            >
              {editMode ? '✓ Editing' : 'Edit'}
            </button>
            <button className="px-2.5 py-1 text-[10px] font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors">
              SAVE
            </button>
          </div>
        </div>

        {/* ═══ COLUMN HEADER ═══ */}
        <div className="grid grid-cols-[2rem_3.5rem_1fr_6.5rem_6.5rem_auto_2.5rem] gap-0 px-4 py-1.5 border-b border-bw-200 bg-bw-50 flex-shrink-0">
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest self-center">#</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest self-center">Date</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest self-center">Payee</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest text-right self-center">Debit</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest text-right self-center">Credit</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest self-center">Tags</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest text-center self-center">✓</div>
        </div>

        {/* ═══ SCROLLABLE TRANSACTION LIST ═══ */}
        <div className="flex-1 overflow-y-auto">
          {paged.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <svg className="w-8 h-8 text-bw-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-xs text-bw-400">
                {search || activeFilter !== 'all'
                  ? 'No transactions match the current filter.'
                  : 'No transactions found in this statement.'}
              </p>
            </div>
          ) : (
            <div>
              {paged.map((txn, idx) => {
                const globalIdx = (page - 1) * pageSize + idx;
                const isCredit = txn.credit !== null && txn.credit > 0;
                const isDebit = txn.debit !== null && txn.debit > 0;
                return (
                  <div
                    key={txn.id}
                    className={`grid grid-cols-[2rem_3.5rem_1fr_6.5rem_6.5rem_auto_2.5rem] gap-0 px-4 py-1.5 border-b border-bw-100 hover:bg-bw-50 transition-colors cursor-default ${txn.isTrue ? 'bg-emerald-50/60' : ''}`}
                  >
                    {/* # */}
                    <div className="text-[10px] font-mono text-bw-300 self-center">{globalIdx + 1}</div>

                    {/* Date */}
                    <div className="text-[10px] font-mono text-bw-600 self-center whitespace-nowrap">{txn.date}</div>

                    {/* Payee — description + check number inline */}
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
                          onClick={() => setEditingTxn(txn)}
                          className="w-5 h-5 rounded border border-dashed border-bw-300 text-bw-400 hover:text-bw-700 hover:border-bw-500 flex items-center justify-center text-[10px]"
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* True checkbox */}
                    <div className="flex items-center justify-center self-center">
                      <button
                        onClick={() => toggleTrue(txn.id)}
                        className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                          txn.isTrue
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-bw-300 hover:border-bw-500'
                        }`}
                      >
                        {txn.isTrue && (
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ COMPACT FOOTER: Pagination + Summary + Totals ═══ */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-bw-200 bg-bw-50 flex-shrink-0">

          {/* Left: pagination */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-bw-400">
              {filtered.length > 0
                ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}`
                : '0 transactions'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-6 h-6 flex items-center justify-center rounded text-bw-500 hover:bg-bw-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[10px] text-bw-500 font-medium px-1">{page}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-6 h-6 flex items-center justify-center rounded text-bw-500 hover:bg-bw-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
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
              <span className="text-[11px] font-mono font-semibold text-bw-800">{fmtMoney(begBal)}</span>
            </div>
            <div className="w-px h-3 bg-bw-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-widest text-bw-400 font-semibold">End</span>
              <span className="text-[11px] font-mono font-semibold text-bw-800">{fmtMoney(endBal)}</span>
            </div>
            <div className="w-px h-3 bg-bw-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-widest text-bw-400 font-semibold text-red-600">Dr</span>
              <span className="text-[11px] font-mono font-semibold text-red-600">{fmtMoney(totals.debits)}</span>
            </div>
            <div className="w-px h-3 bg-bw-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-widest text-bw-400 font-semibold text-emerald-700">Cr</span>
              <span className="text-[11px] font-mono font-semibold text-emerald-700">{fmtMoney(totals.credits)}</span>
            </div>
          </div>

          {/* Right: risk + confidence */}
          <div className="flex items-center gap-2">
            {result.ai_analysis?.analysis?.risk_indicators && (
              <div className="flex items-center gap-1">
                {result.ai_analysis.analysis.risk_indicators.has_large_unusual_transactions && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-700 border border-red-200">⚠ Large</span>
                )}
                {result.ai_analysis.analysis.risk_indicators.has_overdraft_signs && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">⚠ OD</span>
                )}
              </div>
            )}
            <span className="text-[10px] text-bw-400 font-medium">Conf. {confidence}%</span>
          </div>
        </div>
      </div>

      {/* Tag editor modal */}
      {editingTxn && (
        <TagEditorModal
          transaction={editingTxn}
          onSave={tags => handleSaveTags(editingTxn.id, tags)}
          onClose={() => setEditingTxn(null)}
        />
      )}
    </>
  );
}

export default ReviewModal;
