"use client";

import Link from "next/link";
import type { MetricSnapshot, NarrativeBlock } from "@/lib/api-unified";
import ActionBadge from "./ActionBadge";
import DataFreshness from "./DataFreshness";

interface EvidenceCardProps {
  instrumentId: string;
  symbol: string;
  name: string;
  sector: string | null;
  metrics: MetricSnapshot;
  narrative: NarrativeBlock | null;
  dataAsOf: string | null;
}

export default function EvidenceCard({
  instrumentId,
  symbol,
  name,
  sector,
  metrics,
  narrative,
  dataAsOf,
}: EvidenceCardProps) {
  const action = metrics.action ?? "HOLD";
  const confidence = metrics.action_confidence ?? 0;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-serif)" }}>
            {name}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            <Link href={`/unified/instrument/${instrumentId}`} style={{ color: "var(--accent-700)", fontWeight: 600, textDecoration: "none" }}>
              {symbol}
            </Link>
            {sector && <span style={{ marginLeft: "8px" }}>· {sector}</span>}
          </div>
        </div>
        <ActionBadge action={action} confidence={confidence} size="lg" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "1px",
          background: "var(--border-subtle)",
          border: "1px solid var(--border-default)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <MetricBox label="RS 3M Rank" value={metrics.rs_nifty_3m_rank} suffix="" />
        <MetricBox label="RS 12M Rank" value={metrics.rs_nifty_12m_rank} suffix="" />
        <MetricBox label="Ret 1M" value={metrics.ret_1m} pct />
        <MetricBox label="Ret 3M" value={metrics.ret_3m} pct />
        <MetricBox label="Ret 12M" value={metrics.ret_12m} pct />
        <MetricBox label="RSI-14" value={metrics.rsi_14} />
        <MetricBox label="50 EMA" value={metrics.above_ema_50 === null ? null : metrics.above_ema_50 ? "Above" : "Below"} />
        <MetricBox label="Golden Cross" value={metrics.golden_cross === null ? null : metrics.golden_cross ? "Yes" : "No"} />
        <MetricBox label="State" value={metrics.state} />
        <MetricBox label="Fragility" value={metrics.frag_level} />
      </div>

      {narrative && (
        <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
          <strong>{narrative.verdict}</strong> — {narrative.recommended_action}
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-tertiary)" }}>{narrative.technical_snapshot}</p>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: "8px", borderTop: "1px solid var(--border-subtle)" }}>
        <DataFreshness dataAsOf={dataAsOf} />
      </div>
    </div>
  );
}

function MetricBox({ label, value, prefix, suffix, pct }: { label: string; value: string | number | boolean | null; prefix?: string; suffix?: string; pct?: boolean }) {
  let display: string;
  if (value === null || value === undefined) display = "—";
  else if (typeof value === "number") {
    if (pct) display = `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
    else display = `${prefix ?? ""}${value.toFixed(2)}${suffix ?? ""}`;
  } else {
    display = String(value);
  }
  return (
    <div style={{ background: "var(--bg-surface)", padding: "10px 12px" }}>
      <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 500, marginBottom: "3px" }}>{label}</div>
      <div style={{ fontSize: "15px", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)", lineHeight: 1.2 }}>
        {display}
      </div>
    </div>
  );
}
