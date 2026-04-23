"use client";

interface ActionBadgeProps {
  action: string;
  confidence?: number | null;
  size?: "sm" | "md" | "lg";
}

const ACTION_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  STRONG_ACCUMULATE: { bg: "var(--rag-green-100)", color: "var(--rag-green-700)", label: "Strong Accumulate" },
  ACCUMULATE: { bg: "var(--rag-green-100)", color: "var(--rag-green-700)", label: "Accumulate" },
  HOLD: { bg: "var(--rag-amber-100)", color: "var(--rag-amber-700)", label: "Hold" },
  REDUCE: { bg: "var(--rag-amber-100)", color: "var(--rag-amber-700)", label: "Reduce" },
  EXIT: { bg: "var(--rag-red-100)", color: "var(--rag-red-700)", label: "Exit" },
  STRONG_EXIT: { bg: "var(--rag-red-100)", color: "var(--rag-red-700)", label: "Strong Exit" },
};

export default function ActionBadge({ action, confidence, size = "md" }: ActionBadgeProps) {
  const style = ACTION_STYLES[action] ?? { bg: "var(--bg-inset)", color: "var(--text-secondary)", label: action };
  const padding = size === "sm" ? "2px 8px" : size === "lg" ? "6px 16px" : "4px 12px";
  const fontSize = size === "sm" ? "10px" : size === "lg" ? "14px" : "12px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: style.bg,
        color: style.color,
        fontSize,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding,
        borderRadius: "999px",
      }}
    >
      {style.label}
      {typeof confidence === "number" && (
        <span style={{ opacity: 0.7, fontWeight: 500 }}>{Math.round(confidence * 100)}%</span>
      )}
    </span>
  );
}
