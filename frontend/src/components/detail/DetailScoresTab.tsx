import { ScoreDashboard } from '../ScoreDashboard';
import type { Recommendation } from '../../types/extraction';

interface DetailScoresTabProps {
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

export function DetailScoresTab({ scores, pii_breakdown, recommendations }: DetailScoresTabProps) {
  return (
    <div className="px-6 py-5">
      <ScoreDashboard
        scores={scores}
        pii_breakdown={pii_breakdown}
        recommendations={recommendations}
      />
    </div>
  );
}
