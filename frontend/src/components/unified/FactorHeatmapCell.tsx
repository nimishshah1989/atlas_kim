"use client";

interface Props {
  value: number | null;
}

export default function FactorHeatmapCell({ value }: Props) {
  if (value === null || value === undefined) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "22px",
          borderRadius: "4px",
          background: "var(--bg-inset)",
          color: "var(--text-disabled)",
          fontSize: "11px",
          fontWeight: 600,
        }}
      >
        N/A
      </span>
    );
  }

  let bg: string;
  let color: string;
  if (value < 25) {
    bg = "var(--rag-red-100)";
    color = "var(--rag-red-700)";
  } else if (value < 50) {
    bg = "var(--rag-amber-100)";
    color = "var(--rag-amber-700)";
  } else if (value < 75) {
    bg = "#FEF9C3"; // yellow-100 approximation
    color = "#A16207"; // yellow-700 approximation
  } else {
    bg = "var(--rag-green-100)";
    color = "var(--rag-green-700)";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "22px",
        borderRadius: "4px",
        background: bg,
        color: color,
        fontSize: "11px",
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {Math.round(value)}
    </span>
  );
}
