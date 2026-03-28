import { useState, useEffect } from 'react';
import axios from 'axios';
import type { ExtractionResult, KeyDetail } from '../types/extraction';

// ─── IBM Plex Mono ────────────────────────────────────────────────────────────
const monoStyle = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
  .sv-mono { font-family: 'IBM Plex Mono', 'Courier New', monospace; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskAccountNumber(num: string): string {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
}

function fmtMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? parseFloat(amount.replace(/[$,]/g, '')) : amount;
  if (isNaN(n)) return '—';
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n < 0) return `-$${str}`;
  return `$${str}`;
}

function fmtCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}

function getFieldValue(details: KeyDetail[], field: string): string {
  return details.find(d => d.field === field)?.value ?? '';
}

function getFieldAmount(details: KeyDetail[], field: string): number | null {
  const raw = details.find(d => d.field === field)?.value ?? '';
  const cleaned = raw.replace(/[$,()]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function getBalanceAmount(
  balances: ExtractionResult['balances'],
  key: 'beginning_balance' | 'ending_balance'
): number | null {
  return balances?.[key]?.amount ?? null;
}

interface StatementRow {
  id: number;
  accountNumber: string;
  accountType: string;
  period: string;
  beginningBalance: number | null;
  endingBalance: number | null;
  totalCredits: number | null;
  creditCount: number | null;
  totalDebits: number | null;
  debitCount: number | null;
  calculatedBalance: number | null;
  difference: number | null;
  nsfCount: number;
  confidence: number;
  originalFilename: string;
  createdAt: string;
  result: ExtractionResult;
}

function isValidRow(doc: any): boolean {
  const details = doc.key_details ?? [];
  const analysis = doc.ai_analysis?.analysis ?? null;
  const txn = analysis?.transaction_summary;

  const begBal =
    doc.balances?.beginning_balance?.amount ??
    details.find((d: any) => d.field === 'beginning_balance')?.value ?? null;
  const credits = txn?.total_amount_credits ?? null;
  const debits = txn?.total_amount_debits ?? null;

  // Reject rows with zero or obviously bogus totals (AI hallucination guards)
  if (credits !== null && credits <= 0 && debits !== null && debits <= 0) return false;
  // Reject rows where AI returned absurdly large numbers (likely hallucination)
  // Normal business bank accounts rarely exceed $10M in a month
  if (credits !== null && credits > 10_000_000) return false;
  if (debits !== null && debits > 10_000_000) return false;
  // Reject if credits are 100x larger than debits (suspicious AI hallucination)
  if (credits !== null && debits !== null && credits > 0 && debits > 0 && credits / debits > 50) return false;
  // Reject rows missing both beginning and ending balance
  const endBal = doc.balances?.ending_balance?.amount ?? details.find((d: any) => d.field === 'ending_balance')?.value ?? null;
  if (begBal === null && endBal === null) return false;

  return true;
}

function buildRow(doc: any): StatementRow | null {
  if (!isValidRow(doc)) return null;

  const details = doc.key_details ?? [];
  const analysis = doc.ai_analysis?.analysis ?? null;
  const txn = analysis?.transaction_summary;

  const begBal =
    getBalanceAmount(doc.balances, 'beginning_balance') ??
    getFieldAmount(details, 'beginning_balance');
  const endBal =
    getBalanceAmount(doc.balances, 'ending_balance') ??
    getFieldAmount(details, 'ending_balance');

  const credits = txn?.total_amount_credits ?? null;
  const debits = txn?.total_amount_debits ?? null;
  const calcBal =
    begBal !== null && credits !== null && debits !== null
      ? begBal + credits - debits
      : null;
  const diff =
    calcBal !== null && endBal !== null ? endBal - calcBal : null;

  const nsfItems = analysis?.risk_indicators?.has_returned_items ? 1 : 0;
  const accountNum = getFieldValue(details, 'account_number');
  const accountType = getFieldValue(details, 'account_type') || 'Bank Account';

  let period = getFieldValue(details, 'statement_period');
  if (!period || period.length > 50) {
    const begDate = getFieldValue(details, 'date') || '';
    period = (begDate && begDate.length < 50) ? begDate : 'Statement';
  }

  const confidence = doc.scores?.overall ?? doc.document_type?.confidence ?? 0.85;

  return {
    id: doc.id,
    accountNumber: accountNum,
    accountType,
    period,
    beginningBalance: begBal,
    endingBalance: endBal,
    totalCredits: credits,
    creditCount: txn?.credit_count ?? null,
    totalDebits: debits,
    debitCount: txn?.debit_count ?? null,
    calculatedBalance: calcBal,
    difference: diff,
    nsfCount: nsfItems,
    confidence,
    originalFilename: doc.original_filename ?? 'Unknown',
    createdAt: doc.created_at ?? '',
    result: {
      markdown: doc.markdown ?? '',
      document_type: doc.document_type ?? { type: 'bank_statement', confidence: 0.85 },
      key_details: doc.key_details ?? [],
      scores: doc.scores ?? { completeness: 0, quality: 0, pii_detection: 0, overall: 0.85 },
      pii_breakdown: doc.pii_breakdown ?? undefined,
      recommendations: doc.recommendations ?? [],
      balances: doc.balances ?? undefined,
      ai_analysis: doc.ai_analysis ?? { success: false, analysis: null },
      page_count: doc.page_count ?? 0,
    },
  };
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ credits, debits }: { credits: number | null; debits: number | null }) {
  const maxVal = Math.max(credits ?? 1, debits ?? 1, 1);
  const creditH = credits !== null ? Math.max(6, Math.round((credits / maxVal) * 48)) : 6;
  const debitH = debits !== null ? Math.max(6, Math.round((debits / maxVal) * 48)) : 6;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end gap-[3px] h-12 w-24">
        <div
          className="flex-1 rounded-t-sm bg-gradient-to-t from-emerald-600 to-emerald-400 animate-[sv-draw_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]"
          style={{ height: creditH, animationDelay: '0ms' }}
        />
        <div
          className="flex-1 rounded-t-sm bg-gradient-to-t from-bw-800 to-bw-600 animate-[sv-draw_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]"
          style={{ height: debitH, animationDelay: '100ms' }}
        />
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" />
          <span className="text-bw-400">CR</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-bw-800 to-bw-600" />
          <span className="text-bw-400">DR</span>
        </span>
      </div>
    </div>
  );
}

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
  onReviewStatement?: (result: ExtractionResult) => void;
}

