import { useState, useCallback } from 'react';

interface MiniLineChartProps {
  dailyBalances: { date: string; balance: number }[];
  height?: number;
}

export function MiniLineChart({ dailyBalances, height = 160 }: MiniLineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const idx = Math.round((x / width) * (dailyBalances.length - 1));
    setHoveredIndex(Math.max(0, Math.min(idx, dailyBalances.length - 1)));
  }, [dailyBalances.length]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  if (dailyBalances.length === 0) {
    return <div className="py-8 text-center text-bw-400 text-xs">No balance data available</div>;
  }

  const values = dailyBalances.map(d => d.balance);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const padding = { top: 24, right: 16, bottom: 32, left: 16 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = 100;

  const scaleY = (val: number) => chartHeight - ((val - minVal) / range) * chartHeight;
  const scaleX = (i: number) => (i / (dailyBalances.length - 1 || 1)) * chartWidth;

  const linePoints = dailyBalances.map((d, i) => `${scaleX(i)},${scaleY(d.balance)}`).join(' ');
  const areaPoints = `${scaleX(0)},${chartHeight} ${linePoints} ${scaleX(dailyBalances.length - 1)},${chartHeight}`;

  const yLabels = [minVal, minVal + range * 0.33, minVal + range * 0.66, maxVal];

  const xStep = Math.max(1, Math.floor(dailyBalances.length / 4));
  const xLabels: { index: number; label: string }[] = [];
  for (let i = 0; i < dailyBalances.length; i += xStep) {
    xLabels.push({ index: i, label: dailyBalances[i].date.slice(5) });
  }
  if (xLabels[xLabels.length - 1]?.index !== dailyBalances.length - 1) {
    xLabels.push({ index: dailyBalances.length - 1, label: dailyBalances[dailyBalances.length - 1].date.slice(5) });
  }

  const hovered = hoveredIndex !== null ? dailyBalances[hoveredIndex] : null;
  const hoveredX = hoveredIndex !== null ? scaleX(hoveredIndex) : 0;
  const hoveredY = hoveredIndex !== null ? scaleY(hoveredIndex) : 0;

  return (
    <div className="relative">
      <svg
        width="100%"
        height={height}
        className="overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111111" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#111111" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#555555" />
            <stop offset="100%" stopColor="#111111" />
          </linearGradient>
        </defs>

        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {[0, 0.33, 0.66, 1].map((frac, i) => (
            <line
              key={i}
              x1={0} y1={chartHeight * frac}
              x2={chartWidth} y2={chartHeight * frac}
              stroke="#e5e5e5"
              strokeWidth="1"
              strokeDasharray={i === 0 || i === 3 ? 'none' : '2,2'}
            />
          ))}

          {yLabels.map((val, i) => (
            <text
              key={i}
              x={-6}
              y={chartHeight * (1 - i / 3) + 4}
              textAnchor="end"
              className="text-[9px] fill-bw-400"
            >
              {val < 1000 ? `$${val.toFixed(0)}` : `$${(val / 1000).toFixed(0)}k`}
            </text>
          ))}

          <polygon points={areaPoints} fill="url(#balanceGradient)" />

          <polyline
            points={linePoints}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {(() => {
            const minIdx = values.indexOf(minVal);
            const maxIdx = values.indexOf(maxVal);
            return (
              <>
                <circle cx={scaleX(minIdx)} cy={scaleY(minVal)} r="3" fill="#666" />
                <circle cx={scaleX(maxIdx)} cy={scaleY(maxVal)} r="3" fill="#000" />
              </>
            );
          })()}

          {hoveredIndex !== null && (
            <>
              <line
                x1={hoveredX} y1={0}
                x2={hoveredX} y2={chartHeight}
                stroke="#111"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.4"
              />
              <circle
                cx={hoveredX}
                cy={hoveredY}
                r="4"
                fill="#fff"
                stroke="#111"
                strokeWidth="2"
              />
            </>
          )}
        </g>

        {xLabels.map(({ index, label }, i) => (
          <text
            key={i}
            x={`${(index / (dailyBalances.length - 1 || 1)) * 100}%`}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            className="text-[9px] fill-bw-400"
            dx={i === 0 ? '4' : i === xLabels.length - 1 ? '-4' : '0'}
          >
            {label}
          </text>
        ))}
      </svg>

      {hovered && (
        <div
          className="absolute top-2 pointer-events-none bg-bw-900 text-white px-2.5 py-1.5 rounded text-[10px] font-medium shadow-lg z-10"
          style={{
            left: `${(parseFloat(((hoveredIndex ?? 0) / (dailyBalances.length - 1 || 1)).toFixed(4)) * 100)}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-[9px] text-bw-400">{hovered.date}</div>
          <div>${hovered.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      )}
    </div>
  );
}

export default MiniLineChart;
