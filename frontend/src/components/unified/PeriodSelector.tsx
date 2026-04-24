"use client";

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const OPTIONS = [
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
];

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "4px 12px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              border: active ? "1px solid var(--accent-700)" : "1px solid var(--border-strong)",
              background: active ? "var(--accent-700)" : "transparent",
              color: active ? "var(--text-inverse)" : "var(--text-secondary)",
              transition: "all 150ms ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
