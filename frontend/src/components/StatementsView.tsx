import { useState, useEffect } from 'react';
import api from '../services/api';
import type { ExtractionResult } from '../types/extraction';
import type { StatementRow } from './statements/types';
import { StatementCard } from './statements/StatementCard';
import { SkeletonRow } from './statements/SkeletonRow';
import { StatementFilters } from './statements/StatementFilters';
import { buildRow } from './statements/utils';

// ─── IBM Plex Mono ────────────────────────────────────────────────────────────
const monoStyle = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
  .sv-mono { font-family: 'IBM Plex Mono', 'Courier New', monospace; }
`;

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
        <div className="w-16 h-16 mb-6 opacity-20">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-bw-900 mb-2">No Statement Data</h3>
        <p className="text-sm text-bw-400 max-w-xs leading-relaxed">
          Upload and extract a bank statement PDF to see the reconciliation view here.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface StatementsViewProps {
  result: ExtractionResult | null;
  onReviewStatement?: (row: StatementRow) => void;
}

export function StatementsView({ result, onReviewStatement }: StatementsViewProps) {
  const [documents, setDocuments] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this statement? This cannot be undone.')) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete statement. Please try again.');
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setDocuments([]);
  };

  // Fetch stored documents from backend
  useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await api.get('/documents', {
          params: { per_page: 50, status: 'complete' },
        });
        const docs = response.data.data ?? [];
        const rows = docs.map((doc: any) => buildRow(doc)).filter(Boolean) as StatementRow[];

        // Deduplicate: keep only the latest (highest ID) document per original_filename
        const seen = new Map<string, StatementRow>();
        for (const row of rows) {
          const key = `${row.originalFilename}::${row.period}`;
          if (!seen.has(key) || row.id > seen.get(key)!.id) {
            seen.set(key, row);
          }
        }
        const uniqueRows = Array.from(seen.values()).sort((a, b) => b.id - a.id);

        setDocuments(uniqueRows);
      } catch (err) {
        console.error('Failed to fetch documents:', err);
        // Fall back to the in-memory result if backend is not reachable
        if (result) {
          const row = buildRow({ ...result, id: 0, original_filename: 'Current extraction', created_at: '' });
          if (row) setDocuments([row]);
        }
      } finally {
        setLoading(false);
        setVisible(true);
      }
    }
    fetchDocuments();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // If we have a current in-memory result that isn't saved yet, prepend it
  useEffect(() => {
    if (result && documents.length > 0) {
      // Check if this result is already in the list (by checking markdown content)
      const alreadyInList = documents.some(d => d.result.markdown === result.markdown);
      if (!alreadyInList) {
        const currentRow = buildRow({ ...result, id: -1, original_filename: 'Current extraction', created_at: '' });
        if (currentRow) {
          setDocuments(prev => [currentRow, ...prev]);
        }
      }
    }
  }, [result]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{monoStyle}{`
        @keyframes sv-draw {
          from { transform: scaleY(0); opacity: 0; }
          to   { transform: scaleY(1); opacity: 1; }
        }
        @keyframes sv-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sv-row-animate {
          animation: sv-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      <div className={`space-y-6 ${visible ? '' : 'opacity-0'}`}>

        {/* ── Header / Filters ── */}
        <StatementFilters
          totalCount={documents.length}
          loading={loading}
          onRefresh={handleRefresh}
        />

        {/* ── Statement Cards ── */}
        <div className="space-y-3">
          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <SkeletonRow key={i} index={i} />
              ))}
            </>
          ) : documents.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Column Labels */}
              <div className="flex items-center gap-4 px-6">
                <div className="flex-1">
                  <span className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest">Account</span>
                </div>
                <div className="w-36 text-right">
                  <span className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest">Balances</span>
                </div>
                <div className="w-48 text-right">
                  <span className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest">Activity</span>
                </div>
                <div className="w-44 text-center">
                  <span className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest">Reconciliation</span>
                </div>
                <div className="w-28 text-center">
                  <span className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest">Flow</span>
                </div>
                <div className="w-24 text-right">
                  <span className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest">Action</span>
                </div>
              </div>

              {/* Statement Rows */}
              {documents.map((row, idx) => (
                <StatementCard
                  key={row.id}
                  row={row}
                  index={idx}
                  onReview={onReviewStatement}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}
        </div>

        {/* ── Summary Strip ── */}
        {!loading && documents.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 bg-white rounded-xl border border-bw-100 shadow-card">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-bw-400" />
                <span className="text-xs text-bw-400">Total Statements</span>
                <span className="text-sm font-mono font-bold text-bw-900">{documents.length}</span>
              </div>
              <div className="w-px h-4 bg-bw-200" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-bw-900" />
                <span className="text-xs text-bw-400">Reconciled</span>
                <span className="text-sm font-mono font-bold text-bw-900">
                  {documents.filter(r => r.difference !== null && Math.abs(r.difference) < 0.01).length}
                </span>
              </div>
              <div className="w-px h-4 bg-bw-200" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-bw-400" />
                <span className="text-xs text-bw-400">Variance</span>
                <span className="text-sm font-mono font-bold text-bw-600">
                  {documents.filter(r => r.difference === null || Math.abs(r.difference) >= 0.01).length}
                </span>
              </div>
              {documents.filter(r => r.nsfCount > 0).length > 0 && (
                <>
                  <div className="w-px h-4 bg-bw-200" />
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-bw-500" />
                    <span className="text-xs text-bw-400">NSF Issues</span>
                    <span className="text-sm font-mono font-bold text-bw-700">
                      {documents.filter(r => r.nsfCount > 0).length}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-bw-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Last updated {new Date().toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default StatementsView;
