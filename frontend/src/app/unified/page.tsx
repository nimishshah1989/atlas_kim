"use client";

import { useUnifiedData } from "@/hooks/useUnifiedData";
import RegimeGauge from "@/components/unified/RegimeGauge";
import NarrativePanel from "@/components/unified/NarrativePanel";
import BubbleChart from "@/components/unified/BubbleChart";
import BreadthBar from "@/components/unified/BreadthBar";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type { RegimeResponse, AggregateResponse, ScreenerResponse, CohortPoint } from "@/lib/api-unified";

export default function UnifiedDashboard() {
  const { data: regime, state: regimeState, meta: regimeMeta } = useUnifiedData<RegimeResponse>("/api/unified/regime");
  const { data: aggregate, state: aggState } = useUnifiedData<AggregateResponse>("/api/unified/aggregate", { cohort_type: "sector", benchmark: "nifty", period: "3m" });
  // Screen endpoint is POST only; skip on dashboard for now
  const leaders: ScreenerResponse | null = null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0, color: "var(--text-primary)" }}>
          Unified Intelligence
        </h1>
        <DataFreshness dataAsOf={regimeMeta?.data_as_of ?? null} />
      </div>

      {regimeState === "ready" && regime && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <RegimeGauge healthScore={regime.metrics.health_score ?? 0} healthZone={regime.metrics.health_zone ?? "NEUTRAL"} regime={regime.regime ?? ""} />
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>
              Market Direction
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-serif)" }}>
              {regime.direction ?? ""}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Regime: <strong>{regime.regime ?? "—"}</strong>
            </div>
          </div>
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>
              Quick Links
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Link href="/unified/sectors" style={{ fontSize: "13px", color: "var(--accent-700)", textDecoration: "none", fontWeight: 500 }}>
                Sector Explorer →
              </Link>
              <Link href="/unified/leaders" style={{ fontSize: "13px", color: "var(--accent-700)", textDecoration: "none", fontWeight: 500 }}>
                Accumulate Leaders →
              </Link>
              <Link href="/unified/funds" style={{ fontSize: "13px", color: "var(--accent-700)", textDecoration: "none", fontWeight: 500 }}>
                Fund Rankings →
              </Link>
            </div>
          </div>
        </div>
      )}

      {regimeState === "loading" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>
          Loading regime data…
        </div>
      )}

      {regime?.narrative && <NarrativePanel narrative={regime.narrative} title="Regime Narrative" />}

      {(aggState === "ready" || aggState === "stale") && aggregate && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              Universe Bubble
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
              {aggregate.cohort_type} · {aggregate.benchmark} · {aggregate.period}
            </div>
          </div>
          <BubbleChart data={aggregate.points} height={420} />
        </div>
      )}

      {aggregate && aggregate.points.length > 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
            Sector Summary
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
            {aggregate.points.slice(0, 8).map((pt) => (
              <Link
                key={pt.cohort_key}
                href={`/unified/sectors/${encodeURIComponent(pt.cohort_key)}`}
                style={{
                  display: "block",
                  padding: "12px",
                  background: "var(--bg-surface-alt)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>{pt.cohort_key}</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{pt.member_count} stocks</div>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "11px", color: "var(--text-tertiary)" }}>
                  <span>RS: {pt.median_rs_rank?.toFixed(1) ?? "—"}</span>
                  <span>3M: {(pt.median_ret_3m && (pt.median_ret_3m * 100).toFixed(1) + "%") ?? "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
