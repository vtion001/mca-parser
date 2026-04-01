import type { ExtractionResult } from '../../types/extraction';

interface McaFindingsProps {
  result: ExtractionResult;
}

export function McaFindings({ result }: McaFindingsProps) {
  const mca = result.mca_findings;

  if (!mca || mca.transactions.length === 0) {
    return null;
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'provider_match':
        return 'Provider Match';
      case 'keyword_match':
        return 'Keyword Match';
      case 'ai_review':
        return 'AI Review';
      case 'prefilter_fallback':
        return 'Fallback';
      default:
        return source;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-bw-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-bw-700">MCA Transactions</h3>
          <p className="text-xs text-bw-400 mt-0.5">
            Detected {mca.summary.total_mca_transactions} transactions from{' '}
            {mca.summary.unique_providers.length} provider(s)
          </p>
        </div>
        {mca.summary.unique_providers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mca.summary.unique_providers.slice(0, 3).map((provider) => (
              <span
                key={provider}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
              >
                {provider}
              </span>
            ))}
            {mca.summary.unique_providers.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                +{mca.summary.unique_providers.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <span className="text-xs font-medium text-bw-500 uppercase tracking-wider">
              Total MCA Amount
            </span>
            <p className="text-xl font-semibold text-bw-900 mt-1">
              {formatCurrency(mca.summary.total_mca_amount)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <span className="text-xs font-medium text-bw-500 uppercase tracking-wider">
              Transactions
            </span>
            <p className="text-xl font-semibold text-bw-900 mt-1">
              {mca.summary.total_mca_transactions}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <span className="text-xs font-medium text-bw-500 uppercase tracking-wider">
              Avg. Confidence
            </span>
            <p className="text-xl font-semibold text-bw-900 mt-1">
              {formatConfidence(mca.summary.average_confidence)}
            </p>
          </div>
        </div>

        {/* Transaction List */}
        {mca.transactions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-bw-600 uppercase tracking-wider mb-3">
              Detected Transactions
            </h4>
            <div className="space-y-2">
              {mca.transactions.slice(0, 10).map((txn, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-bw-800 truncate">
                      {txn.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {txn.mca_provider && (
                        <span className="text-xs text-blue-600 font-medium">
                          {txn.mca_provider}
                        </span>
                      )}
                      <span className="text-xs text-bw-400">
                        {txn.date || 'No date'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getConfidenceColor(
                        txn.confidence
                      )}`}
                    >
                      {formatConfidence(txn.confidence)}
                    </span>
                    <span className="text-xs text-bw-500 bg-bw-100 px-2 py-0.5 rounded">
                      {getSourceLabel(txn.source)}
                    </span>
                    {txn.amount !== null && (
                      <span className="text-sm font-semibold text-bw-700">
                        {formatCurrency(txn.amount)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {mca.transactions.length > 10 && (
                <p className="text-xs text-bw-400 text-center py-2">
                  +{mca.transactions.length - 10} more transactions
                </p>
              )}
            </div>
          </div>
        )}

        {/* AI Review Section */}
        {mca.candidates_reviewed && mca.candidates_reviewed.length > 0 && (
          <div className="mt-6 pt-6 border-t border-bw-100">
            <h4 className="text-xs font-semibold text-bw-600 uppercase tracking-wider mb-3">
              AI-Reviewed Candidates
            </h4>
            <div className="space-y-2">
              {mca.candidates_reviewed.slice(0, 5).map((txn, index) => (
                <div
                  key={`ai-${index}`}
                  className="flex items-center justify-between p-3 bg-amber-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-bw-800 truncate">
                      {txn.description}
                    </p>
                    {txn.reasoning && (
                      <p className="text-xs text-bw-500 mt-1 truncate">
                        {txn.reasoning}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {txn.is_mca ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        MCA
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        Not MCA
                      </span>
                    )}
                    {txn.amount !== null && (
                      <span className="text-sm font-semibold text-bw-700">
                        {formatCurrency(txn.amount)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
