"use client";

import { useEffect, useState, useCallback } from "react";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import { postApi } from "@/lib/api-unified";
import type { ScreenerResponse, ScreenerRow } from "@/lib/api-unified";

const LIMIT = 50;

const CATEGORY_OPTIONS = [
  "All",
  "Equity",
  "Debt",
  "Hybrid",
  "Index",
  "Solution Oriented",
  "Other",
];

export default function FundsPage() {
  const [funds, setFunds] = useState<ScreenerRow[]>([]);
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState("All");

  const load = useCallback(async (currentOffset: number, append: boolean, selectedCategory: string) => {
    if (currentOffset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const filters: { field: string; op: string; value: unknown }[] = [
        { field: "instrument_type", op: "eq", value: "MF" },
      ];
      if (selectedCategory !== "All") {
        filters.push({ field: "mf_category", op: "eq", value: selectedCategory });
      }
      const resp = await postApi<ScreenerResponse>("/api/unified/screen", {
        filters,
        sort_field: "rs_nifty_3m_rank",
        sort_direction: "desc",
        limit: LIMIT,
        offset: currentOffset,
      });
      setFunds((prev) => (append ? [...prev, ...resp.rows] : resp.rows));
      setTotalCount(resp.total_count);
      setDataAsOf(resp.meta?.data_as_of ?? null);
    } catch {
      if (!append) setFunds([]);
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    load(0, false, category);
  }, [category, load]);

  const handleLoadMore = useCallback(() => {
    const nextOffset = offset + LIMIT;
    setOffset(nextOffset);
    load(nextOffset, true, category);
  }, [offset, load, category]);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading funds…</div>;
  }

  const hasMore = funds.length < totalCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>Funds</h1>
        <DataFreshness dataAsOf={dataAsOf} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Category:</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
            fontSize: "13px",
            color: "var(--text-primary)",
          }}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {funds.length > 0 && (
        <>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600 }}>
              Mutual Fund Rankings ({funds.length} of {totalCount})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface-alt)" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Name</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Category</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>RS 3M</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>3M Ret</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Action</th>
                    <th style={{ padding: "10px 12px" }} />
                  </tr>
                </thead>
                <tbody>
                  {funds.map((f) => (
                    <tr key={f.instrument_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>{f.name}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{f.mf_category}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        {f.rs_nifty_3m_rank?.toFixed(1) ?? "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        {f.ret_3m ? `${(f.ret_3m * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <ActionBadge action={f.action ?? "HOLD"} confidence={f.action_confidence} size="sm" />
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <Link href={`/unified/funds/${f.instrument_id}`} style={{ fontSize: "11px", color: "var(--text-tertiary)", textDecoration: "none" }}>
                          X-Ray →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {hasMore && (
            <div style={{ textAlign: "center", padding: "16px" }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  cursor: loadingMore ? "not-allowed" : "pointer",
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--rag-red-700)" }}>
          Failed to load data. <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!error && funds.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>No funds found.</div>
      )}
    </div>
  );
}
