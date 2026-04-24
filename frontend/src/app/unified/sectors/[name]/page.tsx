"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useUnifiedData, useUnifiedDataPost } from "@/hooks/useUnifiedData";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type {
  AggregateResponse,
  ScreenerResponse,
  FundRankingsResponse,
  FundRankingRow,
  ScreenerRow,
  CohortPoint,
} from "@/lib/api-unified";

type ScreenerRowExt = ScreenerRow & { frag_level?: string | null };

const TABS = [
  { id: "stocks", label: "Stocks" },
  { id: "mutual-funds", label: "MFs" },
  { id: "etfs", label: "ETFs" },
];

const CAP_OPTIONS = ["All", "Large", "Mid", "Small"];
const STATE_OPTIONS = ["All", "LEADER", "EMERGING", "HOLDING", "BASE", "WEAKENING", "LAGGING", "BROKEN"];
const ACTION_OPTIONS = ["All", "STRONG_ACCUMULATE", "ACCUMULATE", "HOLD", "REDUCE", "EXIT"];

type StockSortField =
  | "name"
  | "symbol"
  | "rs_nifty_3m_rank"
  | "rs_nifty_12m_rank"
  | "ret_3m"
  | "above_ema_50"
  | "state"
  | "action"
  | "frag_score";

type FundSortField = "name" | "mf_category" | "lookthrough_rs_3m" | "aum_cr" | "expense_ratio" | "action";

function fragColor(frag: number | null) {
  if (frag === null) return "var(--text-secondary)";
  if (frag >= 0.6) return "var(--rag-red-700)";
  if (frag >= 0.3) return "var(--rag-amber-700)";
  return "var(--rag-green-700)";
}

function fragLevelText(score: number | null, level: string | null | undefined) {
  if (level) return level;
  if (score === null) return "—";
  if (score >= 0.6) return "CRITICAL";
  if (score >= 0.4) return "HIGH";
  if (score >= 0.3) return "MEDIUM";
  return "LOW";
}

