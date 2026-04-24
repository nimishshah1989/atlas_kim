"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import BubbleChart from "@/components/unified/BubbleChart";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type { AggregateResponse, CohortPoint, RegimeResponse } from "@/lib/api-unified";

const BENCHMARK_OPTIONS = [
  { value: "nifty", label: "Nifty 50" },
  { value: "nifty500", label: "Nifty 500" },
  { value: "sp500", label: "S&P 500" },
  { value: "msci", label: "MSCI World" },
  { value: "gold", label: "Gold" },
];

const PERIOD_OPTIONS = ["1m", "3m", "6m", "12m"];

type SortField =
  | "cohort_key"
  | "member_count"
  | "median_rs_rank"
  | "median_ret_3m"
  | "median_ret_12m"
  | "pct_above_ema_50"
  | "pct_leader_state"
  | "avg_frag_score"
  | "action_confidence"
  | "consensus_action";

function rsColor(rs: number | null) {
  if (rs === null) return "var(--text-secondary)";
  if (rs >= 70) return "var(--rag-green-700)";
  if (rs < 30) return "var(--rag-red-700)";
  return "var(--text-primary)";
}

function retColor(ret: number | null) {
  if (ret === null) return "var(--text-secondary)";
  if (ret >= 0) return "var(--rag-green-700)";
  return "var(--rag-red-700)";
}

function pctAboveEmaColor(pct: number | null) {
  if (pct === null) return "var(--text-secondary)";
  if (pct >= 70) return "var(--rag-green-900)";
  if (pct >= 50) return "var(--rag-green-700)";
  if (pct >= 35) return "var(--text-primary)";
  if (pct >= 20) return "var(--rag-amber-700)";
  return "var(--rag-red-700)";
}

function leaderPctColor(pct: number | null) {
  if (pct === null) return "var(--text-secondary)";
  if (pct >= 20) return "var(--rag-green-700)";
  if (pct < 5) return "var(--rag-red-700)";
  return "var(--text-primary)";
}

function fragColor(frag: number | null) {
  if (frag === null) return "var(--text-secondary)";
  if (frag <= 0.2) return "var(--rag-green-700)";
  if (frag <= 0.3) return "var(--rag-amber-700)";
  return "var(--rag-red-700)";
}

function fragLevelText(frag: number | null) {
  if (frag === null) return "—";
  if (frag >= 0.6) return "CRITICAL";
  if (frag >= 0.4) return "HIGH";
  if (frag >= 0.3) return "MEDIUM";
  return "LOW";
}

