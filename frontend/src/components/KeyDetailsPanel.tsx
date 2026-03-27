import type { KeyDetail } from '../types/extraction';

interface KeyDetailsPanelProps {
  details: KeyDetail[];
  documentType: string;
  typeConfidence: number;
}

export function KeyDetailsPanel({ details, documentType, typeConfidence }: KeyDetailsPanelProps) {
  const formatLabel = (label: string) => label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-bw-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-bw-700">Key Details</span>
          <span className="px-2 py-0.5 text-xs font-medium bg-bw-100 text-bw-600 rounded">
            {documentType}
          </span>
          <span className="text-xs text-bw-400">
            ({Math.round(typeConfidence * 100)}% confidence)
          </span>
        </div>
      </div>

      {details.length === 0 ? (
        <div className="px-6 py-8 text-center text-bw-400 text-sm">
          No key details detected
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bw-100">
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider">Field</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bw-100">
              {details.map((detail, index) => (
                <tr key={index} className="hover:bg-bw-50">
                  <td className="px-6 py-4 text-sm font-medium text-bw-700">{formatLabel(detail.label)}</td>
                  <td className="px-6 py-4 text-sm text-bw-600 font-mono">{detail.value}</td>
                  <td className="px-6 py-4 text-sm text-bw-400">{detail.page}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
