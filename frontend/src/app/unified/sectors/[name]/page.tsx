"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useUnifiedData, useUnifiedDataPost } from "@/hooks/useUnifiedData";
import SubTabNav from "@/components/unified/SubTabNav";
import Sparkline from "@/components/unified/Sparkline";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type {
  AggregateResponse,
  ScreenerResponse,
  FundRankingsResponse,
  FundRankingRow,
} from "@/lib/api-unified";

const TABS = [
  { id: "stocks", label: "Stocks" },
  { id: "mutual-funds", label: "Mutual Funds" },
  { id: "etfs", label: "ETFs" },
];

function pctColor(val: number | null): string {
  if (val === null) return "var(--text-disabled)";
  if (val >= 0.05) return "var(--rag-green-700)";
  if (val <= -0.05) return "var(--rag-red-700)";
  return "var(--text-primary)";
}

function formatPct(val: number | null): string {
  if (val === null) return "—";
  return `${val >= 0 ? "+" : ""}${(val * 100).toFixed(1)}%`;
}

export default function SectorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent((params.name as string) ?? "");
  const [activeTab, setActiveTab] = useState("stocks");

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
    filters: [{ field: "sector", op: "eq", value: name }],
    sort_field: "rs_nifty_3m_rank",
    sort_direction: "desc",
    limit: 50,
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

  const mfRows = useMemo(() => {
    if (!rankingsData) return [];
    return rankingsData.rows.filter((r) => r.instrument_type === "MF");
  }, [rankingsData]);

  const etfRows = useMemo(() => {
    if (!rankingsData) return [];
    return rankingsData.rows.filter((r) => r.instrument_type === "ETF");
  }, [rankingsData]);

  const isStocksLoading = stocksState === "loading";
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
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>{name} Sector</h1>
        </div>
        <DataFreshness dataAsOf={aggMeta?.data_as_of ?? null} />
      </div>

      {/* Sector stats */}
      {sectorPoint && (
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
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Health Score</span>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                {sectorPoint.median_rs_rank?.toFixed(0) ?? "—"}
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    marginLeft: "8px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: (sectorPoint.pct_leader_state ?? 0) >= 50 ? "var(--rag-green-100)" : (sectorPoint.pct_leader_state ?? 0) >= 30 ? "var(--rag-amber-100)" : "var(--rag-red-100)",
                    color: (sectorPoint.pct_leader_state ?? 0) >= 50 ? "var(--rag-green-700)" : (sectorPoint.pct_leader_state ?? 0) >= 30 ? "var(--rag-amber-700)" : "var(--rag-red-700)",
                  }}
                >
                  {(sectorPoint.pct_leader_state ?? 0) >= 50 ? "HEALTHY" : (sectorPoint.pct_leader_state ?? 0) >= 30 ? "MIXED" : "WEAK"}
                </span>
              </div>
            </div>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Leaders</span>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                {sectorPoint.pct_leader_state?.toFixed(0) ?? "—"}%
              </div>
            </div>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Members</span>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                {sectorPoint.member_count}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>3M Ret</span>
              <div style={{ fontSize: "18px", fontWeight: 700, color: pctColor(sectorPoint.median_ret_3m), marginTop: "2px" }}>
                {formatPct(sectorPoint.median_ret_3m)}
              </div>
            </div>
          </div>
          {sectorPoint.consensus_action && (
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Consensus: <strong>{sectorPoint.consensus_action}</strong>
              {sectorPoint.action_confidence ? ` (${(sectorPoint.action_confidence * 100).toFixed(0)}% confidence)` : ""}
            </div>
          )}
        </div>
      )}

      {aggState === "loading" && !sectorPoint && (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading sector overview…</div>
      )}

      {/* Tabs */}
      <SubTabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Stocks Tab */}
      {activeTab === "stocks" && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600 }}>
            Stocks ({stocksData?.rows.length ?? 0} of {stocksData?.total_count ?? 0})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Name</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>RS 3M</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Return 3M</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>State</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>RSI</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Action</th>
                  <th style={{ padding: "10px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {stocksData?.rows.map((stock, idx) => (
                  <tr
                    key={stock.instrument_id}
                    style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onClick={() => router.push(`/unified/instrument/${stock.instrument_id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                      <div>{stock.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{stock.symbol}</div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {stock.rs_nifty_3m_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: pctColor(stock.ret_3m) }}>
                      {formatPct(stock.ret_3m)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background:
                            stock.state === "LEADER"
                              ? "var(--rag-green-100)"
                              : stock.state === "EMERGING"
                              ? "var(--rag-amber-100)"
                              : stock.state === "WEAKENING"
                              ? "var(--rag-red-100)"
                              : "var(--bg-inset)",
                          color:
                            stock.state === "LEADER"
                              ? "var(--rag-green-700)"
                              : stock.state === "EMERGING"
                              ? "var(--rag-amber-700)"
                              : stock.state === "WEAKENING"
                              ? "var(--rag-red-700)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {stock.state ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {stock.rsi_14?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <ActionBadge action={stock.action ?? "HOLD"} confidence={stock.action_confidence} size="sm" />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Sparkline
                        data={[
                          stock.rs_nifty_3m_rank ? stock.rs_nifty_3m_rank * 0.7 : 50,
                          stock.rs_nifty_3m_rank ? stock.rs_nifty_3m_rank * 0.8 : 55,
                          stock.rs_nifty_3m_rank ? stock.rs_nifty_3m_rank * 0.85 : 60,
                          stock.rs_nifty_3m_rank ?? 65,
                        ]}
                        width={60}
                        height={20}
                        color={stock.ret_3m && stock.ret_3m >= 0 ? "#16A34A" : "#DC2626"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isStocksLoading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading stocks…</div>
          )}
          {!isStocksLoading && (!stocksData || stocksData.rows.length === 0) && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>No stocks found in this sector.</div>
          )}
        </div>
      )}

      {/* Mutual Funds Tab */}
      {activeTab === "mutual-funds" && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600 }}>
            Mutual Funds ({mfRows.length})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Fund</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Category</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Lookthrough RS</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Action</th>
                  <th style={{ padding: "10px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {mfRows.map((fund: FundRankingRow, idx: number) => (
                  <tr
                    key={fund.instrument_id}
                    style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onClick={() => router.push(`/unified/funds/${fund.instrument_id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                      <div>{fund.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{fund.symbol}</div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{fund.mf_category}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {fund.lookthrough_rs_3m?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <ActionBadge action={fund.action ?? "HOLD"} confidence={null} size="sm" />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>→</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isFundsLoading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading funds…</div>
          )}
          {!isFundsLoading && mfRows.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>No mutual funds found.</div>
          )}
        </div>
      )}

      {/* ETFs Tab */}
      {activeTab === "etfs" && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600 }}>
            ETFs ({etfRows.length})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Fund</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Category</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Lookthrough RS</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Action</th>
                  <th style={{ padding: "10px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {etfRows.map((fund: FundRankingRow, idx: number) => (
                  <tr
                    key={fund.instrument_id}
                    style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onClick={() => router.push(`/unified/funds/${fund.instrument_id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                      <div>{fund.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{fund.symbol}</div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{fund.mf_category}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {fund.lookthrough_rs_3m?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <ActionBadge action={fund.action ?? "HOLD"} confidence={null} size="sm" />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>→</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isFundsLoading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading ETFs…</div>
          )}
          {!isFundsLoading && etfRows.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>No ETFs found.</div>
          )}
        </div>
      )}
    </div>
  );
}
