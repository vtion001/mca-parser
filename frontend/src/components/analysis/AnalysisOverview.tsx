import type { ExtractionResult } from '../../types/extraction';

interface AnalysisOverviewProps {
  result: ExtractionResult;
}

export function AnalysisOverview({ result }: AnalysisOverviewProps) {
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!result.balances) {
    return null;
  }

  const beginningAmount = result.balances.beginning_balance?.amount ?? null;
  const endingAmount = result.balances.ending_balance?.amount ?? null;
  const netChange = endingAmount !== null && beginningAmount !== null
    ? endingAmount - beginningAmount
    : null;

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-bw-100">
        <h3 className="text-sm font-semibold text-bw-700">Balance Summary</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-bw-500 uppercase tracking-wider mb-1">
              Beginning Balance
            </span>
            <span className="text-2xl font-semibold text-bw-900">
              {formatCurrency(beginningAmount)}
            </span>
            {result.balances.beginning_balance?.keyword && (
              <span className="text-xs text-bw-400 mt-1">
                via "{result.balances.beginning_balance.keyword}"
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-bw-500 uppercase tracking-wider mb-1">
              Ending Balance
            </span>
            <span className="text-2xl font-semibold text-bw-900">
              {formatCurrency(endingAmount)}
            </span>
            {result.balances.ending_balance?.keyword && (
              <span className="text-xs text-bw-400 mt-1">
                via "{result.balances.ending_balance.keyword}"
              </span>
            )}
          </div>
        </div>

        {/* Balance Change Indicator */}
        {netChange !== null && (
          <div className="mt-4 pt-4 border-t border-bw-100">
            <span className="text-xs font-medium text-bw-500 uppercase tracking-wider">
              Net Change
            </span>
            <div className="flex items-center gap-2 mt-1">
              {netChange > 0 ? (
                <span className="text-lg font-semibold text-green-600">
                  +
                  {formatCurrency(netChange)}
                </span>
              ) : (
                <span className="text-lg font-semibold text-red-600">
                  {formatCurrency(netChange)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
