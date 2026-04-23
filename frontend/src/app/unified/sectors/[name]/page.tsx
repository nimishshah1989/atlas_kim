"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import EvidenceCard from "@/components/unified/EvidenceCard";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import { postApi } from "@/lib/api-unified";
import type { ScreenerResponse, ScreenerRow, MetricSnapshot } from "@/lib/api-unified";

function rowToMetrics(stock: ScreenerRow, dataAsOf: string | null): MetricSnapshot {
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

const LIMIT = 24;

export default function SectorDetailPage() {
  const params = useParams();
  const name = decodeURIComponent((params.name as string) ?? "");
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (currentOffset: number, append: boolean) => {
    if (currentOffset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const resp = await postApi<ScreenerResponse>("/api/unified/screen", {
        filters: [{ field: "sector", op: "eq", value: name }],
        sort_field: "rs_nifty_3m_rank",
        sort_direction: "desc",
        limit: LIMIT,
        offset: currentOffset,
      });
      setRows((prev) => (append ? [...prev, ...resp.rows] : resp.rows));
      setTotalCount(resp.total_count);
      setDataAsOf(resp.meta?.data_as_of ?? null);
    } catch {
      if (!append) setRows([]);
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [name]);

  useEffect(() => {
    setOffset(0);
    load(0, false);
  }, [name, load]);

  const handleLoadMore = useCallback(() => {
    const nextOffset = offset + LIMIT;
    setOffset(nextOffset);
    load(nextOffset, true);
  }, [offset, load]);

  const hasMore = rows.length < totalCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
            <Link href="/unified/sectors" style={{ color: "var(--accent-700)", textDecoration: "none" }}>Sectors</Link>
            <span style={{ margin: "0 6px", color: "var(--border-strong)" }}>/</span>
            {name}
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>{name}</h1>
        </div>
        <DataFreshness dataAsOf={dataAsOf} />
      </div>

      {!loading && rows.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Stocks ({rows.length} of {totalCount})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {rows.map((stock) => (
                <EvidenceCard
                  key={stock.instrument_id}
                  instrumentId={stock.instrument_id}
                  symbol={stock.symbol}
                  name={stock.name}
                  sector={stock.sector}
                  metrics={rowToMetrics(stock, dataAsOf)}
                  narrative={null}
                  dataAsOf={dataAsOf}
                />
              ))}
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

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>No stocks found in this sector.</div>
      )}

      {loading && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading sector…</div>
      )}
    </div>
  );
}
