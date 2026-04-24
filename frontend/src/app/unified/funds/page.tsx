"use client";

import { useState, useMemo, useCallback } from "react";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import { useRouter } from "next/navigation";
import FactorHeatmapCell from "@/components/unified/FactorHeatmapCell";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import type { FundRankingRow, FundRankingsResponse, FundCategoriesResponse } from "@/lib/api-unified";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

type SortKey =
  | "name"
  | "factor_momentum_pct"
  | "factor_quality_pct"
  | "factor_resilience_pct"
  | "factor_holdings_pct"
  | "factor_cost_pct"
  | "factor_consistency_pct"
  | "lookthrough_rs_3m"
  | "aum_cr"
  | "action";

const FACTOR_COLUMNS: { key: SortKey; label: string; short: string }[] = [
  { key: "factor_momentum_pct", label: "Momentum", short: "Mom" },
  { key: "factor_quality_pct", label: "Quality", short: "Qual" },
  { key: "factor_resilience_pct", label: "Resilience", short: "Res" },
  { key: "factor_holdings_pct", label: "Holdings", short: "Hold" },
  { key: "factor_cost_pct", label: "Cost", short: "Cost" },
  { key: "factor_consistency_pct", label: "Consistency", short: "Con" },
];

const ACTION_COLORS: Record<string, string> = {
  STRONG_ACCUMULATE: "var(--rag-green-500)",
  ACCUMULATE: "var(--rag-green-400)",
  HOLD: "var(--rag-amber-500)",
  REDUCE: "var(--rag-orange-500)",
  EXIT: "var(--rag-red-500)",
};

const QUADRANT_BG = {
  leading: "var(--rag-green-100)",
  weakening: "var(--rag-amber-100)",
  lagging: "var(--rag-red-100)",
  improving: "var(--accent-100)",
};

