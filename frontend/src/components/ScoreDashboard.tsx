import { ScoreCard } from './ScoreCard';
import type { Recommendation } from '../types/extraction';

interface ScoreDashboardProps {
  scores: {
    completeness: number;
    quality: number;
    pii_detection: number;
    overall: number;
  };
  pii_breakdown?: {
    ssn: { found: boolean; label: string };
    email: { found: boolean; label: string };
    phone: { found: boolean; label: string };
  };
  recommendations: Recommendation[];
}

export function ScoreDashboard({ scores, pii_breakdown, recommendations }: ScoreDashboardProps) {
  const overallPercentage = Math.round(scores.overall * 100);
  const isAcceptable = scores.overall >= 0.8;
  const isReviewSuggested = scores.overall >= 0.6 && scores.overall < 0.8;

  const getOverallStatus = () => {
    if (isAcceptable) return { text: 'Acceptable', class: 'text-green-600 bg-green-50 border-green-200' };
    if (isReviewSuggested) return { text: 'Review Suggested', class: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    return { text: 'Needs Review', class: 'text-red-600 bg-red-50 border-red-200' };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-bw-100">
        <h3 className="text-sm font-semibold text-bw-700">Extraction Quality Score</h3>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl font-light text-bw-900">{overallPercentage}%</div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${overallStatus.class}`}>
            {overallStatus.text}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <ScoreCard label="Completeness" score={scores.completeness} threshold={0.8} weight={0.4} />
          <ScoreCard label="Quality" score={scores.quality} threshold={0.75} weight={0.35} />
          <ScoreCard label="PII Detection" score={scores.pii_detection} threshold={0.85} weight={0.25} />
        </div>

        {pii_breakdown && (
          <div className="border-t border-bw-100 pt-4 mb-4">
            <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">PII Patterns Detected</h4>
            <div className="flex flex-wrap gap-3">
              {pii_breakdown.ssn && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  pii_breakdown.ssn.found
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${pii_breakdown.ssn.found ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span>{pii_breakdown.ssn.label}</span>
                  <span className="text-xs opacity-75">{pii_breakdown.ssn.found ? '✓ Found' : 'Not found'}</span>
                </div>
              )}
              {pii_breakdown.email && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  pii_breakdown.email.found
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${pii_breakdown.email.found ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span>{pii_breakdown.email.label}</span>
                  <span className="text-xs opacity-75">{pii_breakdown.email.found ? '✓ Found' : 'Not found'}</span>
                </div>
              )}
              {pii_breakdown.phone && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  pii_breakdown.phone.found
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${pii_breakdown.phone.found ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span>{pii_breakdown.phone.label}</span>
                  <span className="text-xs opacity-75">{pii_breakdown.phone.found ? '✓ Found' : 'Not found'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="border-t border-bw-100 pt-4">
            <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">Recommendations</h4>
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                    rec.type === 'quality' ? 'bg-orange-100 text-orange-600' :
                    rec.type === 'completeness' ? 'bg-blue-100 text-blue-600' :
                    rec.type === 'pii' ? 'bg-purple-100 text-purple-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {rec.type === 'quality' ? 'Q' : rec.type === 'completeness' ? 'C' : rec.type === 'pii' ? 'P' : 'S'}
                  </span>
                  <span className="text-bw-600">{rec.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
