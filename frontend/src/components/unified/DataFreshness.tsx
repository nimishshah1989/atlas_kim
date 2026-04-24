"use client";

interface DataFreshnessProps {
  dataAsOf: string | null;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utcB - utcA) / msPerDay);
}

export default function DataFreshness({ dataAsOf }: DataFreshnessProps) {
  if (!dataAsOf) return null;

  const date = new Date(dataAsOf);
  const formatted = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const now = new Date();
  const days = daysBetween(date, now);

  let warning: React.ReactNode = null;

  if (days > 7) {
    warning = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--rag-red-500)", fontWeight: 600 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 4V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="6" cy="9" r="0.6" fill="currentColor" />
        </svg>
        Data outdated
      </span>
    );
  } else if (days > 2) {
    warning = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--rag-amber-500)", fontWeight: 600 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 4V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="6" cy="9" r="0.6" fill="currentColor" />
        </svg>
        Stale data
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "11px",
        color: "var(--text-tertiary)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      Data as of {formatted}
      {warning}
    </span>
  );
}
