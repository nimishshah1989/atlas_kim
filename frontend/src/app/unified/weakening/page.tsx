"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import DataFreshness from "@/components/unified/DataFreshness";
import { postApi } from "@/lib/api-unified";
import type { ScreenerResponse, ScreenerRow } from "@/lib/api-unified";

const PAGE_SIZE = 25;

type SortField =
  | "name"
  | "symbol"
  | "sector"
  | "cap_category"
  | "rs_nifty_3m_rank"
  | "rs_nifty_12m_rank"
  | "ret_3m"
  | "ret_12m"
  | "above_ema_50"
  | "state"
  | "action"
  | "frag_score";

export default function WeakeningPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [sectorFilter, setSectorFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [includeSmallCap, setIncludeSmallCap] = useState(false);

  const [sortField, setSortField] = useState<SortField>("frag_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const resp = await postApi<ScreenerResponse>("/api/unified/screen", {
        filters: [
          { field: "action", op: "in", value: ["REDUCE", "EXIT"] },
          { field: "instrument_type", op: "eq", value: "EQUITY" },
        ],
        sort_field: "frag_score",
        sort_direction: "desc",
        limit: 200,
        offset: 0,
      });
      setRows(resp.rows);
      setTotalCount(resp.total_count);
      setDataAsOf(resp.meta?.data_as_of ?? null);
    } catch {
      setRows([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.sector) set.add(r.sector);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    let data = [...rows];
    if (sectorFilter) {
      data = data.filter((r) => r.sector === sectorFilter);
    }
    if (actionFilter) {
      data = data.filter((r) => r.action === actionFilter);
    }
    if (!includeSmallCap) {
      data = data.filter((r) => r.cap_category === "LARGE" || r.cap_category === "MID");
    }
    data.sort((a, b) => {
      let av: number | string | boolean | null = a[sortField];
      let bv: number | string | boolean | null = b[sortField];
      if (av === null || av === undefined) av = sortDirection === "asc" ? Infinity : -Infinity;
      if (bv === null || bv === undefined) bv = sortDirection === "asc" ? Infinity : -Infinity;
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return sortDirection === "asc" ? (av === bv ? 0 : av ? 1 : -1) : (av === bv ? 0 : av ? -1 : 1);
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortDirection === "asc" ? av - bv : bv - av;
      }
      return 0;
    });
    return data;
  }, [rows, sectorFilter, actionFilter, includeSmallCap, sortField, sortDirection]);

  const pageCount = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setPage(0);
  };

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const thStyle = (field: SortField): React.CSSProperties => ({
    textAlign: ["name", "symbol", "sector", "cap_category", "state", "action", "above_ema_50"].includes(field) ? "left" : "right",
    padding: "10px 12px",
    color: "var(--text-tertiary)",
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  });

  const actionColor = (action: string | null) => {
    if (!action) return "var(--text-secondary)";
    if (action === "STRONG_ACCUMULATE" || action === "ACCUMULATE") return "var(--rag-green-700)";
    if (action === "EXIT" || action === "REDUCE") return "var(--rag-red-700)";
    return "var(--rag-amber-700)";
  };

  const fragDisplay = (frag: number | null): { text: string; color: string } => {
    if (frag === null) return { text: "—", color: "var(--text-secondary)" };
    const pct = Math.round(frag * 100);
    if (frag > 0.4) return { text: `${pct}%`, color: "var(--rag-red-700)" };
    if (frag >= 0.2) return { text: `${pct}%`, color: "var(--rag-amber-700)" };
    return { text: `${pct}%`, color: "var(--rag-green-700)" };
  };

  const rsColor = (rs: number | null) => {
    if (rs === null) return "var(--text-secondary)";
    if (rs >= 80) return "var(--rag-green-900)";
    if (rs >= 60) return "var(--rag-green-700)";
    if (rs >= 40) return "var(--text-secondary)";
    if (rs >= 20) return "var(--rag-red-700)";
    return "var(--rag-red-900)";
  };

  const rsText = (rs: number | null): string => {
    if (rs === null) return "";
    if (rs >= 80) return "Top quintile";
    if (rs >= 60) return "Above average";
    if (rs >= 40) return "Average";
    if (rs >= 20) return "Below average";
    return "Bottom quintile";
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading weakening data…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>Weakening & Exit Candidates</h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            REDUCE + EXIT candidates — review positions
          </div>
        </div>
        <DataFreshness dataAsOf={dataAsOf} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={sectorFilter}
          onChange={(e) => { setSectorFilter(e.target.value); setPage(0); }}
          style={{
            padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-default)",
            background: "var(--bg-surface)", fontSize: "13px", color: "var(--text-primary)", minWidth: "160px",
          }}
        >
          <option value="">All Sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          style={{
            padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-default)",
            background: "var(--bg-surface)", fontSize: "13px", color: "var(--text-primary)", minWidth: "140px",
          }}
        >
          <option value="">REDUCE + EXIT</option>
          <option value="REDUCE">REDUCE only</option>
          <option value="EXIT">EXIT only</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
          <input type="checkbox" checked={includeSmallCap} onChange={(e) => { setIncludeSmallCap(e.target.checked); setPage(0); }} />
          Include Small Cap
        </label>
      </div>

      {error && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--rag-red-700)" }}>
          Failed to load data. <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!error && filteredRows.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600 }}>
            {filteredRows.length} of {totalCount} candidates
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={thStyle("name")} onClick={() => handleSort("name")}>Name{sortArrow("name")}</th>
                  <th style={thStyle("symbol")} onClick={() => handleSort("symbol")}>Symbol{sortArrow("symbol")}</th>
                  <th style={thStyle("sector")} onClick={() => handleSort("sector")}>Sector{sortArrow("sector")}</th>
                  <th style={thStyle("cap_category")} onClick={() => handleSort("cap_category")}>Cap{sortArrow("cap_category")}</th>
                  <th style={thStyle("rs_nifty_3m_rank")} onClick={() => handleSort("rs_nifty_3m_rank")}>RS 3M{sortArrow("rs_nifty_3m_rank")}</th>
                  <th style={thStyle("rs_nifty_12m_rank")} onClick={() => handleSort("rs_nifty_12m_rank")}>RS 12M{sortArrow("rs_nifty_12m_rank")}</th>
                  <th style={thStyle("ret_3m")} onClick={() => handleSort("ret_3m")}>3M Ret{sortArrow("ret_3m")}</th>
                  <th style={thStyle("ret_12m")} onClick={() => handleSort("ret_12m")}>12M Ret{sortArrow("ret_12m")}</th>
                  <th style={thStyle("above_ema_50")} onClick={() => handleSort("above_ema_50")}>Above EMA-50{sortArrow("above_ema_50")}</th>
                  <th style={thStyle("state")} onClick={() => handleSort("state")}>State{sortArrow("state")}</th>
                  <th style={thStyle("action")} onClick={() => handleSort("action")}>Action{sortArrow("action")}</th>
                  <th style={thStyle("frag_score")} onClick={() => handleSort("frag_score")}>Frag{sortArrow("frag_score")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((stock) => (
                  <tr
                    key={stock.instrument_id}
                    style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onClick={() => router.push(`/unified/instrument/${stock.instrument_id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>{stock.name}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{stock.symbol}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{stock.sector ?? "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>{stock.cap_category ?? "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ fontWeight: 600, color: rsColor(stock.rs_nifty_3m_rank) }}>{stock.rs_nifty_3m_rank?.toFixed(1) ?? "—"}</div>
                      <div style={{ fontSize: "10px", color: rsColor(stock.rs_nifty_3m_rank) }}>{rsText(stock.rs_nifty_3m_rank)}</div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ fontWeight: 600, color: rsColor(stock.rs_nifty_12m_rank) }}>{stock.rs_nifty_12m_rank?.toFixed(1) ?? "—"}</div>
                      <div style={{ fontSize: "10px", color: rsColor(stock.rs_nifty_12m_rank) }}>{rsText(stock.rs_nifty_12m_rank)}</div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: (stock.ret_3m ?? 0) >= 0 ? "var(--rag-green-700)" : "var(--rag-red-700)" }}>
                      {stock.ret_3m !== null && stock.ret_3m !== undefined ? `${(stock.ret_3m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: (stock.ret_12m ?? 0) >= 0 ? "var(--rag-green-700)" : "var(--rag-red-700)" }}>
                      {stock.ret_12m !== null && stock.ret_12m !== undefined ? `${(stock.ret_12m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: stock.above_ema_50 ? "var(--rag-green-700)" : stock.above_ema_50 === false ? "var(--rag-red-700)" : "var(--text-secondary)" }}>
                      {stock.above_ema_50 === true ? "Yes" : stock.above_ema_50 === false ? "No" : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                        background: stock.state === "LEADER" ? "var(--rag-green-100)" : stock.state === "EMERGING" ? "var(--rag-amber-100)" : stock.state === "WEAKENING" ? "var(--rag-red-100)" : "var(--bg-inset)",
                        color: stock.state === "LEADER" ? "var(--rag-green-700)" : stock.state === "EMERGING" ? "var(--rag-amber-700)" : stock.state === "WEAKENING" ? "var(--rag-red-700)" : "var(--text-secondary)",
                      }}>
                        {stock.state ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: actionColor(stock.action) }}>
                      {stock.action ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: fragDisplay(stock.frag_score).color }}>
                      {fragDisplay(stock.frag_score).text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Page {page + 1} of {pageCount}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px",
                  cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                style={{
                  padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px",
                  cursor: page >= pageCount - 1 ? "not-allowed" : "pointer", opacity: page >= pageCount - 1 ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {!error && filteredRows.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>No weakening signals found.</div>
      )}
    </div>
  );
}
