"use client";

interface BreadthBarProps {
  label: string;
  value: number | null;
  suffix?: string;
}

function barColor(value: number): string {
  if (value >= 70) return "var(--rag-green-500)";
  if (value >= 50) return "var(--rag-green-300)";
  if (value >= 35) return "var(--text-tertiary)";
  if (value >= 20) return "var(--rag-amber-500)";
  return "var(--rag-red-500)";
}

export default function BreadthBar({ label, value, suffix = "%" }: BreadthBarProps) {
  const displayValue = value ?? 0;
  const pct = Math.min(100, Math.max(0, displayValue));
  const color = value == null ? "var(--text-tertiary)" : barColor(displayValue);

  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--text-primary)", fontSize: "12px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {value == null ? "—" : `${displayValue.toFixed(1)}${suffix}`}
        </span>
      </div>
      <div
        style={{
          height: "8px",
          background: "var(--bg-inset)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "4px",
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}