interface BubblePoint {
  x: number;
  y: number;
  z: number;
  name: string;
  action: string;
  aum: number;
  instrument_id: string;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatAum(aum: number | null): string {
  if (aum === null || aum === undefined || aum === 0) return "—";
  return `₹${Math.round(aum).toLocaleString("en-IN")} Cr`;
}

function formatRank(rank: number | null, total: number | null): string {
  if (rank === null || total === null) return "—";
  return `${ordinal(rank)} of ${total}`;
}

function rsColor(rs: number | null): string {
  if (rs === null) return "var(--text-secondary)";
  if (rs >= 80) return "var(--rag-green-900)";
  if (rs >= 60) return "var(--rag-green-700)";
  if (rs >= 40) return "var(--text-secondary)";
  if (rs >= 20) return "var(--rag-red-700)";
  return "var(--rag-red-900)";
}

function rsText(rs: number | null): string {
  if (rs === null) return "";
  if (rs >= 80) return "Top quintile";
  if (rs >= 60) return "Above average";
  if (rs >= 40) return "Average";
  if (rs >= 20) return "Below average";
  return "Bottom quintile";
}

function isIndexFund(f: FundRankingRow): boolean {
  const n = (f.name ?? "").toLowerCase();
  const c = (f.mf_category ?? "").toLowerCase();
  return n.includes("index") || c.includes("index");
}
export default function FundsPage() {
  const { data: rankingsData, state, meta } = useUnifiedData<FundRankingsResponse>("/api/unified/funds/rankings");
  const { data: categoriesData } = useUnifiedData<FundCategoriesResponse>("/api/unified/funds/categories");
  const router = useRouter();

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [capTiltFilter, setCapTiltFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("factor_momentum_pct");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [significantOnly, setSignificantOnly] = useState(true);
  const [includeIndexFunds, setIncludeIndexFunds] = useState(false);

  const funds = rankingsData?.rows ?? [];

  const stats = useMemo(() => {
    const total = funds.length;
    const largeCap = funds.filter((f) => f.cap_tilt === "LARGE").length;
    const midCap = funds.filter((f) => f.cap_tilt === "MID").length;
    const smallCap = funds.filter((f) => f.cap_tilt === "SMALL").length;
    const byAction = {
      STRONG_ACCUMULATE: funds.filter((f) => f.action === "STRONG_ACCUMULATE").length,
      ACCUMULATE: funds.filter((f) => f.action === "ACCUMULATE").length,
      HOLD: funds.filter((f) => f.action === "HOLD").length,
      REDUCE: funds.filter((f) => f.action === "REDUCE").length,
      EXIT: funds.filter((f) => f.action === "EXIT").length,
    };
    const totalAum = funds.reduce((sum, f) => sum + (f.aum_cr ?? 0), 0);
    const avgAum = total > 0 ? totalAum / total : 0;
    return { total, largeCap, midCap, smallCap, byAction, totalAum, avgAum };
  }, [funds]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    set.add("All");
    categoriesData?.categories.forEach((c) => set.add(c.category));
    funds.forEach((f) => {
      if (f.mf_category) set.add(f.mf_category);
    });
    return Array.from(set).sort();
  }, [categoriesData, funds]);

  const capTiltOptions = useMemo(() => {
    const set = new Set<string>();
    set.add("All");
    funds.forEach((f) => {
      if (f.cap_tilt) set.add(f.cap_tilt);
    });
    return Array.from(set).sort();
  }, [funds]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc((prev) => !prev);
      } else {
        setSortKey(key);
        setSortAsc(false);
      }
    },
    [sortKey]
  );

  const filteredFunds = useMemo(() => {
    let result = [...funds];
    if (categoryFilter !== "All") {
      result = result.filter((f) => f.mf_category === categoryFilter);
    }
    if (capTiltFilter !== "All") {
      result = result.filter((f) => f.cap_tilt === capTiltFilter);
    }
    if (significantOnly) {
      result = result.filter((f) => (f.aum_cr ?? 0) >= 100);
    }
    if (!includeIndexFunds) {
      result = result.filter((f) => !isIndexFund(f));
    }
    return result;
  }, [funds, categoryFilter, capTiltFilter, significantOnly, includeIndexFunds]);

  const sortedFunds = useMemo(() => {
    const result = [...filteredFunds];
    result.sort((a, b) => {
      const av = a[sortKey] ?? null;
      const bv = b[sortKey] ?? null;
      if (av === null && bv === null) return 0;
      if (av === null) return sortAsc ? -1 : 1;
      if (bv === null) return sortAsc ? 1 : -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      return 0;
    });
    return result;
  }, [filteredFunds, sortKey, sortAsc]);

  const bubbleData: BubblePoint[] = useMemo(() => {
    const maxAum = Math.max(...filteredFunds.map((f) => f.aum_cr ?? 0), 1);
    return filteredFunds.map((f) => {
      const aum = f.aum_cr ?? 0;
      const logSize = aum > 0 ? Math.log10(aum + 1) / Math.log10(maxAum + 1) : 0;
      return {
        x: f.lookthrough_rs_3m ?? 0,
        y: f.factor_momentum_pct ?? 0,
        z: Math.max(20, logSize * 400),
        name: f.name,
        action: f.action ?? "HOLD",
        aum,
        instrument_id: f.instrument_id,
      };
    });
  }, [filteredFunds]);

  if (state === "loading") {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading funds…</div>;
  }

  if (state === "error") {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--rag-red-700)" }}>
        Failed to load data. <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>Fund Rankings</h1>
        <DataFreshness dataAsOf={meta?.data_as_of ?? null} />
      </div>

      {/* Stats Overview */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>Fund Universe Overview</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Total Funds</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{stats.total}</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>By Cap</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", gap: "12px", marginTop: "2px" }}>
              <span>Large-Cap <strong style={{ color: "var(--text-primary)" }}>{stats.largeCap}</strong></span>
              <span>Mid-Cap <strong style={{ color: "var(--text-primary)" }}>{stats.midCap}</strong></span>
              <span>Small-Cap <strong style={{ color: "var(--text-primary)" }}>{stats.smallCap}</strong></span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>By Action</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", gap: "12px", marginTop: "2px", flexWrap: "wrap" }}>
              <span style={{ color: "var(--rag-green-700)" }}>STRONG_ACCUMULATE <strong>{stats.byAction.STRONG_ACCUMULATE}</strong></span>
              <span style={{ color: "var(--rag-green-600)" }}>ACCUMULATE <strong>{stats.byAction.ACCUMULATE}</strong></span>
              <span style={{ color: "var(--rag-amber-700)" }}>HOLD <strong>{stats.byAction.HOLD}</strong></span>
              <span style={{ color: "var(--rag-orange-700)" }}>REDUCE <strong>{stats.byAction.REDUCE}</strong></span>
              <span style={{ color: "var(--rag-red-700)" }}>EXIT <strong>{stats.byAction.EXIT}</strong></span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Avg AUM</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{formatAum(stats.avgAum)}</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Total AUM</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{formatAum(stats.totalAum)}</div>
          </div>
        </div>
      </div>

      {/* Bubble Chart */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>Fund Universe Map</div>
        <div style={{ width: "100%", height: "360px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill={QUADRANT_BG.leading} fillOpacity={0.35} stroke="none" label={{ value: "Leading", position: "insideTopRight", fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }} />
              <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill={QUADRANT_BG.weakening} fillOpacity={0.35} stroke="none" label={{ value: "Weakening", position: "insideBottomRight", fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }} />
              <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill={QUADRANT_BG.lagging} fillOpacity={0.35} stroke="none" label={{ value: "Lagging", position: "insideBottomLeft", fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }} />
              <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill={QUADRANT_BG.improving} fillOpacity={0.35} stroke="none" label={{ value: "Improving", position: "insideTopLeft", fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }} />
              <ReferenceLine x={50} stroke="var(--border-strong)" strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke="var(--border-strong)" strokeDasharray="4 4" />
              <XAxis
                type="number"
                dataKey="x"
                name="Lookthrough RS 3M"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                axisLine={{ stroke: "var(--border-default)" }}
                tickLine={false}
                label={{ value: "Lookthrough RS 3M", position: "insideBottom", offset: -10, style: { fontSize: 11, fill: "var(--text-tertiary)" } }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Momentum factor percentile"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                axisLine={{ stroke: "var(--border-default)" }}
                tickLine={false}
                label={{ value: "Momentum factor percentile", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "var(--text-tertiary)" } }}
              />
              <ZAxis type="number" dataKey="z" range={[20, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const p = payload[0].payload as BubblePoint;
                  return (
                    <div
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "6px",
                        padding: "10px 12px",
                        fontSize: "12px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>{p.name}</div>
                      <div style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        Lookthrough RS: {p.x.toFixed(1)}
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        Momentum: {p.y.toFixed(1)}
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        AUM: {formatAum(p.aum)}
                      </div>
                      <div style={{ color: "var(--text-tertiary)", marginTop: "2px", textTransform: "uppercase", fontSize: "11px", fontWeight: 600 }}>
                        {p.action}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={bubbleData}>
                {bubbleData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={ACTION_COLORS[entry.action] ?? "var(--text-tertiary)"}
                    fillOpacity={0.7}
                    stroke={ACTION_COLORS[entry.action] ?? "var(--text-tertiary)"}
                    strokeWidth={1}
                    onClick={() => router.push(`/unified/funds/${entry.instrument_id}`)}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              fontSize: "13px",
              color: "var(--text-primary)",
            }}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Cap Tilt:</label>
          <select
            value={capTiltFilter}
            onChange={(e) => setCapTiltFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              fontSize: "13px",
              color: "var(--text-primary)",
            }}
          >
            {capTiltOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Sort:</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              fontSize: "13px",
              color: "var(--text-primary)",
            }}
          >
            {FACTOR_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
            <option value="aum_cr">AUM</option>
            <option value="lookthrough_rs_3m">Lookthrough RS</option>
          </select>
          <button
            onClick={() => setSortAsc((prev) => !prev)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              fontSize: "13px",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
            title={sortAsc ? "Ascending" : "Descending"}
          >
            {sortAsc ? "↑" : "↓"}
          </button>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={significantOnly}
            onChange={(e) => setSignificantOnly(e.target.checked)}
          />
          Significant funds only (≥100 Cr)
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={includeIndexFunds}
            onChange={(e) => setIncludeIndexFunds(e.target.checked)}
          />
          Include index funds
        </label>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            Mutual Fund Rankings ({sortedFunds.length} of {funds.length})
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "var(--bg-surface-alt)" }}>
                <th
                  style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={() => handleSort("name")}
                >
                  Fund {sortKey === "name" && (sortAsc ? "↑" : "↓")}
                </th>
                {FACTOR_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{ textAlign: "center", padding: "10px 8px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                    onClick={() => handleSort(col.key)}
                    title={col.label}
                  >
                    {col.short} {sortKey === col.key && (sortAsc ? "↑" : "↓")}
                  </th>
                ))}
                <th
                  style={{ textAlign: "center", padding: "10px 8px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={() => handleSort("lookthrough_rs_3m")}
                >
                  LT RS {sortKey === "lookthrough_rs_3m" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  style={{ textAlign: "center", padding: "10px 8px", color: "var(--text-tertiary)", fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  Cap
                </th>
                <th
                  style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={() => handleSort("aum_cr")}
                >
                  AUM {sortKey === "aum_cr" && (sortAsc ? "↑" : "↓")}
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFunds.map((f) => (
                <tr
                  key={f.instrument_id}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                  onClick={() => router.push(`/unified/funds/${f.instrument_id}`)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 500, whiteSpace: "nowrap" }}>
                    <div>{f.name}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                      {f.mf_category} {f.rank_in_category !== null && f.total_in_category !== null && `· ${formatRank(f.rank_in_category, f.total_in_category)}`}
                    </div>
                  </td>
                  {FACTOR_COLUMNS.map((col) => (
                    <td key={col.key} style={{ padding: "10px 8px", textAlign: "center" }}>
                      <FactorHeatmapCell value={f[col.key] as number | null} />
                    </td>
                  ))}
                  <td style={{ padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                    <div style={{ fontWeight: 600, color: rsColor(f.lookthrough_rs_3m) }}>{f.lookthrough_rs_3m?.toFixed(1) ?? "—"}</div>
                    <div style={{ fontSize: "10px", color: rsColor(f.lookthrough_rs_3m) }}>{rsText(f.lookthrough_rs_3m)}</div>
                  </td>
                  <td style={{ padding: "10px 8px", textAlign: "center", color: "var(--text-secondary)", fontWeight: 600 }}>
                    {f.cap_tilt ?? "—"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {formatAum(f.aum_cr)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <ActionBadge action={f.action ?? "HOLD"} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedFunds.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>
            No funds match the selected filters.
          </div>
        )}
      </div>

      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
        Legend: 0–25{" "}
        <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", background: "var(--rag-red-100)", border: "1px solid var(--rag-red-300)", verticalAlign: "middle" }} />{" "}
        25–50{" "}
        <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", background: "var(--rag-amber-100)", border: "1px solid var(--rag-amber-300)", verticalAlign: "middle" }} />{" "}
        50–75{" "}
        <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", background: "#FEF9C3", border: "1px solid #FDE047", verticalAlign: "middle" }} />{" "}
        75–100{" "}
        <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "2px", background: "var(--rag-green-100)", border: "1px solid var(--rag-green-300)", verticalAlign: "middle" }} />
      </div>
    </div>
  );
}
