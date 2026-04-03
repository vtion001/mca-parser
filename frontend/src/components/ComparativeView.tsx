import { useState, useEffect } from 'react';
import api from '../services/api';
import { ComparisonSelector } from './comparison/ComparisonSelector';
import { BalanceComparison } from './comparison/BalanceComparison';
import { DeltaComparison } from './comparison/DeltaComparison';
import { RiskComparison } from './comparison/RiskComparison';

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
      const response = await api.post('/documents/compare', {
        document_ids: selectedIds,
        type: compareType,
      });
      setComparison(response.data.data);
    } catch {
      setComparison(generateMockComparison());
    } finally {
      setLoading(false);
    }
  };

  const generateMockComparison = () => {
    if (compareType === 'balances') {
      const balances = documents
        .filter((d) => selectedIds.includes(d.id))
        .map((d) => ({
          id: d.id,
          filename: d.filename,
          beginning_balance: d.balances?.beginning_balance?.amount || 0,
          ending_balance: d.balances?.ending_balance?.amount || 0,
          date: d.created_at,
        }))
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      const gaps: Gap[] = [];
      for (let i = 1; i < balances.length; i++) {
        const prev = balances[i - 1].ending_balance;
        const curr = balances[i].beginning_balance;
        if (
          prev !== null &&
          curr !== null &&
          Math.abs(prev - curr) > 0.01
        ) {
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
        .filter((d) => selectedIds.includes(d.id))
        .map((d) => ({
          id: d.id,
          filename: d.filename,
          risk_level:
            d.ai_analysis && d.ai_analysis.qualification_score >= 7
              ? 'low'
              : d.ai_analysis && d.ai_analysis.qualification_score >= 4
              ? 'medium'
              : 'high',
          qualification_score: d.ai_analysis?.qualification_score || 5,
        }));
    }

    if (compareType === 'transactions') {
      return documents
        .filter((d) => selectedIds.includes(d.id))
        .map((d) => ({
          id: d.id,
          filename: d.filename,
          total_credits: d.balances?.ending_balance?.amount
            ? (d.balances.ending_balance.amount -
                (d.balances.beginning_balance?.amount || 0)) *
              0.3
            : null,
          total_debits: d.balances?.ending_balance?.amount
            ? (d.balances.beginning_balance?.amount || 0) * 0.2
            : null,
        }));
    }

    return { pii_detected: {} };
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Step 1: Select documents
  if (step === 'select') {
    return (
      <ComparisonSelector
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onCompare={() => setStep('compare')}
        onClearSelection={() => setSelectedIds([])}
      />
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
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
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
          {compareType === 'delta'
            ? 'Changes Between Documents'
            : `${compareType} Comparison`}
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {compareType === 'balances' && <BalanceComparison comparison={comparison} />}
            {compareType === 'risk' && <RiskComparison comparison={comparison} />}
            {compareType === 'transactions' && <DeltaComparison comparison={comparison} />}
            {compareType === 'delta' && <DeltaComparison comparison={comparison} />}
          </>
        )}
      </div>
    </div>
  );
}
