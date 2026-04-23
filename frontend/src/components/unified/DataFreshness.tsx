"use client";

interface DataFreshnessProps {
  dataAsOf: string | null;
}

export default function DataFreshness({ dataAsOf }: DataFreshnessProps) {
  if (!dataAsOf) return null;
  const date = new Date(dataAsOf);
  const formatted = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <span
      style={{
        fontSize: "11px",
        color: "var(--text-tertiary)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      Data as of {formatted}
    </span>
  );
}
