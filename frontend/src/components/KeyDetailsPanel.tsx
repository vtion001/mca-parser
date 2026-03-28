import type { KeyDetail } from '../types/extraction';

interface KeyDetailsPanelProps {
  details: KeyDetail[];
  documentType: string;
  typeConfidence: number;
}

function isSuspiciousValue(value: string): boolean {
  const v = value.toLowerCase();
  return (
    v.includes('this is provided to help you balance') ||
    v.includes('your checkbook') ||
    v.includes('checks outstanding') ||
    v.includes('bank balance') ||
    v.includes('other bank charges') ||
    v.length > 120
  );
}

function truncateForDisplay(value: string, maxLen = 40): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 1) + '…';
}

export function KeyDetailsPanel({ details, documentType, typeConfidence }: KeyDetailsPanelProps) {
  const formatLabel = (label: string) =>
    label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Filter out garbage rows so they don't clutter the panel
  const cleanDetails = details.filter(d => !isSuspiciousValue(d.value));

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

      {cleanDetails.length === 0 ? (
        <div className="px-6 py-8 text-center text-bw-400 text-sm">
          No key details detected
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bw-100">
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider w-40">Field</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider w-16">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bw-100">
              {cleanDetails.map((detail, index) => {
                const isLong = detail.value.length > 40;
                const displayValue = isLong ? truncateForDisplay(detail.value) : detail.value;
                return (
                  <tr key={index} className="hover:bg-bw-50">
                    <td className="px-6 py-3 text-sm font-medium text-bw-700">{formatLabel(detail.label)}</td>
                    <td
                      className="px-6 py-3 text-sm font-mono text-bw-600 max-w-xs"
                      title={isLong ? detail.value : undefined}
                    >
                      {displayValue}
                    </td>
                    <td className="px-6 py-3 text-sm text-bw-400">{detail.page}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
