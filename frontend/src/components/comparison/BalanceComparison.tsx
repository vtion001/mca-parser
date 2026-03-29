interface BalanceComparisonProps {
  comparison: {
    balances: Array<{
      id: number;
      filename: string;
      beginning_balance: number | null;
      ending_balance: number | null;
      date: string;
    }>;
    gaps: Array<{
      from: string;
      to: string;
      gap: number;
    }>;
  } | null;
}

export function BalanceComparison({ comparison }: BalanceComparisonProps) {
  if (!comparison?.balances) return null;

  const maxBalance = Math.max(
    ...comparison.balances.map((b) =>
      Math.max(b.beginning_balance || 0, b.ending_balance || 0)
    )
  );

  return (
    <div className="space-y-6">
      <div className="h-72 flex items-end justify-center gap-4 border-b-2 border-gray-200 px-8">
        {comparison.balances.map((b, i) => {
          const maxHeight = 200;
          const begH = b.beginning_balance
            ? (b.beginning_balance / maxBalance) * maxHeight
            : 0;
          const endH = b.ending_balance
            ? (b.ending_balance / maxBalance) * maxHeight
            : 0;

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
                <p
                  className="text-xs font-medium truncate max-w-full"
                  title={b.filename}
                >
                  {b.filename.replace('.pdf', '')}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(b.date).toLocaleDateString('en-US', {
                    month: 'short',
                  })}
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
            <svg
              className="w-5 h-5 text-yellow-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="font-semibold text-yellow-800">
                Balance Discrepancies Detected
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                The ending balance of one statement doesn&apos;t match the
                beginning balance of the next:
              </p>
              {comparison.gaps.map((gap, i) => (
                <div key={i} className="mt-2 text-sm">
                  <span className="font-medium">{gap.from}</span>
                  <span className="text-yellow-600 mx-2">→</span>
                  <span className="font-medium">{gap.to}</span>
                  <span
                    className={`ml-2 font-semibold ${
                      gap.gap > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
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
}
