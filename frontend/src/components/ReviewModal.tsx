import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ExtractionResult } from '../types/extraction';
import type { ParsedStatement, TransactionRow } from '../types/transactions';
import { parseTransactionsFromMarkdown, autoTag } from '../utils/transactionParser';

import {
  ReviewHeader,
  ReviewFilterBar,
  ReviewTransactionRow,
  ReviewEmptyState,
  ReviewFooter,
  TagEditorModal,
  maskAccountNumber,
} from './review';

import type { FilterTab, FilterCounts, BalanceSummary } from './review';

// ─── Styles ────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes sv-slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .sv-review-panel { animation: sv-slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1) both; }
  .row-flash { animation: flash-in 0.4s ease-out; }
  @keyframes flash-in { 0% { background-color: #fef9c3; } 100% { background-color: transparent; } }
`;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ReviewModalProps {
  result: ExtractionResult;
  onClose: () => void;
}

// ─── Main Component ────────────────────────────────────────────────────────────

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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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
  const filterCounts = useMemo((): FilterCounts => {
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

  // Balance summary
  const balanceSummary = useMemo((): BalanceSummary => {
    const begBal = statement?.beginningBalance ?? result.balances?.beginning_balance?.amount ?? null;
    const endBal = statement?.endingBalance ?? result.balances?.ending_balance?.amount ?? null;
    return { begBal, endBal, debits: totals.debits, credits: totals.credits };
  }, [statement, result.balances, totals]);

  // Confidence
  const confidence = Math.round((result.scores?.overall ?? result.document_type?.confidence ?? 0.85) * 100);

  // Account info
  const accountNumber = statement?.accountNumber || result.key_details?.find(d => d.field === 'account_number')?.value || '';
  const maskedAccount = accountNumber ? maskAccountNumber(accountNumber) : '••••••••';
  const period = statement?.statementPeriod || result.key_details?.find(d => d.field === 'statement_period')?.value || 'Statement';

  // Toggle "True" checkbox
  const toggleTrue = useCallback((id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, isTrue: !t.isTrue } : t));
  }, []);

  // Save tags
  const handleSaveTags = useCallback((id: string, tags: string[]) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, tags } : t));
  }, []);

  // Reset filters
  const handleReset = useCallback(() => {
    setActiveFilter('all');
    setSearch('');
  }, []);

  const hasActiveFilter = search.trim() !== '' || activeFilter !== 'all';

  return (
    <>
      <style>{CSS}</style>

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
        {/* TOP BAR */}
        <ReviewHeader
          period={period}
          maskedAccount={maskedAccount}
          search={search}
          onSearchChange={setSearch}
          onClose={onClose}
          selectedAccountIdx={selectedAccountIdx}
          onAccountIdxChange={setSelectedAccountIdx}
        />

        {/* FILTER BAR */}
        <ReviewFilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          filterCounts={filterCounts}
          editMode={editMode}
          onEditModeToggle={() => setEditMode(m => !m)}
          onReset={handleReset}
        />

        {/* COLUMN HEADER */}
        <div className="grid grid-cols-[2rem_3.5rem_1fr_6.5rem_6.5rem_auto_2.5rem] gap-0 px-4 py-1.5 border-b border-bw-200 bg-bw-50 flex-shrink-0">
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest self-center">#</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest self-center">Date</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest self-center">Payee</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest text-right self-center">Debit</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest text-right self-center">Credit</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest self-center">Tags</div>
          <div className="text-[9px] font-semibold text-bw-400 uppercase tracking-widest text-center self-center">✓</div>
        </div>

        {/* SCROLLABLE TRANSACTION LIST */}
        <div className="flex-1 overflow-y-auto">
          {paged.length === 0 ? (
            <ReviewEmptyState hasFilter={hasActiveFilter} />
          ) : (
            <div>
              {paged.map((txn, idx) => {
                const globalIdx = (page - 1) * pageSize + idx;
                return (
                  <ReviewTransactionRow
                    key={txn.id}
                    txn={txn}
                    globalIdx={globalIdx}
                    editMode={editMode}
                    onTagEdit={setEditingTxn}
                    onToggleTrue={toggleTrue}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <ReviewFooter
          filtered={filterCounts}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          balanceSummary={balanceSummary}
          result={result}
          confidence={confidence}
        />
      </div>

      {/* TAG EDITOR MODAL */}
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
