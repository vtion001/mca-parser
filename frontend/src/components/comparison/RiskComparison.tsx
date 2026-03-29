interface RiskComparisonProps {
  comparison: Array<{
    id: number;
    filename: string;
    risk_level: 'low' | 'medium' | 'high';
    qualification_score: number;
  }> | null;
}

export function RiskComparison({ comparison }: RiskComparisonProps) {
  if (!comparison || !Array.isArray(comparison)) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {comparison.map((doc, i) => (
        <div
          key={i}
          className={`
              rounded-xl border-2 p-6 text-center transition-all
              ${
                doc.risk_level === 'low'
                  ? 'border-green-300 bg-green-50'
                  : doc.risk_level === 'medium'
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-red-300 bg-red-50'
              }
            `}
        >
          <p className="font-semibold truncate mb-2" title={doc.filename}>
            {doc.filename}
          </p>
          <div
            className={`
              text-4xl font-bold mb-2
              ${
                doc.risk_level === 'low'
                  ? 'text-green-600'
                  : doc.risk_level === 'medium'
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }
            `}
          >
            {doc.qualification_score}/10
          </div>
          <div
            className={`
              inline-block px-3 py-1 rounded-full text-sm font-semibold
              ${
                doc.risk_level === 'low'
                  ? 'bg-green-200 text-green-800'
                  : doc.risk_level === 'medium'
                  ? 'bg-yellow-200 text-yellow-800'
                  : 'bg-red-200 text-red-800'
              }
            `}
          >
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
}