function rsColor(rs: number | null) {
  if (rs === null) return "var(--text-secondary)";
  if (rs >= 80) return "var(--rag-green-900)";
  if (rs >= 60) return "var(--rag-green-700)";
  if (rs < 40) return "var(--rag-red-700)";
  return "var(--text-primary)";
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

function sectorNarrative(sp: CohortPoint | null) {
  if (!sp) return null;
  const parts: string[] = [];
  if (sp.pct_above_ema_50 !== null && sp.pct_above_ema_50 >= 80) {
    parts.push("Broad participation. Most stocks above key moving averages.");
  }
  if (sp.median_rs_rank !== null && sp.median_rs_rank >= 70) {
    parts.push("Top-quintile relative strength vs market.");
  }
  if (sp.pct_leader_state !== null && sp.pct_leader_state >= 20) {
    parts.push("High leadership concentration.");
  }
  if (sp.avg_frag_score !== null && sp.avg_frag_score <= 0.2) {
    parts.push("Low fragility across constituents.");
  }
  if (parts.length === 0) {
    parts.push("Mixed technical picture. Review individual constituents for clarity.");
  }
  return parts.join(" ");
}

export default function SectorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent((params.name as string) ?? "");
  const [activeTab, setActiveTab] = useState("stocks");

  const [stockSortField, setStockSortField] = useState<StockSortField>("rs_nifty_3m_rank");
  const [stockSortDirection, setStockSortDirection] = useState<"asc" | "desc">("desc");

  const [fundSortField, setFundSortField] = useState<FundSortField>("lookthrough_rs_3m");
  const [fundSortDirection, setFundSortDirection] = useState<"asc" | "desc">("desc");

  const [capFilter, setCapFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");

  const {
    data: aggregate,
    state: aggState,
    meta: aggMeta,
  } = useUnifiedData<AggregateResponse>("/api/unified/aggregate", {
    cohort_type: "sector",
  });

  const {
    data: stocksData,
    state: stocksState,
  } = useUnifiedDataPost<ScreenerResponse>("/api/unified/screen", {
    filters: [
      { field: "sector", op: "eq", value: name },
      { field: "instrument_type", op: "eq", value: "EQUITY" },
    ],
    sort_field: "rs_nifty_3m_rank",
    sort_direction: "desc",
    limit: 200,
    offset: 0,
  });

  const {
    data: etfData,
    state: etfState,
  } = useUnifiedDataPost<ScreenerResponse>("/api/unified/screen", {
    filters: [
      { field: "sector", op: "eq", value: name },
      { field: "instrument_type", op: "eq", value: "ETF" },
    ],
    sort_field: "rs_nifty_3m_rank",
    sort_direction: "desc",
    limit: 200,
    offset: 0,
  });

  const {
    data: rankingsData,
    state: rankingsState,
  } = useUnifiedData<FundRankingsResponse>("/api/unified/funds/rankings");

  const sectorPoint = useMemo(() => {
    if (!aggregate) return null;
    return aggregate.points.find((p) => p.cohort_key === name) ?? null;
  }, [aggregate, name]);

  const trendText = useMemo(() => {
    if (!sectorPoint) return null;
    const ret3m = sectorPoint.median_ret_3m ?? 0;
    const ret12m = sectorPoint.median_ret_12m ?? 0;
    if (ret3m > ret12m) return "Improving";
    if (ret3m < ret12m) return "Weakening";
    return "Stable";
  }, [sectorPoint]);

  const trendColor = useMemo(() => {
    if (!trendText) return "var(--text-secondary)";
    if (trendText === "Improving") return "var(--rag-green-700)";
    if (trendText === "Weakening") return "var(--rag-red-700)";
    return "var(--rag-amber-700)";
  }, [trendText]);

  const filteredSortedStocks = useMemo(() => {
    if (!stocksData) return [];
    let data = [...(stocksData.rows as ScreenerRowExt[])];
    if (capFilter !== "All") {
      data = data.filter((r) => r.cap_category === capFilter);
    }
    if (stateFilter !== "All") {
      data = data.filter((r) => r.state === stateFilter);
    }
    if (actionFilter !== "All") {
      data = data.filter((r) => r.action === actionFilter);
    }
    data.sort((a: ScreenerRowExt, b: ScreenerRowExt) => {
      let av: number | string | boolean | null = a[stockSortField];
      let bv: number | string | boolean | null = b[stockSortField];
      if (av === null || av === undefined) av = stockSortDirection === "asc" ? Infinity : -Infinity;
      if (bv === null || bv === undefined) bv = stockSortDirection === "asc" ? Infinity : -Infinity;
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return stockSortDirection === "asc" ? (av === bv ? 0 : av ? 1 : -1) : (av === bv ? 0 : av ? -1 : 1);
      }
      if (typeof av === "string" && typeof bv === "string") {
        return stockSortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return stockSortDirection === "asc" ? av - bv : bv - av;
      }
      return 0;
    });
    return data;
  }, [stocksData, capFilter, stateFilter, actionFilter, stockSortField, stockSortDirection]);

  const filteredSortedEtfs = useMemo(() => {
    if (!etfData) return [];
    let data = [...(etfData.rows as ScreenerRowExt[])];
    if (capFilter !== "All") {
      data = data.filter((r) => r.cap_category === capFilter);
    }
    if (stateFilter !== "All") {
      data = data.filter((r) => r.state === stateFilter);
    }
    if (actionFilter !== "All") {
      data = data.filter((r) => r.action === actionFilter);
    }
    data.sort((a: ScreenerRowExt, b: ScreenerRowExt) => {
      let av: number | string | boolean | null = a[stockSortField];
      let bv: number | string | boolean | null = b[stockSortField];
      if (av === null || av === undefined) av = stockSortDirection === "asc" ? Infinity : -Infinity;
      if (bv === null || bv === undefined) bv = stockSortDirection === "asc" ? Infinity : -Infinity;
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return stockSortDirection === "asc" ? (av === bv ? 0 : av ? 1 : -1) : (av === bv ? 0 : av ? -1 : 1);
      }
      if (typeof av === "string" && typeof bv === "string") {
        return stockSortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return stockSortDirection === "asc" ? av - bv : bv - av;
      }
      return 0;
    });
    return data;
  }, [etfData, capFilter, stateFilter, actionFilter, stockSortField, stockSortDirection]);

  const mfRows = useMemo(() => {
    if (!rankingsData) return [];
    return rankingsData.rows.filter((r) => {
      if (r.instrument_type !== "MF") return false;
      if (!r.mf_category) return false;
      return r.mf_category.toLowerCase().includes(name.toLowerCase());
    });
  }, [rankingsData, name]);

  const sortedMfs = useMemo(() => {
    const data = [...mfRows];
    data.sort((a: FundRankingRow, b: FundRankingRow) => {
      let av: number | string | null = a[fundSortField] ?? null;
      let bv: number | string | null = b[fundSortField] ?? null;
      if (av === null || av === undefined) av = fundSortDirection === "asc" ? Infinity : -Infinity;
      if (bv === null || bv === undefined) bv = fundSortDirection === "asc" ? Infinity : -Infinity;
      if (typeof av === "string" && typeof bv === "string") {
        return fundSortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return fundSortDirection === "asc" ? av - bv : bv - av;
      }
      return 0;
    });
    return data;
  }, [mfRows, fundSortField, fundSortDirection]);

  const handleStockSort = (field: StockSortField) => {
    if (stockSortField === field) {
      setStockSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setStockSortField(field);
      setStockSortDirection("desc");
    }
  };

  const handleFundSort = (field: FundSortField) => {
    if (fundSortField === field) {
      setFundSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setFundSortField(field);
      setFundSortDirection("desc");
    }
  };

  const stockSortArrow = (field: StockSortField) => {
    if (stockSortField !== field) return null;
    return stockSortDirection === "asc" ? " ↑" : " ↓";
  };

  const fundSortArrow = (field: FundSortField) => {
    if (fundSortField !== field) return null;
    return fundSortDirection === "asc" ? " ↑" : " ↓";
  };

  const stockThStyle = (field: StockSortField): React.CSSProperties => ({
    textAlign: ["name", "symbol", "state", "action", "above_ema_50"].includes(field) ? "left" : "right",
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

  const fundThStyle = (field: FundSortField): React.CSSProperties => ({
    textAlign: ["name", "mf_category", "action"].includes(field) ? "left" : "right",
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

  const selectStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid var(--border-default)",
    background: "var(--bg-surface)",
    fontSize: "13px",
    color: "var(--text-primary)",
  };

  const isStocksLoading = stocksState === "loading";
  const isEtfsLoading = etfState === "loading";
  const isFundsLoading = rankingsState === "loading";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
            <Link href="/unified/sectors" style={{ color: "var(--accent-700)", textDecoration: "none" }}>Sectors</Link>
            <span style={{ margin: "0 6px", color: "var(--border-strong)" }}>/</span>
            {name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>
              🇮🇳 {name}
            </h1>
            {sectorPoint?.consensus_action && (
              <ActionBadge action={sectorPoint.consensus_action} confidence={sectorPoint.action_confidence} size="md" />
            )}
          </div>
          {sectorPoint && (
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px", maxWidth: "600px", lineHeight: 1.5 }}>
              {sectorNarrative(sectorPoint)}
            </div>
          )}
        </div>
        <DataFreshness dataAsOf={aggMeta?.data_as_of ?? null} />
      </div>

      {/* Stats Row */}
      {sectorPoint && (
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px",
          display: "flex", gap: "24px", flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Members</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>{sectorPoint.member_count}</div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Median RS</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: rsColor(sectorPoint.median_rs_rank), marginTop: "2px" }}>
              {sectorPoint.median_rs_rank?.toFixed(1) ?? "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>3M Return</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: (sectorPoint.median_ret_3m ?? 0) >= 0 ? "var(--rag-green-700)" : "var(--rag-red-700)", marginTop: "2px" }}>
              {formatRet(sectorPoint.median_ret_3m)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>12M Return</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: (sectorPoint.median_ret_12m ?? 0) >= 0 ? "var(--rag-green-700)" : "var(--rag-red-700)", marginTop: "2px" }}>
              {formatRet(sectorPoint.median_ret_12m)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>% Above EMA-50</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: (sectorPoint.pct_above_ema_50 ?? 0) >= 70 ? "var(--rag-green-700)" : (sectorPoint.pct_above_ema_50 ?? 0) < 20 ? "var(--rag-red-700)" : "var(--text-primary)", marginTop: "2px" }}>
              {formatPct(sectorPoint.pct_above_ema_50)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Leader %</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
              {formatPct(sectorPoint.pct_leader_state)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Fragility</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: fragColor(sectorPoint.avg_frag_score), marginTop: "2px" }}>
              {sectorPoint.avg_frag_score?.toFixed(2) ?? "—"}
            </div>
          </div>
        </div>
      )}

      {/* Context Panel */}
      {sectorPoint && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
            How {name} ranks vs Market
          </div>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "13px", color: "var(--text-secondary)" }}>
            <div>
              <span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>RS Percentile: </span>
              <span style={{ fontWeight: 700, color: rsColor(sectorPoint.median_rs_rank) }}>
                {sectorPoint.median_rs_rank?.toFixed(1) ?? "—"}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginLeft: "4px" }}>vs Nifty 50</span>
            </div>
            <div>
              <span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Trend: </span>
              <span style={{ fontWeight: 700, color: trendColor }}>{trendText}</span>
            </div>
            <div>
              <span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Consensus: </span>
              <span style={{ fontWeight: 700, color: (sectorPoint.consensus_action ?? "").includes("ACCUMULATE") ? "var(--rag-green-700)" : (sectorPoint.consensus_action ?? "").includes("EXIT") || (sectorPoint.consensus_action ?? "").includes("REDUCE") ? "var(--rag-red-700)" : "var(--rag-amber-700)" }}>
                {sectorPoint.consensus_action ?? "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {aggState === "loading" && !sectorPoint && (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading sector overview…</div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--border-default)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent-700)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab.id ? "var(--accent-700)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Stocks */}
      {activeTab === "stocks" && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <span>Stocks ({filteredSortedStocks.length} of {stocksData?.total_count ?? 0})</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select value={capFilter} onChange={(e) => setCapFilter(e.target.value)} style={selectStyle}>
                {CAP_OPTIONS.map((c) => <option key={c} value={c}>{c === "All" ? "All Caps" : c}</option>)}
              </select>
              <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={selectStyle}>
                {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s === "All" ? "All States" : s}</option>)}
              </select>
              <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={selectStyle}>
                {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a === "All" ? "All Actions" : a.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={stockThStyle("name")} onClick={() => handleStockSort("name")}>Name{stockSortArrow("name")}</th>
                  <th style={stockThStyle("symbol")} onClick={() => handleStockSort("symbol")}>Symbol{stockSortArrow("symbol")}</th>
                  <th style={stockThStyle("rs_nifty_3m_rank")} onClick={() => handleStockSort("rs_nifty_3m_rank")}>RS 3M{stockSortArrow("rs_nifty_3m_rank")}</th>
                  <th style={stockThStyle("rs_nifty_12m_rank")} onClick={() => handleStockSort("rs_nifty_12m_rank")}>RS 12M{stockSortArrow("rs_nifty_12m_rank")}</th>
                  <th style={stockThStyle("ret_3m")} onClick={() => handleStockSort("ret_3m")}>3M Ret{stockSortArrow("ret_3m")}</th>
                  <th style={stockThStyle("above_ema_50")} onClick={() => handleStockSort("above_ema_50")}>Above EMA-50{stockSortArrow("above_ema_50")}</th>
                  <th style={stockThStyle("state")} onClick={() => handleStockSort("state")}>State{stockSortArrow("state")}</th>
                  <th style={stockThStyle("action")} onClick={() => handleStockSort("action")}>Action{stockSortArrow("action")}</th>
                  <th style={stockThStyle("frag_score")} onClick={() => handleStockSort("frag_score")}>Frag{stockSortArrow("frag_score")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSortedStocks.map((stock) => (
                  <tr
                    key={stock.instrument_id}
                    style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onClick={() => router.push(`/unified/instrument/${stock.instrument_id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ ...tdLeftStyle, fontWeight: 500, color: "var(--text-primary)" }}>{stock.name}</td>
                    <td style={{ ...tdLeftStyle, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{stock.symbol}</td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: rsColor(stock.rs_nifty_3m_rank) }}>
                      {stock.rs_nifty_3m_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: rsColor(stock.rs_nifty_12m_rank) }}>
                      {stock.rs_nifty_12m_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: (stock.ret_3m ?? 0) >= 0 ? "var(--rag-green-700)" : "var(--rag-red-700)" }}>
                      {formatRet(stock.ret_3m)}
                    </td>
                    <td style={tdLeftStyle}>
                      <span style={{
                        fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px",
                        background: stock.above_ema_50 ? "var(--rag-green-100)" : stock.above_ema_50 === false ? "var(--rag-red-100)" : "var(--bg-inset)",
                        color: stock.above_ema_50 ? "var(--rag-green-700)" : stock.above_ema_50 === false ? "var(--rag-red-700)" : "var(--text-secondary)",
                      }}>
                        {stock.above_ema_50 === true ? "Yes" : stock.above_ema_50 === false ? "No" : "—"}
                      </span>
                    </td>
                    <td style={tdLeftStyle}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                        background: stock.state === "LEADER" ? "var(--rag-green-100)" : stock.state === "EMERGING" ? "var(--rag-amber-100)" : stock.state === "WEAKENING" ? "var(--rag-red-100)" : "var(--bg-inset)",
                        color: stock.state === "LEADER" ? "var(--rag-green-700)" : stock.state === "EMERGING" ? "var(--rag-amber-700)" : stock.state === "WEAKENING" ? "var(--rag-red-700)" : "var(--text-secondary)",
                      }}>
                        {stock.state ?? "—"}
                      </span>
                    </td>
                    <td style={tdLeftStyle}>
                      {stock.action ? (
                        <ActionBadge action={stock.action} confidence={stock.action_confidence} size="sm" />
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 600, color: fragColor(stock.frag_score) }}>
                      {stock.frag_score?.toFixed(2) ?? "—"}
                      <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.7 }}>
                        {fragLevelText(stock.frag_score, stock.frag_level)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isStocksLoading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading stocks…</div>
          )}
          {!isStocksLoading && filteredSortedStocks.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>No stocks found matching filters.</div>
          )}
        </div>
      )}

      {/* Tab 2: Mutual Funds */}
      {activeTab === "mutual-funds" && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Mutual Funds ({sortedMfs.length})</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={fundThStyle("name")} onClick={() => handleFundSort("name")}>Fund Name{fundSortArrow("name")}</th>
                  <th style={fundThStyle("mf_category")} onClick={() => handleFundSort("mf_category")}>Category{fundSortArrow("mf_category")}</th>
                  <th style={fundThStyle("lookthrough_rs_3m")} onClick={() => handleFundSort("lookthrough_rs_3m")}>LT RS 3M{fundSortArrow("lookthrough_rs_3m")}</th>
                  <th style={fundThStyle("aum_cr")} onClick={() => handleFundSort("aum_cr")}>AUM (Cr){fundSortArrow("aum_cr")}</th>
                  <th style={fundThStyle("expense_ratio")} onClick={() => handleFundSort("expense_ratio")}>Expense{fundSortArrow("expense_ratio")}</th>
                  <th style={fundThStyle("action")} onClick={() => handleFundSort("action")}>Action{fundSortArrow("action")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedMfs.map((fund: FundRankingRow) => (
                  <tr
                    key={fund.instrument_id}
                    style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onClick={() => router.push(`/unified/funds/${fund.instrument_id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ ...tdLeftStyle, fontWeight: 500, color: "var(--text-primary)" }}>
                      <div>{fund.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{fund.symbol}</div>
                    </td>
                    <td style={{ ...tdLeftStyle, color: "var(--text-secondary)" }}>{fund.mf_category}</td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: rsColor(fund.lookthrough_rs_3m) }}>
                      {fund.lookthrough_rs_3m?.toFixed(1) ?? "—"}
                    </td>
                    <td style={tdNumStyle}>
                      {fund.aum_cr ? `₹${fund.aum_cr.toFixed(0)}Cr` : "—"}
                    </td>
                    <td style={tdNumStyle}>
                      {fund.expense_ratio ? `${(fund.expense_ratio * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td style={tdLeftStyle}>
                      {fund.action ? (
                        <ActionBadge action={fund.action} size="sm" />
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isFundsLoading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading funds…</div>
          )}
          {!isFundsLoading && sortedMfs.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>No sector-specific funds found.</div>
          )}
        </div>
      )}

      {/* Tab 3: ETFs */}
      {activeTab === "etfs" && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <span>ETFs ({filteredSortedEtfs.length} of {etfData?.total_count ?? 0})</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select value={capFilter} onChange={(e) => setCapFilter(e.target.value)} style={selectStyle}>
                {CAP_OPTIONS.map((c) => <option key={c} value={c}>{c === "All" ? "All Caps" : c}</option>)}
              </select>
              <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={selectStyle}>
                {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s === "All" ? "All States" : s}</option>)}
              </select>
              <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={selectStyle}>
                {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a === "All" ? "All Actions" : a.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={stockThStyle("name")} onClick={() => handleStockSort("name")}>Name{stockSortArrow("name")}</th>
                  <th style={stockThStyle("symbol")} onClick={() => handleStockSort("symbol")}>Symbol{stockSortArrow("symbol")}</th>
                  <th style={stockThStyle("rs_nifty_3m_rank")} onClick={() => handleStockSort("rs_nifty_3m_rank")}>RS 3M{stockSortArrow("rs_nifty_3m_rank")}</th>
                  <th style={stockThStyle("rs_nifty_12m_rank")} onClick={() => handleStockSort("rs_nifty_12m_rank")}>RS 12M{stockSortArrow("rs_nifty_12m_rank")}</th>
                  <th style={stockThStyle("ret_3m")} onClick={() => handleStockSort("ret_3m")}>3M Ret{stockSortArrow("ret_3m")}</th>
                  <th style={stockThStyle("above_ema_50")} onClick={() => handleStockSort("above_ema_50")}>Above EMA-50{stockSortArrow("above_ema_50")}</th>
                  <th style={stockThStyle("state")} onClick={() => handleStockSort("state")}>State{stockSortArrow("state")}</th>
                  <th style={stockThStyle("action")} onClick={() => handleStockSort("action")}>Action{stockSortArrow("action")}</th>
                  <th style={stockThStyle("frag_score")} onClick={() => handleStockSort("frag_score")}>Frag{stockSortArrow("frag_score")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSortedEtfs.map((stock) => (
                  <tr
                    key={stock.instrument_id}
                    style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onClick={() => router.push(`/unified/instrument/${stock.instrument_id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ ...tdLeftStyle, fontWeight: 500, color: "var(--text-primary)" }}>{stock.name}</td>
                    <td style={{ ...tdLeftStyle, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{stock.symbol}</td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: rsColor(stock.rs_nifty_3m_rank) }}>
                      {stock.rs_nifty_3m_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: rsColor(stock.rs_nifty_12m_rank) }}>
                      {stock.rs_nifty_12m_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: (stock.ret_3m ?? 0) >= 0 ? "var(--rag-green-700)" : "var(--rag-red-700)" }}>
                      {formatRet(stock.ret_3m)}
                    </td>
                    <td style={tdLeftStyle}>
                      <span style={{
                        fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px",
                        background: stock.above_ema_50 ? "var(--rag-green-100)" : stock.above_ema_50 === false ? "var(--rag-red-100)" : "var(--bg-inset)",
                        color: stock.above_ema_50 ? "var(--rag-green-700)" : stock.above_ema_50 === false ? "var(--rag-red-700)" : "var(--text-secondary)",
                      }}>
                        {stock.above_ema_50 === true ? "Yes" : stock.above_ema_50 === false ? "No" : "—"}
                      </span>
                    </td>
                    <td style={tdLeftStyle}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                        background: stock.state === "LEADER" ? "var(--rag-green-100)" : stock.state === "EMERGING" ? "var(--rag-amber-100)" : stock.state === "WEAKENING" ? "var(--rag-red-100)" : "var(--bg-inset)",
                        color: stock.state === "LEADER" ? "var(--rag-green-700)" : stock.state === "EMERGING" ? "var(--rag-amber-700)" : stock.state === "WEAKENING" ? "var(--rag-red-700)" : "var(--text-secondary)",
                      }}>
                        {stock.state ?? "—"}
                      </span>
                    </td>
                    <td style={tdLeftStyle}>
                      {stock.action ? (
                        <ActionBadge action={stock.action} confidence={stock.action_confidence} size="sm" />
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tdNumStyle, fontWeight: 600, color: fragColor(stock.frag_score) }}>
                      {stock.frag_score?.toFixed(2) ?? "—"}
                      <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.7 }}>
                        {fragLevelText(stock.frag_score, stock.frag_level)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isEtfsLoading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading ETFs…</div>
          )}
          {!isEtfsLoading && filteredSortedEtfs.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>No ETFs found matching filters.</div>
          )}
        </div>
      )}
    </div>
  );
}
