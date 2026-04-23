"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import EvidenceCard from "@/components/unified/EvidenceCard";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type { ScreenerResponse, ScreenerRow, MetricSnapshot } from "@/lib/api-unified";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function postSectorScreen(sector: string): Promise<ScreenerResponse> {
  const res = await fetch(`${API_BASE}/api/unified/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: [{ field: "sector", op: "eq", value: sector }],
      sort_field: "rs_nifty_3m_rank",
      sort_direction: "desc",
      limit: 100,
      offset: 0,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function SectorDetailPage() {
  const params = useParams();
  const name = decodeURIComponent((params.name as string) ?? "");
  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const resp = await postSectorScreen(name);
        if (!cancelled) setData(resp);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [name]);

  const rows = data?.rows ?? [];
  const dataAsOf = data?.meta?.data_as_of ?? null;

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
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Stocks ({rows.length})</div>
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
      )}

      {!loading && rows.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>No stocks found in this sector.</div>
      )}

      {loading && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading sector…</div>
      )}
    </div>
  );
}

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
