"use client";

import type { NarrativeBlock } from "@/lib/api-unified";

interface NarrativePanelProps {
  narrative: NarrativeBlock | string | null;
  title?: string;
}

export default function NarrativePanel({ narrative, title = "Narrative" }: NarrativePanelProps) {
  if (!narrative) return null;
  if (typeof narrative === "string") {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "16px",
        }}
      >
        <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: "8px" }}>
          {title}
        </div>
        <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-secondary)", margin: 0 }}>{narrative}</p>
      </div>
    );
  }
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
        <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "var(--text-primary)" }}>
          Verdict: {narrative.verdict} — {narrative.recommended_action}
        </p>
        {narrative.reasons.length > 0 && (
          <ul style={{ margin: "0 0 8px 16px", padding: 0 }}>
            {narrative.reasons.map((r, i) => (
              <li key={`r-${i}`} style={{ color: "var(--rag-green-700)", marginBottom: "2px" }}>{r}</li>
            ))}
          </ul>
        )}
        {narrative.risks.length > 0 && (
          <ul style={{ margin: "0 0 8px 16px", padding: 0 }}>
            {narrative.risks.map((r, i) => (
              <li key={`x-${i}`} style={{ color: "var(--rag-red-700)", marginBottom: "2px" }}>{r}</li>
            ))}
          </ul>
        )}
        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-tertiary)", fontStyle: "italic" }}>
          {narrative.technical_snapshot}
        </p>
      </div>
    </div>
  );
}