export function StatementsView({ result, onReviewStatement }: StatementsViewProps) {
  const [documents, setDocuments] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  // Fetch stored documents from backend
  useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await axios.get('/api/v1/documents', {
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

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-bw-900">Statements</h1>
            <div className="flex items-center gap-6 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-bw-400 uppercase tracking-wide">Documents</span>
                <span className="text-xs font-semibold font-mono text-bw-900">{documents.length}</span>
              </div>
              {documents.length > 0 && (
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
            onClick={() => { setLoading(true); setDocuments([]); }}
            className="px-3 py-1.5 text-xs font-medium text-bw-500 hover:text-bw-900 hover:bg-bw-50 rounded-lg transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── Redesigned Statement Cards ── */}
        <div className="space-y-3">
          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-bw-100 shadow-card px-6 py-5 animate-pulse">
                  <div className="flex items-center gap-8">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-bw-100 rounded" />
                      <div className="h-3 w-24 bg-bw-100 rounded" />
                    </div>
                    <div className="h-8 w-48 bg-bw-100 rounded" />
                    <div className="h-10 w-10 bg-bw-100 rounded-full" />
                  </div>
                </div>
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
              {documents.map((row, idx) => {
                const isReconciles = row.difference !== null && Math.abs(row.difference) < 0.01;
                const hasNsf = row.nsfCount > 0;
                const isCurrent = row.id === -1;
                const diffClass = isReconciles ? 'text-emerald-600' : 'text-amber-600';

                return (
                  <div
                    key={row.id}
                    className={`
                      sv-row-animate relative overflow-hidden rounded-xl border
                      transition-all duration-200 hover:shadow-elevated
                      ${isReconciles
                        ? 'bg-white border-bw-100 hover:border-emerald-200'
                        : 'bg-white border-amber-200 hover:border-amber-300'
                      }
                    `}
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    {/* Reconciliation status stripe */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      isReconciles ? 'bg-emerald-500' : 'bg-amber-400'
                    }`} />

                    <div className="flex items-center gap-4 px-6 py-5 pl-8">
                      {/* ── Account Info ── */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isReconciles ? 'bg-emerald-50' : 'bg-amber-50'
                          }`}>
                            <svg className={`w-4 h-4 ${isReconciles ? 'text-emerald-600' : 'text-amber-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                            <div className="font-mono text-sm font-semibold text-emerald-600">
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
                              ? 'bg-emerald-100 text-emerald-700'
                              : hasNsf
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
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
                      <div className="w-24 text-right">
                        <button
                          onClick={() => onReviewStatement?.(row.result)}
                          className={`
                            inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg
                            transition-all duration-150 shadow-sm
                            ${isReconciles
                              ? 'bg-bw-900 text-white hover:bg-bw-800 active:bg-bw-700'
                              : 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700'
                            }
                          `}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Review
                        </button>
                        {hasNsf && (
                          <div className="mt-1.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full font-mono text-xs font-bold bg-red-50 text-red-600">
                              {row.nsfCount} NSF
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-bw-400">Reconciled</span>
                <span className="text-sm font-mono font-bold text-emerald-600">
                  {documents.filter(r => r.difference !== null && Math.abs(r.difference) < 0.01).length}
                </span>
              </div>
              <div className="w-px h-4 bg-bw-200" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-bw-400">Variance</span>
                <span className="text-sm font-mono font-bold text-amber-600">
                  {documents.filter(r => r.difference === null || Math.abs(r.difference) >= 0.01).length}
                </span>
              </div>
              {documents.filter(r => r.nsfCount > 0).length > 0 && (
                <>
                  <div className="w-px h-4 bg-bw-200" />
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-bw-400">NSF Issues</span>
                    <span className="text-sm font-mono font-bold text-red-600">
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
