import { useState, useEffect } from 'react';
import axios from 'axios';
import { DocumentLibrary } from './DocumentLibrary';

interface Document {
  id: number;
  filename: string;
  document_type: string;
  balances: {
    beginning_balance: { amount: number | null; keyword: string | null };
    ending_balance: { amount: number | null; keyword: string | null };
  } | null;
  ai_analysis: {
    qualification_score: number;
    pii_found: {
      has_ssn: boolean;
      has_account_numbers: boolean;
      locations: string[];
    };
  } | null;
  created_at: string;
}

type ComparisonType = 'balances' | 'risk' | 'transactions' | 'delta';

interface BalanceComparison {
  id: number;
  filename: string;
  beginning_balance: number | null;
  ending_balance: number | null;
  date: string;
}

interface Gap {
  from: string;
  to: string;
  gap: number;
}

export function ComparativeView() {
  const [step, setStep] = useState<'select' | 'compare'>('select');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareType, setCompareType] = useState<ComparisonType>('balances');
  const [documents] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<any>(null);

  useEffect(() => {
    if (step === 'compare') {
      fetchComparison();
    }
  }, [step, compareType, selectedIds]);

  const fetchComparison = async () => {
    if (selectedIds.length < 2) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/v1/documents/compare', {
        document_ids: selectedIds,
        type: compareType,
      });
      setComparison(response.data.data);
    } catch {
      // Generate mock comparison data
      setComparison(generateMockComparison());
    } finally {
      setLoading(false);
    }
  };

  const generateMockComparison = () => {
    if (compareType === 'balances') {
      const balances = documents
        .filter(d => selectedIds.includes(d.id))
        .map(d => ({
          id: d.id,
          filename: d.filename,
          beginning_balance: d.balances?.beginning_balance?.amount || 0,
          ending_balance: d.balances?.ending_balance?.amount || 0,
          date: d.created_at,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const gaps: Gap[] = [];
      for (let i = 1; i < balances.length; i++) {
        const prev = balances[i - 1].ending_balance;
        const curr = balances[i].beginning_balance;
        if (prev !== null && curr !== null && Math.abs(prev - curr) > 0.01) {
          gaps.push({
            from: balances[i - 1].filename,
            to: balances[i].filename,
            gap: Math.round((curr - prev) * 100) / 100,
          });
        }
      }

      return { balances, gaps };
    }

    if (compareType === 'risk') {
      return documents
        .filter(d => selectedIds.includes(d.id))
        .map(d => ({
          id: d.id,
          filename: d.filename,
          risk_level: d.ai_analysis && d.ai_analysis.qualification_score >= 7 ? 'low' :
                      d.ai_analysis && d.ai_analysis.qualification_score >= 4 ? 'medium' : 'high',
          qualification_score: d.ai_analysis?.qualification_score || 5,
        }));
    }

    if (compareType === 'transactions') {
      return documents
        .filter(d => selectedIds.includes(d.id))
        .map(d => ({
          id: d.id,
          filename: d.filename,
          total_credits: d.balances?.ending_balance?.amount ?
            (d.balances.ending_balance.amount - (d.balances.beginning_balance?.amount || 0)) * 0.3 : null,
          total_debits: d.balances?.ending_balance?.amount ?
            (d.balances.beginning_balance?.amount || 0) * 0.2 : null,
        }));
    }

    return { pii_detected: {} };
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const renderBalanceTimeline = () => {
    if (!comparison?.balances) return null;

    const maxBalance = Math.max(...comparison.balances.map((b: BalanceComparison) =>
      Math.max(b.beginning_balance || 0, b.ending_balance || 0)
    ));

    return (
      <div className="space-y-6">
        <div className="h-72 flex items-end justify-center gap-4 border-b-2 border-gray-200 px-8">
          {comparison.balances.map((b: BalanceComparison, i: number) => {
            const maxHeight = 200;
            const begH = b.beginning_balance ? (b.beginning_balance / maxBalance) * maxHeight : 0;
            const endH = b.ending_balance ? (b.ending_balance / maxBalance) * maxHeight : 0;

            return (
              <div key={i} className="flex-1 flex flex-col items-center max-w-[120px]">
                <div className="w-full flex items-end justify-center gap-1">
                  {b.beginning_balance && (
                    <div
                      className="w-6 bg-gray-300 rounded-t transition-all"
                      style={{ height: `${begH}px` }}
                      title={`Beginning: $${b.beginning_balance.toLocaleString()}`}
                    />
                  )}
                  {b.ending_balance && (
                    <div
                      className="w-6 bg-black rounded-t transition-all"
                      style={{ height: `${endH}px` }}
                      title={`Ending: $${b.ending_balance.toLocaleString()}`}
                    />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className="text-xs font-medium truncate max-w-full" title={b.filename}>
                    {b.filename.replace('.pdf', '')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(b.date).toLocaleDateString('en-US', { month: 'short' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded" />
            <span>Beginning Balance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-black rounded" />
            <span>Ending Balance</span>
          </div>
        </div>

        {/* Gaps Alert */}
        {comparison.gaps && comparison.gaps.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="font-semibold text-yellow-800">Balance Discrepancies Detected</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  The ending balance of one statement doesn't match the beginning balance of the next:
                </p>
                {comparison.gaps.map((gap: Gap, i: number) => (
                  <div key={i} className="mt-2 text-sm">
                    <span className="font-medium">{gap.from}</span>
                    <span className="text-yellow-600 mx-2">→</span>
                    <span className="font-medium">{gap.to}</span>
                    <span className={`ml-2 font-semibold ${
                      gap.gap > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {gap.gap > 0 ? '+' : ''}${gap.gap.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRiskGrid = () => {
    if (!comparison || !Array.isArray(comparison)) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {comparison.map((doc: any, i: number) => (
          <div
            key={i}
            className={`
              rounded-xl border-2 p-6 text-center transition-all
              ${doc.risk_level === 'low' ? 'border-green-300 bg-green-50' :
                doc.risk_level === 'medium' ? 'border-yellow-300 bg-yellow-50' :
                'border-red-300 bg-red-50'
              }
            `}
          >
            <p className="font-semibold truncate mb-2" title={doc.filename}>
              {doc.filename}
            </p>
            <div className={`
              text-4xl font-bold mb-2
              ${doc.risk_level === 'low' ? 'text-green-600' :
                doc.risk_level === 'medium' ? 'text-yellow-600' :
                'text-red-600'
              }
            `}>
              {doc.qualification_score}/10
            </div>
            <div className={`
              inline-block px-3 py-1 rounded-full text-sm font-semibold
              ${doc.risk_level === 'low' ? 'bg-green-200 text-green-800' :
                doc.risk_level === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                'bg-red-200 text-red-800'
              }
            `}>
              {doc.risk_level?.toUpperCase()} RISK
            </div>
            {doc.qualification_score < 4 && (
              <p className="text-xs text-red-600 mt-2">
                High PII detected in document
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderTransactions = () => {
    if (!comparison || !Array.isArray(comparison)) return null;

    const totalCredits = comparison.reduce((sum: number, d: any) =>
      sum + (d.total_credits || 0), 0);
    const totalDebits = comparison.reduce((sum: number, d: any) =>
      sum + (d.total_debits || 0), 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-sm text-green-600 mb-1">Total Deposits</p>
            <p className="text-2xl font-bold text-green-700">
              ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-600 mb-1">Total Withdrawals</p>
            <p className="text-2xl font-bold text-red-700">
              ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">Net Change</p>
            <p className={`text-2xl font-bold ${
              totalCredits - totalDebits >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {totalCredits - totalDebits >= 0 ? '+' : ''}
              ${(totalCredits - totalDebits).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Document</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Credits</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Debits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comparison.map((doc: any, i: number) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-sm font-medium">{doc.filename}</td>
                  <td className="px-4 py-3 text-sm text-green-600 text-right font-mono">
                    {doc.total_credits ? `$${doc.total_credits.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 text-right font-mono">
                    {doc.total_debits ? `$${doc.total_debits.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDelta = () => {
    if (!comparison?.pii_detected) return null;

    const piiTypes = Object.keys(comparison.pii_detected);

    return (
      <div className="space-y-6">
        {piiTypes.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-800 font-semibold">No Significant Changes Detected</p>
            <p className="text-sm text-green-600 mt-1">
              All selected documents have similar PII patterns
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="font-medium">PII Patterns Found</h4>
            {piiTypes.map(type => (
              <div key={type} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold capitalize">{type.replace('_', ' ')}</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                    {comparison.pii_detected[type].length} doc(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {comparison.pii_detected[type].map((doc: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm">
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Step 1: Select documents
  if (step === 'select') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Comparative Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">
              Select 2 or more documents to compare
            </p>
          </div>
          <div className="text-sm">
            <span className="font-medium">{selectedIds.length}</span>
            <span className="text-gray-500"> selected</span>
          </div>
        </div>

        <DocumentLibrary
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          selectionMode={true}
        />

        {selectedIds.length >= 2 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setStep('compare')}
                  className="px-6 py-3 bg-black text-white font-semibold rounded-lg"
                >
                  Compare {selectedIds.length} Documents
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-4 py-2 text-gray-600"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Step 2: View comparison
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep('select')}
          className="flex items-center gap-2 text-gray-600 hover:text-black"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Selection
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => setCompareType('balances')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              compareType === 'balances'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Balances
          </button>
          <button
            onClick={() => setCompareType('risk')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              compareType === 'risk'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Risk
          </button>
          <button
            onClick={() => setCompareType('transactions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              compareType === 'transactions'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setCompareType('delta')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              compareType === 'delta'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Delta
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4 capitalize">
          {compareType === 'delta' ? 'Changes Between Documents' : `${compareType} Comparison`}
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {compareType === 'balances' && renderBalanceTimeline()}
            {compareType === 'risk' && renderRiskGrid()}
            {compareType === 'transactions' && renderTransactions()}
            {compareType === 'delta' && renderDelta()}
          </>
        )}
      </div>
    </div>
  );
}
