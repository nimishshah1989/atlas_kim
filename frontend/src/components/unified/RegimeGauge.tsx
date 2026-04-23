"use client";

interface RegimeGaugeProps {
  healthScore: number;
  healthZone: string;
  regime: string;
}

export default function RegimeGauge({ healthScore, healthZone, regime }: RegimeGaugeProps) {
  const radius = 52;
  const stroke = 8;
  const normalized = Math.min(100, Math.max(0, healthScore));
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;

  const zoneColor =
    healthZone === "HEALTHY"
      ? "var(--rag-green-500)"
      : healthZone === "CAUTION"
      ? "var(--rag-amber-500)"
      : "var(--rag-red-500)";

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
      <svg width={radius * 2 + stroke} height={radius * 2 + stroke} viewBox={`0 0 ${radius * 2 + stroke} ${radius * 2 + stroke}`}>
        <circle
          cx={radius + stroke / 2}
          cy={radius + stroke / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-inset)"
          strokeWidth={stroke}
        />
        <circle
          cx={radius + stroke / 2}
          cy={radius + stroke / 2}
          r={radius}
          fill="none"
          stroke={zoneColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${radius + stroke / 2} ${radius + stroke / 2})`}
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
        <text
          x={radius + stroke / 2}
          y={radius + stroke / 2 - 4}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: "22px", fontWeight: 700, fill: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(normalized)}
        </text>
        <text
          x={radius + stroke / 2}
          y={radius + stroke / 2 + 16}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: "10px", fontWeight: 600, fill: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          Health
        </text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: zoneColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {healthZone}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>{regime}</div>
      </div>
    </div>
  );
}
