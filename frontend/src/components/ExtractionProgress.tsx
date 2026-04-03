import { useState, useRef, useEffect, useMemo, memo } from 'react';

const STAGES = [
  { key: 'uploading',    label: 'Uploading PDF',         description: 'Transferring file to server',       icon: '↑' },
  { key: 'extracting',   label: 'Extracting text',       description: 'Parsing PDF with Docling OCR',      icon: '◈' },
  { key: 'detecting_type',label: 'Detecting document',    description: 'Identifying statement type',        icon: '◉' },
  { key: 'mapping_fields',label: 'Mapping key details',   description: 'Extracting account & dates',        icon: '▣' },
  { key: 'analyzing_quality',label: 'Analyzing quality',  description: 'Scoring extraction confidence',    icon: '◐' },
  { key: 'extracting_balances',label: 'Extracting balances',description:'Pulling beginning & ending values', icon: '⊞' },
  { key: 'ai_analysis',   label: 'Running AI analysis',   description: 'Risk indicators via OpenRouter',     icon: '◬' },
  { key: 'complete',      label: 'Complete',              description: 'All done — ready to review',        icon: '✓' },
] as const;

function stageIndex(stage: string): number {
  return STAGES.findIndex(s => s.key === stage);
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

interface ExtractionProgressProps {
  stageLabel: string;
  progressPercent: number;
  currentMarkdown: string;
  stage?: string;
}

export const ExtractionProgress = memo(function ExtractionProgress({ stageLabel, progressPercent, currentMarkdown, stage }: ExtractionProgressProps) {
  const startMs = useRef(Date.now());
  const [elapsed, setElapsed] = useState('');

  // Tick elapsed timer every second
  useEffect(() => {
    if (progressPercent >= 100) return;
    const id = setInterval(() => {
      setElapsed(formatElapsed(Date.now() - startMs.current));
    }, 1000);
    setElapsed(formatElapsed(Date.now() - startMs.current));
    return () => clearInterval(id);
  }, [progressPercent]);

  const currentIdx = stageIndex(stage ?? '');
  const isComplete = progressPercent >= 100;

  // Memoize preview snippet to avoid recalculating on every render
  const previewSnippet = useMemo(
    () => (currentMarkdown && currentMarkdown.length > 300 ? currentMarkdown.slice(-300) : currentMarkdown || null),
    [currentMarkdown]
  );

  // Memoize char count display
  const charCount = useMemo(() => currentMarkdown?.length ?? 0, [currentMarkdown]);

  return (
    <div className="bg-white rounded-xl p-6 border border-bw-100 shadow-card">
      {/* ── Header row ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-bw-900 leading-tight">{stageLabel || 'Processing...'}</p>
          {elapsed && !isComplete && (
            <p className="text-xs text-bw-400 mt-0.5">Elapsed: {elapsed}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
              ✓ Done
            </span>
          )}
          <span className="text-sm font-mono font-semibold text-bw-700">{progressPercent}%</span>
        </div>
      </div>

      {/* ── Step track ── */}
      <div className="relative mb-6">
        {/* Track line */}
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-bw-100" />
        {/* Filled portion */}
        <div
          className="absolute top-3 left-0 h-0.5 bg-black transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Step dots */}
        <div className="relative flex justify-between">
          {STAGES.filter(s => s.key !== 'uploading').map((s, i) => {
            const idx = i + 1; // uploading is index 0, skip it visually
            const done = currentIdx >= idx;
            const active = currentIdx === idx;
            return (
              <div key={s.key} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                    done
                      ? 'bg-black border-black text-white'
                      : active
                      ? 'bg-white border-black text-black shadow-sm'
                      : 'bg-white border-bw-200 text-bw-300'
                  }`}
                >
                  {done ? '✓' : s.icon}
                </div>
                <span className={`text-[10px] font-medium text-center leading-tight ${
                  done ? 'text-bw-900' : active ? 'text-bw-600' : 'text-bw-300'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Current stage detail ── */}
      {stage && stage !== 'uploading' && (
        <div className="mb-4 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-bw-900 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[8px]">▶</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-bw-700">{stageLabel}</p>
            <p className="text-xs text-bw-400 mt-0.5">
              {STAGES.find(s => s.key === stage)?.description}
            </p>
          </div>
        </div>
      )}

      {/* ── Markdown preview ── */}
      {previewSnippet && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-bw-500 uppercase tracking-wider font-semibold">Extracted Text Preview</p>
            <span className="text-[10px] text-bw-400">{charCount.toLocaleString()} chars</span>
          </div>
          <pre className="text-xs text-bw-600 bg-bw-50 p-4 rounded-lg border border-bw-100 overflow-auto max-h-32 font-mono leading-relaxed">
            {previewSnippet}
          </pre>
        </div>
      )}
    </div>
  );
});
