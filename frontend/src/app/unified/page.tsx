"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import { useUnifiedDataPost } from "@/hooks/useUnifiedData";
import RegimeGauge from "@/components/unified/RegimeGauge";
import NarrativePanel from "@/components/unified/NarrativePanel";
import BubbleChart from "@/components/unified/BubbleChart";
import DataFreshness from "@/components/unified/DataFreshness";
import EvidenceCard from "@/components/unified/EvidenceCard";
import ActionBadge from "@/components/unified/ActionBadge";
import Link from "next/link";
import type { RegimeResponse, AggregateResponse, ScreenerResponse, ScreenerRow, MetricSnapshot, FundRankingsResponse } from "@/lib/api-unified";

const BENCHMARK_OPTIONS = [
  { value: "nifty", label: "Nifty 50" },
  { value: "nifty500", label: "Nifty 500" },
  { value: "sp500", label: "S&P 500" },
  { value: "msci", label: "MSCI World" },
  { value: "gold", label: "Gold" },
];

const PERIOD_OPTIONS = ["1m", "3m", "6m", "12m"];

function rowToMetrics(stock: {
  instrument_id: string;
  symbol: string;
  name: string;
  sector: string | null;
  state: string | null;
  action: string | null;
  action_confidence: number | null;
  rs_nifty_3m_rank: number | null;
  rs_nifty_12m_rank: number | null;
  ret_3m: number | null;
  ret_12m: number | null;
  rsi_14: number | null;
  frag_score: number | null;
  above_ema_50: boolean | null;
}, dataAsOf: string | null): MetricSnapshot {
  return {
    date: dataAsOf ?? "",
    ret_1d: null, ret_1w: null, ret_1m: null, ret_3m: stock.ret_3m, ret_6m: null, ret_12m: stock.ret_12m,
    ema_20: null, ema_50: null, ema_200: null,
    above_ema_20: null, above_ema_50: stock.above_ema_50, golden_cross: null,
    rsi_14: stock.rsi_14, macd: null, macd_signal: null,
    vol_21d: null, max_dd_252d: null,
    rs_nifty_1d_rank: null, rs_nifty_1w_rank: null, rs_nifty_1m_rank: null,
    rs_nifty_3m_rank: stock.rs_nifty_3m_rank, rs_nifty_6m_rank: null, rs_nifty_12m_rank: stock.rs_nifty_12m_rank,
    rs_nifty_24m_rank: null, rs_nifty_36m_rank: null,
    rs_nifty500_3m_rank: null, rs_nifty500_12m_rank: null,
    rs_sp500_3m_rank: null, rs_sp500_12m_rank: null,
    rs_msci_3m_rank: null, rs_msci_12m_rank: null,
    rs_gold_3m_rank: null, rs_gold_12m_rank: null,
    state: stock.state, action: stock.action, action_confidence: stock.action_confidence,
    frag_score: stock.frag_score, frag_level: null,
  };
}

export default function UnifiedDashboard() {
  const router = useRouter();
  const [benchmark, setBenchmark] = useState("nifty");
  const [period, setPeriod] = useState("3m");

  const { data: regime, state: regimeState, meta: regimeMeta } = useUnifiedData<RegimeResponse>("/api/unified/regime");
  const { data: aggregate, state: aggState } = useUnifiedData<AggregateResponse>("/api/unified/aggregate", {
    cohort_type: "sector",
    benchmark,
    period,
  });

  const { data: leaders, state: leadersState } = useUnifiedDataPost<ScreenerResponse>("/api/unified/screen", {
    filters: [{ field: "action", op: "in", value: ["STRONG_ACCUMULATE", "ACCUMULATE"] }],
    sort_field: "rs_nifty_3m_rank",
    sort_direction: "desc",
    limit: 8,
    offset: 0,
  });

  const { data: fundRankings, state: fundRankingsState } = useUnifiedData<FundRankingsResponse>("/api/unified/funds/rankings");

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              Universe Bubble
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <select
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                }}
              >
                {BENCHMARK_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                }}
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <BubbleChart
            data={aggregate.points}
            height={420}
            onBubbleClick={(key) => router.push(`/unified/sectors/${encodeURIComponent(key)}`)}
          />
        </div>
      )}

      {(aggState === "ready" || aggState === "stale") && aggregate && aggregate.points.length > 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
            Sector Health
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {aggregate.points
              .slice()
              .sort((a, b) => (b.pct_above_ema_50 ?? 0) - (a.pct_above_ema_50 ?? 0))
              .map((pt) => {
                const pct = Math.min(100, Math.max(0, pt.pct_above_ema_50 ?? 0));
                let color = "var(--rag-red-500)";
                let zone = "WEAK";
                if (pct >= 70) { color = "var(--rag-green-500)"; zone = "BULLISH"; }
                else if (pct >= 50) { color = "var(--rag-green-400)"; zone = "HEALTHY"; }
                else if (pct >= 35) { color = "var(--text-tertiary)"; zone = "NEUTRAL"; }
                else if (pct >= 20) { color = "var(--rag-amber-500)"; zone = "CAUTION"; }
                return (
                  <div key={pt.cohort_key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "100px", fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", flexShrink: 0 }}>
                      {pt.cohort_key}
                    </div>
                    <div style={{ flex: 1, height: "8px", background: "var(--bg-inset)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "4px", transition: "width 500ms ease" }} />
                    </div>
                    <div style={{ width: "40px", fontSize: "12px", fontVariantNumeric: "tabular-nums", textAlign: "right", color: "var(--text-secondary)" }}>
                      {pct.toFixed(0)}%
                    </div>
                    <div style={{ width: "70px", fontSize: "10px", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>
                      {zone}
                    </div>
                  </div>
                );
              })}
          </div>
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

      {(leadersState === "ready" || leadersState === "stale") && leaders && leaders.rows.length > 0 && (
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
              Leaders
            </div>
            <Link href="/unified/leaders" style={{ fontSize: "12px", color: "var(--accent-700)", textDecoration: "none", fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {leaders.rows.map((stock) => (
              <EvidenceCard
                key={stock.instrument_id}
                instrumentId={stock.instrument_id}
                symbol={stock.symbol}
                name={stock.name}
                sector={stock.sector}
                metrics={rowToMetrics(stock, leaders.meta?.data_as_of ?? null)}
                narrative={null}
                dataAsOf={leaders.meta?.data_as_of ?? null}
              />
            ))}
          </div>
        </div>
      )}

      {(fundRankingsState === "ready" || fundRankingsState === "stale") && fundRankings && fundRankings.rows.length > 0 && (
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
              Top Funds (by Look-through RS)
            </div>
            <Link href="/unified/funds" style={{ fontSize: "12px", color: "var(--accent-700)", textDecoration: "none", fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600 }}>Fund</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600 }}>LT</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {fundRankings.rows
                  .slice()
                  .sort((a, b) => (b.lookthrough_rs_3m ?? 0) - (a.lookthrough_rs_3m ?? 0))
                  .slice(0, 5)
                  .map((f, i) => (
                    <tr key={f.instrument_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "8px 10px", fontVariantNumeric: "tabular-nums" }}>{i + 1}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 500 }}>{f.name}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        {f.lookthrough_rs_3m?.toFixed(0) ?? "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <ActionBadge action={f.action ?? "HOLD"} size="sm" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fundRankingsState === "loading" && (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>
          Loading fund rankings…
        </div>
      )}

    </div>
  );
}
