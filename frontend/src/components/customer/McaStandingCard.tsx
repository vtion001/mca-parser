import { useState, useEffect } from 'react';
import api from '../../services/api';

export interface McaStanding {
  eligibility_score: number;
  eligibility_level: 'excellent' | 'good' | 'moderate' | 'limited' | 'restricted';
  average_balance: number;
  average_monthly_revenue: number;
  total_mca_payments: number;
  mca_payment_count: number;
  nsf_fee_count: number;
  total_nsf_fees: number;
  factors: Array<{
    category: string;
    indicator: 'positive' | 'concern' | 'neutral';
    message: string;
    value: unknown;
  }>;
  recommendation: {
    eligible: boolean;
    recommended: boolean;
    max_funding: boolean;
    message: string;
    concern_count: number;
    positive_count: number;
  };
  document_count: number;
  analysis_details: {
    balance_score: number;
    revenue_score: number;
    mca_score: number;
    nsf_score: number;
    balance_trend: string;
    revenue_trend: string;
  };
}

interface McaStandingCardProps {
  refreshTrigger?: number;
}

// Custom hook for MCA standing
function useMcaStanding(refreshTrigger: number = 0) {
  const [data, setData] = useState<McaStanding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get('/customer/mca-standing');
      setData(response.data.data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.message || 'Failed to load MCA standing');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [refreshTrigger]);

  return { data, isLoading, error, refetch };
}

export function McaStandingCard({ refreshTrigger = 0 }: McaStandingCardProps) {
  const { data: standing, isLoading, error, refetch } = useMcaStanding(refreshTrigger);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
    if (score >= 65) return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
    if (score >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' };
    if (score >= 35) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
    return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      excellent: 'Excellent',
      good: 'Good',
      moderate: 'Moderate',
      limited: 'Limited',
      restricted: 'Restricted',
    };
    return labels[level] || level;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !standing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">MCA Standing</h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          <p>Unable to load MCA standing</p>
          <button onClick={refetch} className="mt-2 text-xs underline hover:text-gray-700">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const colors = getScoreColor(standing.eligibility_score);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with Score */}
      <div className={`${colors.bg} ${colors.border} border-b p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">MCA Standing</h3>
            <p className="text-xs text-gray-500 mt-1">
              Based on {standing.document_count} document{standing.document_count !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${colors.text}`}>
              {standing.eligibility_score}
            </div>
            <div className={`text-xs font-medium ${colors.text}`}>
              {getLevelLabel(standing.eligibility_level)}
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="p-6 space-y-4">
        {/* Score Bars */}
        <div className="space-y-3">
          <ScoreBar label="Balance" score={standing.analysis_details.balance_score} />
          <ScoreBar label="Revenue" score={standing.analysis_details.revenue_score} />
          <ScoreBar label="MCA Usage" score={standing.analysis_details.mca_score} />
          <ScoreBar label="NSF Activity" score={standing.analysis_details.nsf_score} />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
          <MetricCard
            label="Avg Balance"
            value={formatCurrency(standing.average_balance)}
            trend={standing.analysis_details.balance_trend}
          />
          <MetricCard
            label="Avg Revenue"
            value={formatCurrency(standing.average_monthly_revenue)}
            trend={standing.analysis_details.revenue_trend}
          />
          <MetricCard
            label="MCA Payments"
            value={`${standing.mca_payment_count}x`}
            subValue={formatCurrency(standing.total_mca_payments)}
          />
          <MetricCard
            label="NSF Fees"
            value={`${standing.nsf_fee_count}x`}
            subValue={formatCurrency(standing.total_nsf_fees)}
          />
        </div>

        {/* Recommendation */}
        <div className="pt-4 border-t border-gray-100">
          <p className={`text-sm font-medium ${
            standing.recommendation.eligible ? 'text-green-700' :
            standing.eligibility_score >= 35 ? 'text-yellow-700' :
            'text-red-700'
          }`}>
            {standing.recommendation.message}
          </p>
        </div>

        {/* Factors */}
        {standing.factors.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Factors</h4>
            <div className="space-y-2">
              {standing.factors.slice(0, 4).map((factor, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 ${
                    factor.indicator === 'positive' ? 'text-green-500' :
                    factor.indicator === 'concern' ? 'text-red-500' :
                    'text-gray-400'
                  }`}>
                    {factor.indicator === 'positive' ? '↑' :
                     factor.indicator === 'concern' ? '↓' : '•'}
                  </span>
                  <span className="text-xs text-gray-600">{factor.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const getBarColor = (s: number) => {
    if (s >= 75) return 'bg-green-500';
    if (s >= 50) return 'bg-blue-500';
    if (s >= 35) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-20">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor(score)} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">{Math.round(score)}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  trend
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <p className="text-sm font-semibold text-gray-900">{value}</p>
        {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
      </div>
      {trend && trend !== 'stable' && trend !== 'unknown' && (
        <p className={`text-xs mt-1 ${
          trend === 'increasing' ? 'text-green-600' : 'text-red-600'
        }`}>
          {trend === 'increasing' ? '↑' : '↓'} {trend}
        </p>
      )}
    </div>
  );
}
