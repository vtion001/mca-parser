import { useTheme } from '../hooks/useTheme';

interface ScoreCardProps {
  label: string;
  score: number;
  threshold: number;
  weight?: number;
}

export function ScoreCard({ label, score, threshold, weight }: ScoreCardProps) {
  const { colors } = useTheme();

  const percentage = Math.round(score * 100);
  const isGood = score >= threshold;
  const isWarning = score >= threshold * 0.8 && score < threshold;

  const getStatusColor = () => {
    if (isGood) return 'text-green-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (isGood) return '✓';
    if (isWarning) return '⚠';
    return '✗';
  };

  const getBarColor = () => {
    if (isGood) return 'bg-green-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-bw-100 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-bw-500 uppercase tracking-wider">{label}</span>
        <span className={`text-lg font-semibold ${getStatusColor()}`}>
          {getStatusIcon()}
        </span>
      </div>

      <div className="text-3xl font-light text-bw-900 mb-3">{percentage}%</div>

      <div className="w-full bg-bw-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {weight && (
        <p className="text-xs text-bw-400 mt-2">Weight: {Math.round(weight * 100)}%</p>
      )}
    </div>
  );
}
