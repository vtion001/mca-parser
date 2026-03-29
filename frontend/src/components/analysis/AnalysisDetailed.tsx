import type { ExtractionResult } from '../../types/extraction';

interface AnalysisDetailedProps {
  result: ExtractionResult;
}

export function AnalysisDetailed({ result }: AnalysisDetailedProps) {
  if (!result.ai_analysis || !result.ai_analysis.success || !result.ai_analysis.analysis) {
    return null;
  }

  const analysis = result.ai_analysis.analysis;

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-bw-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-bw-700">AI Document Analysis</h3>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              analysis.qualification_score >= 7
                ? 'bg-green-100 text-green-700'
                : analysis.qualification_score >= 4
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            Score: {analysis.qualification_score}/10
          </span>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {/* Document Validity */}
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              analysis.is_valid_document
                ? 'bg-green-100 text-green-600'
                : 'bg-red-100 text-red-600'
            }`}
          >
            {analysis.is_valid_document ? '✓' : '✗'}
          </div>
          <div>
            <p className="text-sm font-medium text-bw-700">
              {analysis.is_valid_document
                ? 'Valid Financial Document'
                : 'Document May Not Be Valid'}
            </p>
            <p className="text-xs text-bw-500 mt-0.5">
              {analysis.completeness?.is_complete
                ? 'Document appears complete'
                : 'Document may be truncated or incomplete'}
              {analysis.completeness?.concerns?.length > 0 &&
                `: ${analysis.completeness?.concerns?.join(', ')}`}
            </p>
          </div>
        </div>

        {/* PII Found */}
        {analysis.pii_found && (
          <div>
            <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">
              PII Indicators
            </h4>
            <div className="flex flex-wrap gap-2">
              <span
                className={`px-3 py-1.5 rounded-full text-sm ${
                  analysis.pii_found.has_ssn
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                SSN: {analysis.pii_found.has_ssn ? 'Found' : 'Not found'}
              </span>
              <span
                className={`px-3 py-1.5 rounded-full text-sm ${
                  analysis.pii_found.has_account_numbers
                    ? 'bg-orange-100 text-orange-700 border border-orange-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                Account #:{' '}
                {analysis.pii_found.has_account_numbers
                  ? 'Found'
                  : 'Not found'}
              </span>
            </div>
          </div>
        )}

        {/* Transaction Summary */}
        {analysis.transaction_summary && (
          <div>
            <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">
              Transaction Summary
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <span className="text-xs text-blue-600 font-medium">Credits</span>
                <p className="text-lg font-semibold text-blue-900">
                  {analysis.transaction_summary.credit_count ?? 'N/A'}
                </p>
                {analysis.transaction_summary.total_amount_credits !== null && (
                  <p className="text-sm text-blue-700">
                    +$
                    {analysis.transaction_summary.total_amount_credits.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <span className="text-xs text-red-600 font-medium">Debits</span>
                <p className="text-lg font-semibold text-red-900">
                  {analysis.transaction_summary.debit_count ?? 'N/A'}
                </p>
                {analysis.transaction_summary.total_amount_debits !== null && (
                  <p className="text-sm text-red-700">
                    -$
                    {analysis.transaction_summary.total_amount_debits.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Risk Indicators */}
        {analysis.risk_indicators &&
          analysis.risk_indicators.details.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">
                Risk Indicators
              </h4>
              <div className="space-y-2">
                {analysis.risk_indicators.has_large_unusual_transactions && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-bw-600">Large/unusual transactions detected</span>
                  </div>
                )}
                {analysis.risk_indicators.has_overdraft_signs && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-bw-600">Overdraft indicators present</span>
                  </div>
                )}
                {analysis.risk_indicators.has_high_fee_pattern && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-bw-600">High fee pattern detected</span>
                  </div>
                )}
                {analysis.risk_indicators.has_returned_items && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-bw-600">Returned items present</span>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Recommendations */}
        {analysis.recommendations &&
          analysis.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">
                AI Recommendations
              </h4>
              <ul className="space-y-2">
                {analysis.recommendations.map((rec, idx) => (
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
  );
}
