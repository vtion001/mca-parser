import type { ExtractionResult } from '../types/extraction';
import { AnalysisOverview } from './analysis/AnalysisOverview';
import { AnalysisDetailed } from './analysis/AnalysisDetailed';
import { McaFindings } from './analysis/McaFindings';

interface AnalysisResultsProps {
  result: ExtractionResult;
}

/**
 * AnalysisResults - Combined view for balance summary, MCA detection, and AI document analysis.
 * Renders Overview (balance summary), MCA Findings, and Detailed (AI analysis) sections.
 */
export function AnalysisResults({ result }: AnalysisResultsProps) {
  return (
    <div className="space-y-6">
      {/* Balance Summary */}
      <AnalysisOverview result={result} />

      {/* MCA Transaction Detection */}
      <McaFindings result={result} />

      {/* AI Document Analysis */}
      <AnalysisDetailed result={result} />

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
