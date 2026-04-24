"use client";

interface ActionBadgeProps {
  action: string;
  confidence?: number | null;
  size?: "sm" | "md" | "lg";
}

const ACTION_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  STRONG_ACCUMULATE: { bg: "var(--rag-green-100)", color: "var(--rag-green-900)", label: "Strong Accumulate" },
  ACCUMULATE: { bg: "var(--rag-green-100)", color: "var(--rag-green-500)", label: "Accumulate" },
  HOLD: { bg: "var(--rag-amber-100)", color: "var(--rag-amber-700)", label: "Hold" },
  REDUCE: { bg: "var(--rag-amber-100)", color: "var(--rag-amber-500)", label: "Reduce" },
  EXIT: { bg: "var(--rag-red-100)", color: "var(--rag-red-500)", label: "Exit" },
};

export default function ActionBadge({ action, confidence, size = "md" }: ActionBadgeProps) {
  const style = ACTION_STYLES[action] ?? { bg: "var(--bg-inset)", color: "var(--text-secondary)", label: action };
  const padding = size === "sm" ? "2px 8px" : size === "lg" ? "6px 14px" : "4px 10px";
  const fontSize = size === "sm" ? "10px" : size === "lg" ? "13px" : "11px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: style.bg,
        color: style.color,
        fontSize,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding,
        borderRadius: "999px",
        lineHeight: 1.2,
      }}
    >
      <span>{style.label}</span>
      {typeof confidence === "number" && (
        <span style={{ opacity: 0.75, fontWeight: 500, fontSize: `calc(${fontSize} - 1px)` }}>
          · {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}
