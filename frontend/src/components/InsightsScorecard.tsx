import { useState, useCallback } from 'react';
import type { ExtractionResult } from '../types/extraction';
import type { TransactionRow } from '../types/transactions';
import { getTagColor } from '../utils/transactionParser';
import { fmtMoney } from './statements/utils';
import { useInsightsCalculations } from '../hooks/useInsightsCalculations';
import { DataTable } from './tables/DataTable';
import { MiniLineChart } from './charts/MiniLineChart';

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBlock({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: 'up' | 'down' | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-bw-900">{value}</span>
        {trend === 'up' && <span className="text-[10px] text-green-600">↑</span>}
        {trend === 'down' && <span className="text-[10px] text-red-600">↓</span>}
      </div>
      {sub && <span className="text-[10px] text-bw-400">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, badge, isOpen, onToggle }: { title: string; badge?: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-2 bg-bw-900 hover:bg-bw-800 transition-colors cursor-pointer"
    >
      <span className="text-[10px] font-semibold text-white uppercase tracking-wider">{title}</span>
      <div className="flex items-center gap-2">
        {badge && <span className="text-[9px] text-bw-300 bg-bw-700 px-2 py-0.5 rounded">{badge}</span>}
        <svg
          className={`w-3 h-3 text-bw-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

interface InsightsScorecardProps {
  result: ExtractionResult;
}

function filterByTag(txns: TransactionRow[], tag: string): TransactionRow[] {
  return txns.filter(t => t.tags.some(tg => tg.toLowerCase().includes(tag.toLowerCase())));
}

export function InsightsScorecard({ result }: InsightsScorecardProps) {
  const { transactions, revenueStats, mcaPaymentsByMonth, dailyBalances, begBal, endBal } = useInsightsCalculations(result);

  const mcaTxns = filterByTag(transactions, 'mca');
  const nsfTxns = filterByTag(transactions, 'nsf').concat(filterByTag(transactions, 'overdraft')).concat(filterByTag(transactions, 'returned'));
  const transferTxns = filterByTag(transactions, 'transfer');
  const creditTxns = transactions.filter(t => t.credit !== null && t.credit > 0);
  const debitTxns = transactions.filter(t => t.debit !== null && t.debit > 0);

  const confidence = Math.round((result.scores?.overall ?? result.document_type?.confidence ?? 0.85) * 100);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    revenue: true,
    balance: true,
    summary: true,
    mcaByMonth: true,
    mcaTxns: true,
    nsfTxns: true,
    transferTxns: true,
    deposits: true,
    withdrawals: true,
    risk: true,
  });

  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <div className="bg-white rounded-xl border border-bw-200 shadow-card overflow-hidden">
      {/* Header */}
      <div className="bg-bw-900 px-5 py-3.5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">PDF Insights Scorecard</h2>
          <p className="text-[10px] text-bw-400 mt-0.5">
            {result.markdown ? 'Account' : 'Account'} · {'Statement Period'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-bw-400 uppercase tracking-wider">Confidence</span>
          <span className={`text-sm font-bold ${confidence >= 90 ? 'text-green-400' : confidence >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
            {confidence}%
          </span>
        </div>
      </div>

      {/* Revenue Statistics */}
      <SectionHeader title="Revenue Statistics" badge="" isOpen={openSections.revenue} onToggle={() => toggleSection('revenue')} />
      {openSections.revenue && (
      <div className="px-5 py-4 grid grid-cols-2 lg:grid-cols-4 gap-5 border-b border-bw-200">
        <StatBlock label="Total Credits" value={fmtMoney(revenueStats.totalCredits)} />
        <StatBlock label="Total Debits" value={fmtMoney(revenueStats.totalDebits)} />
        <StatBlock label="Net Change" value={fmtMoney(revenueStats.grossProfit)} trend={revenueStats.grossProfit >= 0 ? 'up' : 'down'} />
        <StatBlock label="Monthly Avg" value={fmtMoney(revenueStats.monthlyAvg)} sub={revenueStats.highestMonth ? `Peak: ${revenueStats.highestMonth.month}` : ''} />
      </div>
      )}

      {/* Balance Chart */}
      <SectionHeader title="Daily Balance" badge={dailyBalances.length > 0 ? `${dailyBalances.length} days` : undefined} isOpen={openSections.balance} onToggle={() => toggleSection('balance')} />
      {openSections.balance && (
      <div className="px-5 py-4 border-b border-bw-200">
        <MiniLineChart dailyBalances={dailyBalances} height={160} />
        {dailyBalances.length > 0 && (
          <div className="flex justify-between mt-2 text-[10px] text-bw-400">
            <span>Opening: {fmtMoney(begBal)}</span>
            <span className="text-bw-300">·</span>
            <span>Closing: {fmtMoney(endBal)}</span>
            <span className="text-bw-300">·</span>
            <span>Range: {fmtMoney(Math.max(...dailyBalances.map(d => d.balance)) - Math.min(...dailyBalances.map(d => d.balance)))}</span>
          </div>
        )}
      </div>
      )}

      {/* Statements Summary */}
      <SectionHeader title="Statement Summary" badge={`${transactions.length} transactions`} isOpen={openSections.summary} onToggle={() => toggleSection('summary')} />
      {openSections.summary && (
      <div className="border-b border-bw-200">
        <DataTable
          data={[
            {
              period: 'Current Period',
              beg: begBal,
              end: endBal,
              credits: revenueStats.totalCredits,
              debits: revenueStats.totalDebits,
            },
          ]}
          columns={[
            { key: 'period' as const, label: 'Period' },
            { key: 'beg' as const, label: 'Beginning', align: 'right', render: (v) => fmtMoney(v as number | null) },
            { key: 'end' as const, label: 'Ending', align: 'right', render: (v) => fmtMoney(v as number | null) },
            { key: 'credits' as const, label: 'Credits', align: 'right', render: (v) => fmtMoney(v as number) },
            { key: 'debits' as const, label: 'Debits', align: 'right', render: (v) => fmtMoney(v as number) },
          ]}
        />
      </div>
      )}

      {/* MCA By Month */}
      {mcaPaymentsByMonth.length > 0 && (
        <>
          <SectionHeader title="MCA Payments by Month" badge={`${mcaPaymentsByMonth.length} months`} isOpen={openSections.mcaByMonth} onToggle={() => toggleSection('mcaByMonth')} />
          {openSections.mcaByMonth && (
          <div className="border-b border-bw-200">
            <DataTable
              data={mcaPaymentsByMonth}
              columns={[
                { key: 'month' as const, label: 'Month', width: '100px' },
                { key: 'payments' as const, label: 'Total Payments', align: 'right', render: (v) => fmtMoney(v as number) },
                { key: 'count' as const, label: 'Count', align: 'center', width: '70px' },
              ]}
            />
          </div>
          )}
        </>
      )}

      {/* MCA Transactions */}
      {mcaTxns.length > 0 && (
        <>
          <SectionHeader title="MCA Transactions" badge={`${mcaTxns.length}`} isOpen={openSections.mcaTxns} onToggle={() => toggleSection('mcaTxns')} />
          {openSections.mcaTxns && (
          <div className="border-b border-bw-200">
            <DataTable
              data={mcaTxns.slice(0, 50)}
              columns={[
                { key: 'date' as const, label: 'Date', width: '80px' },
                { key: 'payee' as const, label: 'Payee' },
                { key: 'debit' as const, label: 'Debit', align: 'right', render: (v) => v !== null ? fmtMoney(v as number) : '' },
                { key: 'tags' as const, label: 'Tags', width: '120px', render: (v) => {
                  const tags = v as string[];
                  return (
                    <div className="flex gap-1 flex-wrap">
                      {tags.slice(0, 2).map(tag => {
                        const colors = getTagColor(tag);
                        return (
                          <span key={tag} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${colors.bg} ${colors.text}`}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  );
                }},
              ]}
            />
          </div>
          )}
        </>
      )}

      {/* NSF / Overdraft / Returned */}
      {nsfTxns.length > 0 && (
        <>
          <SectionHeader title="NSF / Overdraft / Returned" badge={`${nsfTxns.length}`} isOpen={openSections.nsfTxns} onToggle={() => toggleSection('nsfTxns')} />
          {openSections.nsfTxns && (
          <div className="border-b border-bw-200">
            <DataTable
              data={nsfTxns.slice(0, 50)}
              columns={[
                { key: 'date' as const, label: 'Date', width: '80px' },
                { key: 'payee' as const, label: 'Payee' },
                { key: 'debit' as const, label: 'Amount', align: 'right', render: (v) => v !== null ? fmtMoney(v as number) : '' },
              ]}
            />
          </div>
          )}
        </>
      )}

      {/* Transfers */}
      {transferTxns.length > 0 && (
        <>
          <SectionHeader title="Transfers" badge={`${transferTxns.length}`} isOpen={openSections.transferTxns} onToggle={() => toggleSection('transferTxns')} />
          {openSections.transferTxns && (
          <div className="border-b border-bw-200">
            <DataTable
              data={transferTxns.slice(0, 50)}
              columns={[
                { key: 'date' as const, label: 'Date', width: '80px' },
                { key: 'payee' as const, label: 'Payee' },
                { key: 'debit' as const, label: 'Out', align: 'right', render: (v) => v !== null ? fmtMoney(v as number) : '' },
                { key: 'credit' as const, label: 'In', align: 'right', render: (v) => v !== null ? fmtMoney(v as number) : '' },
              ]}
            />
          </div>
          )}
        </>
      )}

      {/* All Deposits */}
      {creditTxns.length > 0 && (
        <>
          <SectionHeader title="All Deposits" badge={`${creditTxns.length}`} isOpen={openSections.deposits} onToggle={() => toggleSection('deposits')} />
          {openSections.deposits && (
          <div className="border-b border-bw-200">
            <DataTable
              data={creditTxns.slice(0, 50)}
              columns={[
                { key: 'date' as const, label: 'Date', width: '80px' },
                { key: 'payee' as const, label: 'Payee' },
                { key: 'credit' as const, label: 'Amount', align: 'right', render: (v) => v !== null ? fmtMoney(v as number) : '' },
              ]}
            />
          </div>
          )}
        </>
      )}

      {/* All Withdrawals */}
      {debitTxns.length > 0 && (
        <>
          <SectionHeader title="All Withdrawals" badge={`${debitTxns.length}`} isOpen={openSections.withdrawals} onToggle={() => toggleSection('withdrawals')} />
          {openSections.withdrawals && (
          <div className="border-b border-bw-200">
            <DataTable
              data={debitTxns.slice(0, 50)}
              columns={[
                { key: 'date' as const, label: 'Date', width: '80px' },
                { key: 'payee' as const, label: 'Payee' },
                { key: 'debit' as const, label: 'Amount', align: 'right', render: (v) => v !== null ? fmtMoney(v as number) : '' },
              ]}
            />
          </div>
          )}
        </>
      )}

      {/* AI Risk Analysis */}
      {result.ai_analysis?.analysis && (
        <>
          <SectionHeader title="AI Risk Analysis" isOpen={openSections.risk} onToggle={() => toggleSection('risk')} />
          {openSections.risk && (
          <div className="px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {result.ai_analysis.analysis.risk_indicators.has_large_unusual_transactions && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-[10px] font-semibold text-red-700 uppercase">Large/Unusual</span>
                </div>
              )}
              {result.ai_analysis.analysis.risk_indicators.has_overdraft_signs && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-semibold text-amber-700 uppercase">Overdraft</span>
                </div>
              )}
              {result.ai_analysis.analysis.risk_indicators.has_high_fee_pattern && (
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  <span className="text-[10px] font-semibold text-orange-700 uppercase">High Fees</span>
                </div>
              )}
              {result.ai_analysis.analysis.risk_indicators.has_returned_items && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  <span className="text-[10px] font-semibold text-purple-700 uppercase">Returned Items</span>
                </div>
              )}
            </div>
            {result.ai_analysis.analysis.recommendations.length > 0 && (
              <div className="mt-4">
                <h4 className="text-[10px] font-semibold text-bw-500 uppercase tracking-wider mb-2">Recommendations</h4>
                <ul className="space-y-1.5">
                  {result.ai_analysis.analysis.recommendations.map((rec, i) => (
                    <li key={i} className="text-[11px] text-bw-600 flex items-start gap-2">
                      <span className="text-bw-400 mt-0.5">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="px-5 py-2.5 bg-bw-50 border-t border-bw-200 flex items-center justify-between">
        <span className="text-[10px] text-bw-400">
          {transactions.length} transactions · {mcaTxns.length} MCA · {nsfTxns.length} NSF/OD · {transferTxns.length} transfers
        </span>
        <span className="text-[10px] text-bw-400">
          {result.document_type?.type || 'Document'} · {Math.round((result.document_type?.confidence ?? 0) * 100)}%
        </span>
      </div>
    </div>
  );
}

export default InsightsScorecard;
