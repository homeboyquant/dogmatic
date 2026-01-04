import { useEffect, useState } from 'react';
import styles from './PnLChart.module.css';
// pnl
interface PnLDataPoint {
  timestamp: number;
  pnl: number;
}

interface PnLChartProps {
  data: PnLDataPoint[];
  width?: number;
  height?: number;
}

export default function PnLChart({ data, width = 800, height = 180 }: PnLChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className={styles.emptyChart}>
        <p>No P&L data available yet. Start trading to see your performance!</p>
      </div>
    );
  }

  // Calculate bounds - reduced padding for ultra-compact view
  const padding = 20;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const minPnL = Math.min(...data.map(d => d.pnl), 0);
  const maxPnL = Math.max(...data.map(d => d.pnl), 0);
  const minTime = Math.min(...data.map(d => d.timestamp));
  const maxTime = Math.max(...data.map(d => d.timestamp));

  const pnlRange = maxPnL - minPnL || 1;
  const timeRange = maxTime - minTime || 1;

  // Scale functions
  const scaleX = (timestamp: number) => {
    return padding + ((timestamp - minTime) / timeRange) * chartWidth;
  };

  const scaleY = (pnl: number) => {
    return padding + chartHeight - ((pnl - minPnL) / pnlRange) * chartHeight;
  };

  // Generate path
  const pathData = data.map((point, i) => {
    const x = scaleX(point.timestamp);
    const y = scaleY(point.pnl);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  // Zero line
  const zeroY = scaleY(0);

  // Create gradient for area fill
  const areaPath = `${pathData} L ${scaleX(data[data.length - 1].timestamp)} ${zeroY} L ${scaleX(data[0].timestamp)} ${zeroY} Z`;

  const currentPnL = data[data.length - 1]?.pnl || 0;
  const isPositive = currentPnL >= 0;

  // Y-axis labels
  const yAxisValues = [maxPnL, (maxPnL + minPnL) / 2, minPnL].filter((v, i, arr) =>
    i === 0 || Math.abs(v - arr[i - 1]) > pnlRange * 0.1
  );

  // X-axis labels (show 5 time points)
  const xAxisCount = Math.min(5, data.length);
  const xAxisIndices = data.length > 0
    ? Array.from({ length: xAxisCount }, (_, i) =>
      Math.floor((i / Math.max(1, xAxisCount - 1)) * (data.length - 1))
    )
    : [];

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>P&L Performance</h3>
        <div className={`${styles.currentPnL} ${isPositive ? styles.positive : styles.negative}`}>
          {isPositive ? '+' : ''}${currentPnL.toFixed(2)}
        </div>
      </div>

      <svg width={width} height={height} className={styles.chart}>
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="pnlGradientPositive" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="pnlGradientNegative" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yAxisValues.map((value, i) => {
          const y = scaleY(value);
          return (
            <g key={i}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="var(--border-color)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.3"
              />
              <text
                x={padding - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-tertiary)"
              >
                ${value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Zero line */}
        {minPnL < 0 && maxPnL > 0 && (
          <line
            x1={padding}
            y1={zeroY}
            x2={width - padding}
            y2={zeroY}
            stroke="var(--text-tertiary)"
            strokeWidth="2"
            strokeDasharray="6 3"
            opacity="0.5"
          />
        )}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={isPositive ? 'url(#pnlGradientPositive)' : 'url(#pnlGradientNegative)'}
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={isPositive ? '#10b981' : '#ef4444'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((point, i) => {
          const x = scaleX(point.timestamp);
          const y = scaleY(point.pnl);
          const isHovered = hoveredPoint === i;

          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 6 : 4}
                fill={point.pnl >= 0 ? '#10b981' : '#ef4444'}
                stroke="white"
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {isHovered && (
                <g>
                  <rect
                    x={x - 60}
                    y={y - 40}
                    width="120"
                    height="32"
                    rx="6"
                    fill="var(--bg-secondary)"
                    stroke="var(--border-color)"
                    strokeWidth="1"
                    filter="drop-shadow(0 2px 8px rgba(0,0,0,0.1))"
                  />
                  <text
                    x={x}
                    y={y - 26}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--text-secondary)"
                  >
                    {new Date(point.timestamp).toLocaleDateString()}
                  </text>
                  <text
                    x={x}
                    y={y - 14}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="600"
                    fill={point.pnl >= 0 ? '#10b981' : '#ef4444'}
                  >
                    {point.pnl >= 0 ? '+' : ''}${point.pnl.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* X-axis labels */}
        {xAxisIndices.map((idx) => {
          const point = data[idx];
          const x = scaleX(point.timestamp);
          return (
            <text
              key={idx}
              x={x}
              y={height - padding + 20}
              textAnchor="middle"
              fontSize="11"
              fill="var(--text-tertiary)"
            >
              {new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
