interface DeltaComparisonProps {
  comparison: Array<{
    id: number;
    filename: string;
    total_credits: number | null;
    total_debits: number | null;
  }> | null;
}

export function DeltaComparison({ comparison }: DeltaComparisonProps) {
  if (!comparison || !Array.isArray(comparison)) return null;

  const totalCredits = comparison.reduce(
    (sum, d) => sum + (d.total_credits || 0),
    0
  );
  const totalDebits = comparison.reduce(
    (sum, d) => sum + (d.total_debits || 0),
    0
  );

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
          <p
            className={`text-2xl font-bold ${
              totalCredits - totalDebits >= 0 ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {totalCredits - totalDebits >= 0 ? '+' : ''}$
            {(totalCredits - totalDebits).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Document
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                Credits
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                Debits
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {comparison.map((doc, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-sm font-medium">{doc.filename}</td>
                <td className="px-4 py-3 text-sm text-green-600 text-right font-mono">
                  {doc.total_credits
                    ? `$${doc.total_credits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-red-600 text-right font-mono">
                  {doc.total_debits
                    ? `$${doc.total_debits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
