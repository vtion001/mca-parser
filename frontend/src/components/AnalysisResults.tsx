import type { ExtractionResult } from '../types/extraction';

interface AnalysisResultsProps {
  result: ExtractionResult;
}

export function AnalysisResults({ result }: AnalysisResultsProps) {
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Balance Summary */}
      {result.balances && (
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
                  {formatCurrency(result.balances.beginning_balance.amount)}
                </span>
                {result.balances.beginning_balance.keyword && (
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
                  {formatCurrency(result.balances.ending_balance.amount)}
                </span>
                {result.balances.ending_balance.keyword && (
                  <span className="text-xs text-bw-400 mt-1">
                    via "{result.balances.ending_balance.keyword}"
                  </span>
                )}
              </div>
            </div>

            {/* Balance Change Indicator */}
            {result.balances.beginning_balance.amount !== null &&
              result.balances.ending_balance.amount !== null && (
                <div className="mt-4 pt-4 border-t border-bw-100">
                  <span className="text-xs font-medium text-bw-500 uppercase tracking-wider">
                    Net Change
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {result.balances.ending_balance.amount -
                      result.balances.beginning_balance.amount >
                    0 ? (
                      <span className="text-lg font-semibold text-green-600">
                        +
                        {formatCurrency(
                          result.balances.ending_balance.amount -
                            result.balances.beginning_balance.amount
                        )}
                      </span>
                    ) : (
                      <span className="text-lg font-semibold text-red-600">
                        {formatCurrency(
                          result.balances.ending_balance.amount -
                            result.balances.beginning_balance.amount
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {result.ai_analysis && result.ai_analysis.success && result.ai_analysis.analysis && (
        <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-bw-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-bw-700">AI Document Analysis</h3>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  result.ai_analysis.analysis.qualification_score >= 7
                    ? 'bg-green-100 text-green-700'
                    : result.ai_analysis.analysis.qualification_score >= 4
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                Score: {result.ai_analysis.analysis.qualification_score}/10
              </span>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* Document Validity */}
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  result.ai_analysis.analysis.is_valid_document
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {result.ai_analysis.analysis.is_valid_document ? '✓' : '✗'}
              </div>
              <div>
                <p className="text-sm font-medium text-bw-700">
                  {result.ai_analysis.analysis.is_valid_document
                    ? 'Valid Financial Document'
                    : 'Document May Not Be Valid'}
                </p>
                <p className="text-xs text-bw-500 mt-0.5">
                  {result.ai_analysis.analysis.completeness.is_complete
                    ? 'Document appears complete'
                    : 'Document may be truncated or incomplete'}
                  {result.ai_analysis.analysis.completeness.concerns.length > 0 &&
                    `: ${result.ai_analysis.analysis.completeness.concerns.join(', ')}`}
                </p>
              </div>
            </div>

            {/* PII Found */}
            {result.ai_analysis.analysis.pii_found && (
              <div>
                <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">
                  PII Indicators
                </h4>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`px-3 py-1.5 rounded-full text-sm ${
                      result.ai_analysis.analysis.pii_found.has_ssn
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    SSN: {result.ai_analysis.analysis.pii_found.has_ssn ? 'Found' : 'Not found'}
                  </span>
                  <span
                    className={`px-3 py-1.5 rounded-full text-sm ${
                      result.ai_analysis.analysis.pii_found.has_account_numbers
                        ? 'bg-orange-100 text-orange-700 border border-orange-200'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    Account #:{' '}
                    {result.ai_analysis.analysis.pii_found.has_account_numbers
                      ? 'Found'
                      : 'Not found'}
                  </span>
                </div>
              </div>
            )}

            {/* Transaction Summary */}
            {result.ai_analysis.analysis.transaction_summary && (
              <div>
                <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">
                  Transaction Summary
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <span className="text-xs text-blue-600 font-medium">Credits</span>
                    <p className="text-lg font-semibold text-blue-900">
                      {result.ai_analysis.analysis.transaction_summary.credit_count ?? 'N/A'}
                    </p>
                    {result.ai_analysis.analysis.transaction_summary
                      .total_amount_credits !== null && (
                      <p className="text-sm text-blue-700">
                        +$
                        {result.ai_analysis.analysis.transaction_summary.total_amount_credits.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <span className="text-xs text-red-600 font-medium">Debits</span>
                    <p className="text-lg font-semibold text-red-900">
                      {result.ai_analysis.analysis.transaction_summary.debit_count ?? 'N/A'}
                    </p>
                    {result.ai_analysis.analysis.transaction_summary.total_amount_debits !==
                      null && (
                      <p className="text-sm text-red-700">
                        -$
                        {result.ai_analysis.analysis.transaction_summary.total_amount_debits.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Risk Indicators */}
            {result.ai_analysis.analysis.risk_indicators &&
              result.ai_analysis.analysis.risk_indicators.details.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">
                    Risk Indicators
                  </h4>
                  <div className="space-y-2">
                    {result.ai_analysis.analysis.risk_indicators.has_large_unusual_transactions && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-bw-600">Large/unusual transactions detected</span>
                      </div>
                    )}
                    {result.ai_analysis.analysis.risk_indicators.has_overdraft_signs && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-bw-600">Overdraft indicators present</span>
                      </div>
                    )}
                    {result.ai_analysis.analysis.risk_indicators.has_high_fee_pattern && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-bw-600">High fee pattern detected</span>
                      </div>
                    )}
                    {result.ai_analysis.analysis.risk_indicators.has_returned_items && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-bw-600">Returned items present</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Recommendations */}
            {result.ai_analysis.analysis.recommendations &&
              result.ai_analysis.analysis.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">
                    AI Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {result.ai_analysis.analysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-bw-600">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}

      {/* AI Analysis Error */}
      {result.ai_analysis && !result.ai_analysis.success && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-lg">⚠</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">AI Analysis Unavailable</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                {result.ai_analysis.error || 'Unable to complete AI analysis'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
