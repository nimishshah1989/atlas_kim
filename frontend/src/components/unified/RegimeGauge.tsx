"use client";

interface RegimeGaugeProps {
  healthScore: number;
  healthZone: string;
  regime: string;
}

function scoreColor(score: number): string {
  if (score < 30) return "var(--rag-red-500)";
  if (score < 50) return "var(--rag-amber-500)";
  if (score < 70) return "var(--rag-amber-300)";
  return "var(--rag-green-500)";
}

export default function RegimeGauge({ healthScore, healthZone, regime }: RegimeGaugeProps) {
  const radius = 56;
  const stroke = 8;
  const normalized = Math.min(100, Math.max(0, healthScore));
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;
  const color = scoreColor(normalized);
  const size = radius * 2 + stroke;
  const cx = radius + stroke / 2;
  const cy = radius + stroke / 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        padding: "16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--bg-inset)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: "24px", fontWeight: 700, fill: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(normalized)}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: "10px", fontWeight: 600, fill: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          {healthZone}
        </text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>{regime}</div>
      </div>
    </div>
  );
}
