"use client";

import { useState, useMemo, useCallback } from "react";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import { useRouter } from "next/navigation";
import FactorHeatmapCell from "@/components/unified/FactorHeatmapCell";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import type { FundRanking, FundRankingsResponse, FundCategoriesResponse } from "@/lib/api-unified";

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

function formatAum(aum: number | null): string {
  if (aum === null || aum === undefined) return "—";
  return `${Math.round(aum).toLocaleString("en-IN")} Cr`;
}

function formatRank(rank: number | null, total: number | null): string {
  if (rank === null || total === null) return "—";
  return `${rank} / ${total}`;
}

export default function FundsPage() {
  const { data: rankingsData, state, meta } = useUnifiedData<FundRankingsResponse>("/api/unified/funds/rankings");
  const { data: categoriesData } = useUnifiedData<FundCategoriesResponse>("/api/unified/funds/categories");
  const router = useRouter();

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [capTiltFilter, setCapTiltFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("factor_momentum_pct");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const funds = rankingsData?.funds ?? [];

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

  const sortedFunds = useMemo(() => {
    let result = [...funds];
    if (categoryFilter !== "All") {
      result = result.filter((f) => f.mf_category === categoryFilter);
    }
    if (capTiltFilter !== "All") {
      result = result.filter((f) => f.cap_tilt === capTiltFilter);
    }
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
  }, [funds, categoryFilter, capTiltFilter, sortKey, sortAsc]);

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
                  <td style={{ padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {f.lookthrough_rs_3m?.toFixed(1) ?? "—"}
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