function formatRet(val: number | null) {
  if (val === null || val === undefined) return "—";
  const pct = val * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatPct(val: number | null) {
  if (val === null || val === undefined) return "—";
  return `${val.toFixed(1)}%`;
}

function regimeSummary(regime: RegimeResponse | null) {
  if (!regime) return null;
  const r = regime.regime ?? "UNKNOWN";
  const pct = regime.metrics.pct_above_ema_50 ?? 0;
  const pctFmt = (pct * 100).toFixed(0);
  let sentence = "";
  if (r.includes("CAUTION") || r.includes("DEFENSIVE")) {
    sentence = `Market is ${r}. ${pctFmt}% of stocks above EMA-50. Selective accumulation in leaders.`;
  } else if (r.includes("RISK_ON") || r.includes("BULLISH")) {
    sentence = `Market is ${r}. ${pctFmt}% of stocks above EMA-50. Broad participation supports accumulation.`;
  } else if (r.includes("BEARISH") || r.includes("DISTRIBUTION")) {
    sentence = `Market is ${r}. ${pctFmt}% of stocks above EMA-50. Defensive posture warranted.`;
  } else {
    sentence = `Market is ${r}. ${pctFmt}% of stocks above EMA-50.`;
  }
  return sentence;
}

export default function SectorsPage() {
  const router = useRouter();
  const [benchmark, setBenchmark] = useState("nifty");
  const [period, setPeriod] = useState("3m");
  const [sortField, setSortField] = useState<SortField>("pct_above_ema_50");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);

  const { data: bubble, state, meta } = useUnifiedData<AggregateResponse>("/api/unified/aggregate", {
    cohort_type: "sector",
    benchmark,
    period,
  });

  const { data: regimeData } = useUnifiedData<RegimeResponse>("/api/unified/regime");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedPoints = useMemo(() => {
    if (!bubble) return [];
    const pts = [...bubble.points];
    pts.sort((a: CohortPoint, b: CohortPoint) => {
      let av: number | string | null = a[sortField];
      let bv: number | string | null = b[sortField];
      if (av === null || av === undefined) av = sortDirection === "asc" ? Infinity : -Infinity;
      if (bv === null || bv === undefined) bv = sortDirection === "asc" ? Infinity : -Infinity;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortDirection === "asc" ? av - bv : bv - av;
      }
      return 0;
    });
    return pts;
  }, [bubble, sortField, sortDirection]);

  const visiblePoints = useMemo(() => {
    if (showAll) return sortedPoints;
    return sortedPoints.slice(0, 15);
  }, [sortedPoints, showAll]);

  const recommendations = useMemo(() => {
    if (!bubble) return { accumulate: [], avoid: [] };
    const eligible = bubble.points.filter(
      (p) => p.pct_above_ema_50 !== null && p.median_ret_3m !== null
    );
    const accumulate = [...eligible]
      .filter((p) => (p.median_ret_3m ?? 0) >= 0)
      .sort((a, b) => (b.pct_above_ema_50 ?? 0) - (a.pct_above_ema_50 ?? 0))
      .slice(0, 3);
    const avoid = [...eligible]
      .filter((p) => (p.median_ret_3m ?? 0) < 0)
      .sort((a, b) => (a.pct_above_ema_50 ?? 0) - (b.pct_above_ema_50 ?? 0))
      .slice(0, 3);
    return { accumulate, avoid };
  }, [bubble]);

  const summaryCards = useMemo(() => {
    if (!bubble) return null;
    const points = bubble.points;
    const leading = points.filter(
      (p) => p.consensus_action === "STRONG_ACCUMULATE" || p.consensus_action === "ACCUMULATE"
    ).length;
    const weakening = points.filter(
      (p) => p.consensus_action === "REDUCE" || p.consensus_action === "EXIT"
    ).length;
    const sortedByHealth = [...points].sort(
      (a, b) => (b.pct_above_ema_50 ?? -Infinity) - (a.pct_above_ema_50 ?? -Infinity)
    );
    const healthiest = sortedByHealth[0]?.cohort_key ?? "—";
    const weakest = sortedByHealth[sortedByHealth.length - 1]?.cohort_key ?? "—";
    return { leading, weakening, healthiest, weakest };
  }, [bubble]);

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const thStyle = (field: SortField): React.CSSProperties => ({
    textAlign: field === "cohort_key" || field === "consensus_action" ? "left" : "right",
    padding: "10px 12px",
    color: "var(--text-tertiary)",
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  });

  const tdNumStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: "12px",
  };

  const tdLeftStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: "12px",
  };

  const regimeBadgeColor = (regime: string | null) => {
    if (!regime) return "var(--text-secondary)";
    if (regime.includes("BULLISH") || regime.includes("RISK_ON")) return "var(--rag-green-700)";
    if (regime.includes("BEARISH") || regime.includes("DISTRIBUTION")) return "var(--rag-red-700)";
    return "var(--rag-amber-700)";
  };

  const regimeBgColor = (regime: string | null) => {
    if (!regime) return "var(--bg-surface-alt)";
    if (regime.includes("BULLISH") || regime.includes("RISK_ON")) return "var(--rag-green-100)";
    if (regime.includes("BEARISH") || regime.includes("DISTRIBUTION")) return "var(--rag-red-100)";
    return "var(--rag-amber-100)";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>Sectors</h1>
        <DataFreshness dataAsOf={meta?.data_as_of ?? null} />
      </div>

      {/* Section 1: Market Context Banner */}
      {regimeData && (
        <div
          style={{
            background: regimeBgColor(regimeData.regime),
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: regimeBadgeColor(regimeData.regime),
              background: "rgba(255,255,255,0.5)",
              padding: "4px 10px",
              borderRadius: "999px",
            }}
          >
            {regimeData.regime ?? "UNKNOWN"}
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-primary)", flex: 1, minWidth: "200px" }}>
            {regimeSummary(regimeData)}
          </span>
        </div>
      )}

      {/* Section 2: Sector RRG */}
      {bubble && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>Sector Relative Rotation Graph</div>
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
            data={bubble.points}
            height={500}
            onBubbleClick={(key) => router.push(`/unified/sectors/${encodeURIComponent(key)}`)}
          />

          <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong>Legend:</strong> Color = Consensus Action &nbsp;|&nbsp; Size = # of Stocks &nbsp;|&nbsp; Position = RS vs Momentum
          </div>

          {/* Quadrant Explanations */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "16px" }}>
            <div style={{ background: "var(--rag-green-100)", border: "1px solid var(--rag-green-200)", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--rag-green-800)", marginBottom: "2px" }}>Leading (top-right)</div>
              <div style={{ fontSize: "11px", color: "var(--rag-green-700)" }}>Strong RS + Positive momentum → Accumulate</div>
            </div>
            <div style={{ background: "var(--rag-amber-100)", border: "1px solid var(--rag-amber-200)", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--rag-amber-800)", marginBottom: "2px" }}>Weakening (bottom-right)</div>
              <div style={{ fontSize: "11px", color: "var(--rag-amber-700)" }}>Strong RS + Negative momentum → Watch for exit</div>
            </div>
            <div style={{ background: "var(--rag-red-100)", border: "1px solid var(--rag-red-200)", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--rag-red-800)", marginBottom: "2px" }}>Lagging (bottom-left)</div>
              <div style={{ fontSize: "11px", color: "var(--rag-red-700)" }}>Weak RS + Negative momentum → Avoid</div>
            </div>
            <div style={{ background: "var(--accent-100)", border: "1px solid var(--accent-200)", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent-800)", marginBottom: "2px" }}>Improving (top-left)</div>
              <div style={{ fontSize: "11px", color: "var(--accent-700)" }}>Weak RS + Positive momentum → Watch for entry</div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Sector Summary Table */}
      {(state === "ready" || state === "stale") && bubble && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          {/* Summary Cards */}
          {summaryCards && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", padding: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Leading Sectors</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--rag-green-700)", marginTop: "4px" }}>{summaryCards.leading}</div>
              </div>
              <div style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Weakening Sectors</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--rag-red-700)", marginTop: "4px" }}>{summaryCards.weakening}</div>
              </div>
              <div style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Healthiest Sector</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>{summaryCards.healthiest}</div>
              </div>
              <div style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Weakest Sector</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>{summaryCards.weakest}</div>
              </div>
            </div>
          )}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Sector Health ({visiblePoints.length} of {sortedPoints.length})</span>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 400 }}>
              Benchmark: {BENCHMARK_OPTIONS.find((b) => b.value === benchmark)?.label} · Period: {period}
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={thStyle("cohort_key")} onClick={() => handleSort("cohort_key")}>Sector{sortArrow("cohort_key")}</th>
                  <th style={thStyle("member_count")} onClick={() => handleSort("member_count")}>Stocks{sortArrow("member_count")}</th>
                  <th style={thStyle("median_rs_rank")} onClick={() => handleSort("median_rs_rank")}>RS Rank{sortArrow("median_rs_rank")}</th>
                  <th style={thStyle("median_ret_3m")} onClick={() => handleSort("median_ret_3m")}>3M Ret{sortArrow("median_ret_3m")}</th>
                  <th style={thStyle("median_ret_12m")} onClick={() => handleSort("median_ret_12m")}>12M Ret{sortArrow("median_ret_12m")}</th>
                  <th style={thStyle("pct_above_ema_50")} onClick={() => handleSort("pct_above_ema_50")}>% &gt;EMA50{sortArrow("pct_above_ema_50")}</th>
                  <th style={thStyle("pct_leader_state")} onClick={() => handleSort("pct_leader_state")}>Leader %{sortArrow("pct_leader_state")}</th>
                  <th style={thStyle("avg_frag_score")} onClick={() => handleSort("avg_frag_score")}>Avg Frag{sortArrow("avg_frag_score")}</th>
                  <th style={thStyle("action_confidence")} onClick={() => handleSort("action_confidence")}>Confidence{sortArrow("action_confidence")}</th>
                  <th style={thStyle("consensus_action")} onClick={() => handleSort("consensus_action")}>Action{sortArrow("consensus_action")}</th>
                </tr>
              </thead>
              <tbody>
                {visiblePoints.map((s) => (
                  <tr
                    key={s.cohort_key}
                    style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onClick={() => router.push(`/unified/sectors/${encodeURIComponent(s.cohort_key)}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdLeftStyle}>
                      <Link href={`/unified/sectors/${encodeURIComponent(s.cohort_key)}`} style={{ color: "var(--accent-700)", textDecoration: "none", fontWeight: 500 }} onClick={(e) => e.stopPropagation()}>
                        {s.cohort_key}
                      </Link>
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 500 }}>{s.member_count}</td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: rsColor(s.median_rs_rank) }}>
                      {s.median_rs_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: retColor(s.median_ret_3m) }}>
                      {formatRet(s.median_ret_3m)}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: retColor(s.median_ret_12m) }}>
                      {formatRet(s.median_ret_12m)}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: pctAboveEmaColor(s.pct_above_ema_50) }}>
                      {formatPct(s.pct_above_ema_50)}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: leaderPctColor(s.pct_leader_state) }}>
                      {formatPct(s.pct_leader_state)}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 600, color: fragColor(s.avg_frag_score) }}>
                      {s.avg_frag_score?.toFixed(2) ?? "—"}
                      <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.7 }}>{fragLevelText(s.avg_frag_score)}</span>
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 600, color: "var(--text-primary)" }}>
                      {s.action_confidence !== null && s.action_confidence !== undefined ? `${(s.action_confidence * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td style={tdLeftStyle}>
                      {s.consensus_action ? (
                        <ActionBadge action={s.consensus_action} confidence={s.action_confidence} size="sm" />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedPoints.length > 15 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)", textAlign: "center" }}>
              <button
                onClick={() => setShowAll((v) => !v)}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--accent-700)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {showAll ? "Show first 15" : `Show all ${sortedPoints.length} sectors`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Section 4: Sector Recommendations Panel */}
      {bubble && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--rag-green-700)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--rag-green-500)", display: "inline-block" }} />
              Top Sectors to Accumulate
            </div>
            {recommendations.accumulate.length === 0 && (
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>No sectors meeting accumulation criteria.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recommendations.accumulate.map((s) => (
                <div
                  key={s.cohort_key}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "8px 10px", borderRadius: "6px", background: "var(--bg-surface-alt)" }}
                  onClick={() => router.push(`/unified/sectors/${encodeURIComponent(s.cohort_key)}`)}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{s.cohort_key}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {formatPct(s.pct_above_ema_50)} of stocks above EMA-50. Strong breadth.
                    </div>
                  </div>
                  {s.consensus_action && <ActionBadge action={s.consensus_action} confidence={s.action_confidence} size="sm" />}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--rag-red-700)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--rag-red-500)", display: "inline-block" }} />
              Sectors to Avoid
            </div>
            {recommendations.avoid.length === 0 && (
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>No sectors meeting avoidance criteria.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recommendations.avoid.map((s) => (
                <div
                  key={s.cohort_key}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "8px 10px", borderRadius: "6px", background: "var(--bg-surface-alt)" }}
                  onClick={() => router.push(`/unified/sectors/${encodeURIComponent(s.cohort_key)}`)}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{s.cohort_key}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {formatPct(s.pct_above_ema_50)} of stocks above EMA-50. Negative 3M return.
                    </div>
                  </div>
                  {s.consensus_action && <ActionBadge action={s.consensus_action} confidence={s.action_confidence} size="sm" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {state === "loading" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading sectors…</div>
      )}
    </div>
  );
}
