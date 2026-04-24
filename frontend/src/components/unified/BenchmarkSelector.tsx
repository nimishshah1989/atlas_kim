"use client";

interface BenchmarkSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const OPTIONS: { value: string; label: string }[] = [
  { value: "nifty", label: "Nifty 50" },
  { value: "nifty500", label: "Nifty 500" },
  { value: "sp500", label: "S&P 500" },
  { value: "msci", label: "MSCI" },
  { value: "gold", label: "Gold" },
];

export default function BenchmarkSelector({ value, onChange }: BenchmarkSelectorProps) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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
