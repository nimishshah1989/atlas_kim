"use client";

import { useState } from "react";
import Link from "next/link";
import type { MetricSnapshot, NarrativeBlock } from "@/lib/api-unified";
import ActionBadge from "./ActionBadge";

interface EvidenceCardProps {
  instrumentId: string;
  symbol: string;
  name: string;
  sector: string | null;
  metrics: MetricSnapshot;
  narrative: NarrativeBlock | null;
  dataAsOf: string | null;
  compact?: boolean;
}

function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(digits);
}

function boolBadge(val: boolean | null, label: string): React.ReactNode {
  if (val === null || val === undefined) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-disabled)" }}>
        {label} —
      </span>
    );
  }
  const color = val ? "var(--rag-green-600)" : "var(--rag-red-600)";
  const icon = val ? "✓" : "✕";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color, fontWeight: 600 }}>
      {label} {icon}
    </span>
  );
}

function fragColor(level: string | null): string {
  if (!level) return "var(--text-disabled)";
  const l = level.toUpperCase();
  if (l === "LOW") return "var(--rag-green-600)";
  if (l === "MEDIUM") return "var(--rag-amber-600)";
  if (l === "HIGH") return "var(--rag-red-600)";
  if (l === "CRITICAL") return "var(--rag-red-800)";
  return "var(--text-secondary)";
}

function rsiColor(rsi: number | null): string {
  if (rsi === null) return "var(--text-disabled)";
  if (rsi >= 60) return "var(--rag-green-600)";
  if (rsi <= 30) return "var(--rag-red-600)";
  return "var(--text-primary)";
}

export default function EvidenceCard({
  instrumentId,
  symbol,
  name,
  sector,
  metrics,
  narrative,
  dataAsOf,
  compact = false,
}: EvidenceCardProps) {
  const [showConfirming, setShowConfirming] = useState(false);
  const [showRisk, setShowRisk] = useState(false);
  const action = metrics.action ?? "HOLD";
  const confidence = metrics.action_confidence ?? 0;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        padding: compact ? "14px 16px" : "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: compact ? "10px" : "12px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: compact ? "18px" : "22px", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-serif)", letterSpacing: "-0.01em" }}>
              {symbol}
            </span>
            <span style={{ fontSize: compact ? "13px" : "14px", fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name}
            </span>
          </div>
          {sector && (
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Link href={`/unified/sectors/${encodeURIComponent(sector)}`} style={{ color: "var(--accent-700)", textDecoration: "none", fontWeight: 500 }}>
                {sector}
              </Link>
              <span>→</span>
            </div>
          )}
        </div>
        <ActionBadge action={action} confidence={confidence} size={compact ? "md" : "lg"} />
      </div>

      {/* Metrics */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: compact ? "8px 16px" : "10px 20px",
          alignItems: "center",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: compact ? "8px 0" : "10px 0",
        }}
      >
        <MetricPill label="Price" value="—" />
        <MetricPill label="3M" value={fmtPct(metrics.ret_3m)} color={metrics.ret_3m !== null && metrics.ret_3m >= 0 ? "var(--rag-green-600)" : metrics.ret_3m !== null && metrics.ret_3m < 0 ? "var(--rag-red-600)" : undefined} />
        <MetricPill label="12M" value={fmtPct(metrics.ret_12m)} color={metrics.ret_12m !== null && metrics.ret_12m >= 0 ? "var(--rag-green-600)" : metrics.ret_12m !== null && metrics.ret_12m < 0 ? "var(--rag-red-600)" : undefined} />
        <MetricPill label="RSI" value={fmtNum(metrics.rsi_14, 1)} color={rsiColor(metrics.rsi_14)} />

        {!compact && (
          <>
            <span style={{ width: "1px", height: "16px", background: "var(--border-subtle)", flexShrink: 0 }} />
            {boolBadge(metrics.above_ema_20, "EMA-20")}
            {boolBadge(metrics.above_ema_50, "EMA-50")}
            {boolBadge(metrics.above_ema_200, "EMA-200")}
            {boolBadge(metrics.golden_cross, "Golden Cross")}
            <span style={{ width: "1px", height: "16px", background: "var(--border-subtle)", flexShrink: 0 }} />
            <MetricPill label="% from 52W" value={(metrics as unknown as Record<string, number | null>).pct_from_52w_high !== undefined ? fmtNum((metrics as unknown as Record<string, number | null>).pct_from_52w_high, 1) + "%" : "—"} />
            <MetricPill label="Vol" value={metrics.vol_21d !== null ? `${(metrics.vol_21d * 100).toFixed(1)}%` : "—"} />
            <MetricPill label="Fragility" value={metrics.frag_level ?? "—"} color={fragColor(metrics.frag_level)} />
            <span style={{ width: "1px", height: "16px", background: "var(--border-subtle)", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>
              State: <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{metrics.state ?? "—"}</span>
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>
              Action: <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{action}</span>
            </span>
          </>
        )}
      </div>

      {/* Narrative summary */}
      {narrative && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              background: "var(--bg-inset)",
              padding: "8px 12px",
              borderRadius: "6px",
              borderLeft: "3px solid var(--accent-500)",
            }}
          >
            VERDICT: {narrative.verdict}
          </div>

          {!compact && (
            <>
              {narrative.reasons.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowConfirming((s) => !s)}
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--rag-green-700)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>✓</span>
                    <span>Confirming factors ({narrative.reasons.length}) {showConfirming ? "▲" : "▼"}</span>
                  </button>
                  {showConfirming && (
                    <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {narrative.reasons.map((r, i) => (
                        <li key={`c-${i}`} style={{ marginBottom: "2px" }}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {narrative.risks.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowRisk((s) => !s)}
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--rag-red-700)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>⚠</span>
                    <span>Risk factors ({narrative.risks.length}) {showRisk ? "▲" : "▼"}</span>
                  </button>
                  {showRisk && (
                    <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {narrative.risks.map((r, i) => (
                        <li key={`x-${i}`} style={{ marginBottom: "2px" }}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Data freshness */}
      {dataAsOf && (
        <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
          Data as of {new Date(dataAsOf).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}
    </div>
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px", fontSize: "12px", fontVariantNumeric: "tabular-nums" }}>
      <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>{label}</span>
      <span style={{ color: color ?? "var(--text-primary)", fontWeight: 700 }}>{value}</span>
    </span>
  );
}
