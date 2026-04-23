"use client";

interface BreadthBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

export default function BreadthBar({ label, value, max = 100, color = "var(--accent-700)" }: BreadthBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px" }}>
        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {value.toFixed ? value.toFixed(1) : value}%
        </span>
      </div>
      <div
        style={{
          height: "6px",
          background: "var(--bg-inset)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "3px",
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}
