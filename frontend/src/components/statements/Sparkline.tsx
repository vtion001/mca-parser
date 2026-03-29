import type { SparklineProps } from './types';

export function Sparkline({ credits, debits }: SparklineProps) {
  const maxVal = Math.max(credits ?? 1, debits ?? 1, 1);
  const creditH = credits !== null ? Math.max(6, Math.round((credits / maxVal) * 48)) : 6;
  const debitH = debits !== null ? Math.max(6, Math.round((debits / maxVal) * 48)) : 6;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end gap-[3px] h-12 w-24">
        <div
          className="flex-1 rounded-t-sm bg-gradient-to-t from-bw-800 to-bw-400 animate-[sv-draw_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]"
          style={{ height: creditH, animationDelay: '0ms' }}
        />
        <div
          className="flex-1 rounded-t-sm bg-gradient-to-t from-bw-500 to-bw-300 animate-[sv-draw_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]"
          style={{ height: debitH, animationDelay: '100ms' }}
        />
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-bw-800 to-bw-400" />
          <span className="text-bw-400">CR</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-bw-500 to-bw-300" />
          <span className="text-bw-400">DR</span>
        </span>
      </div>
    </div>
  );
}
