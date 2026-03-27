interface ExtractionProgressProps {
  stageLabel: string;
  progressPercent: number;
  currentMarkdown: string;
}

export function ExtractionProgress({ stageLabel, progressPercent, currentMarkdown }: ExtractionProgressProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-bw-100 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-bw-700">{stageLabel}</span>
        <span className="text-sm text-bw-500">{progressPercent}%</span>
      </div>

      <div className="w-full bg-bw-100 rounded-full h-2 mb-4">
        <div
          className="bg-black h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {currentMarkdown && (
        <div className="mt-4">
          <p className="text-xs text-bw-500 uppercase tracking-wider mb-2">Extracted Text Preview</p>
          <pre className="text-xs text-bw-600 bg-bw-50 p-4 rounded-lg border border-bw-100 overflow-auto max-h-40 font-mono">
            {currentMarkdown.slice(-500)}
          </pre>
        </div>
      )}
    </div>
  );
}
