import { BatchDocument } from './BatchDocumentList';

export interface Batch {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  total_documents: number;
  completed_documents: number;
  documents: BatchDocument[];
}

interface BatchProgressProps {
  batch: Batch;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'complete':
      return (
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'failed':
      return (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'processing':
      return (
        <svg className="w-4 h-4 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    default:
      return <span className="w-4 h-4 rounded-full border-2 border-gray-300" />;
  }
}

function getRiskLevel(score: number | undefined) {
  if (score === undefined) return { level: 'unknown', color: 'text-gray-400' };
  if (score >= 7) return { level: 'Low', color: 'text-green-600' };
  if (score >= 4) return { level: 'Medium', color: 'text-yellow-600' };
  return { level: 'High', color: 'text-red-600' };
}

export function BatchProgress({ batch }: BatchProgressProps) {
  const progress = Math.round((batch.completed_documents / batch.total_documents) * 100);
  const failedCount = batch.documents.filter(d => d.status === 'failed').length;
  const completeCount = batch.documents.filter(d => d.status === 'complete').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{batch.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Batch Processing in Progress
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{progress}%</div>
          <div className="text-sm text-gray-500">
            {batch.completed_documents}/{batch.total_documents} complete
          </div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Progress</span>
          <div className="flex items-center gap-4 text-sm">
            {completeCount > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {completeCount}
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {failedCount}
              </span>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Document Status Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ending Balance</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batch.documents.map((doc) => {
              const risk = getRiskLevel(doc.ai_analysis?.qualification_score);
              return (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{doc.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(doc.status)}
                      <span className={`text-sm capitalize ${
                        doc.status === 'complete' ? 'text-green-600' :
                        doc.status === 'failed' ? 'text-red-600' :
                        doc.status === 'processing' ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {doc.balances?.ending_balance?.amount
                      ? `$${doc.balances.ending_balance.amount.toLocaleString()}`
                      : '-'
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${risk.color}`}>
                      {risk.level}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface BatchCompleteProps {
  batch: Batch;
  onReset: () => void;
}

export function BatchComplete({ batch, onReset }: BatchCompleteProps) {
  const completeCount = batch.documents.filter(d => d.status === 'complete').length;
  const failedCount = batch.documents.filter(d => d.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-8 text-center">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Batch Complete</h2>
        <p className="text-gray-500 mb-6">{batch.name}</p>

        <div className="flex justify-center gap-8 mb-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{completeCount}</div>
            <div className="text-sm text-gray-500">Successful</div>
          </div>
          {failedCount > 0 && (
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{failedCount}</div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={onReset}
            className="px-6 py-3 bg-black text-white font-semibold rounded-lg"
          >
            Process More Documents
          </button>
        </div>
      </div>
    </div>
  );
}
