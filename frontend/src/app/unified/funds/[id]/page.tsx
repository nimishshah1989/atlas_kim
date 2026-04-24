"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import NarrativePanel from "@/components/unified/NarrativePanel";
import FundRadarChart from "@/components/unified/FundRadarChart";
import SectorDonut from "@/components/unified/SectorDonut";
import CapTiltBar from "@/components/unified/CapTiltBar";
import type { FundXrayResponse, SnapshotResponse, HoldingRow } from "@/lib/api-unified";

type SortKey = "child_name" | "sector" | "weight_pct" | "state" | "action" | "rs_nifty_3m_rank" | "ret_3m" | "frag_score";
type SortDir = "asc" | "desc";

function formatAum(aum: number | null): string {
  if (aum === null || aum === undefined) return "—";
  return `₹${Math.round(aum).toLocaleString("en-IN")} Cr`;
}

function formatPct(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(2)}%`;
}

function actionColor(action: string | null): string {
  if (!action) return "var(--text-disabled)";
  const a = action.toUpperCase();
  if (a.includes("ACCUMULATE")) return "var(--rag-green-600)";
  if (a === "HOLD") return "var(--rag-amber-600)";
  if (a === "REDUCE") return "var(--rag-amber-700)";
  if (a === "EXIT") return "var(--rag-red-600)";
  return "var(--text-secondary)";
}

function FactorBar({ label, value }: { label: string; value: number | null }) {
  const pct = value !== null ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)" }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {value !== null ? `${pct.toFixed(0)}%` : "—"}
        </span>
      </div>
      <div style={{ height: "6px", background: "var(--bg-inset)", borderRadius: "3px", overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct >= 70 ? "var(--rag-green-500)" : pct >= 40 ? "var(--rag-amber-500)" : "var(--rag-red-500)",
            borderRadius: "3px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function FactorPercentilesCard({ fp }: { fp: FundXrayResponse["factor_percentiles"] | null }) {
  if (!fp) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%", justifyContent: "center" }}>
      <FactorBar label="Momentum" value={fp.factor_momentum_pct} />
      <FactorBar label="Quality" value={fp.factor_quality_pct} />
      <FactorBar label="Resilience" value={fp.factor_resilience_pct} />
      <FactorBar label="Holdings" value={fp.factor_holdings_pct} />
      <FactorBar label="Cost" value={fp.factor_cost_pct} />
      <FactorBar label="Consistency" value={fp.factor_consistency_pct} />
      {fp.rank_in_category !== null && fp.total_in_category !== null && (
        <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
          Rank in category: <strong>{fp.rank_in_category}</strong> of {fp.total_in_category}
        </div>
      )}
    </div>
  );
}

export default function FundXrayPage() {
  const params = useParams();
  const id = (params.id as string) ?? "";

  const { data: xray, state: xrayState, meta: xrayMeta } = useUnifiedData<FundXrayResponse>(
    id ? `/api/unified/funds/${id}/xray` : null
  );
  const { data: snapshot } = useUnifiedData<SnapshotResponse>(
    id ? `/api/unified/snapshot/${id}` : null
  );

  const [sortKey, setSortKey] = useState<SortKey>("weight_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (xrayState === "loading") {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading fund…</div>;
  }

  if (xrayState === "error" || !xray) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--rag-red-700)" }}>
        Failed to load fund. <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const inst = xray.instrument;
  const lt = xray.lookthrough;
  const fp = xray.factor_percentiles;
  const action = snapshot?.metrics?.action ?? "HOLD";

  const radarData = [
    { factor: "Momentum", fund: fp.factor_momentum_pct ?? 0, median: null },
    { factor: "Quality", fund: fp.factor_quality_pct ?? 0, median: null },
    { factor: "Resilience", fund: fp.factor_resilience_pct ?? 0, median: null },
    { factor: "Holdings", fund: fp.factor_holdings_pct ?? 0, median: null },
    { factor: "Cost", fund: fp.factor_cost_pct ?? 0, median: null },
    { factor: "Consistency", fund: fp.factor_consistency_pct ?? 0, median: null },
  ];

  // Build sector map for donut
  const sectorMap: Record<string, number> = {};
  lt?.dominant_sectors?.forEach((s) => {
    if (s.sector && s.weight_pct !== null) {
      sectorMap[s.sector] = s.weight_pct;
    }
  });

  // Sort holdings
  const holdings = [...(xray.holdings ?? [])];
  holdings.sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortHeader({ label, key: k }: { label: string; key: SortKey }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => toggleSort(k)}
        style={{
          textAlign: "left",
          padding: "8px 10px",
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          color: active ? "var(--accent-700)" : "var(--text-tertiary)",
          borderBottom: "1px solid var(--border-default)",
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {label} {active && (sortDir === "asc" ? "▲" : "▼")}
      </th>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Back link */}
      <div>
        <Link
          href="/unified/funds"
          style={{
            fontSize: "13px",
            color: "var(--accent-700)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Back to Funds
        </Link>
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>{inst.name}</h1>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {inst.mf_category}
            <span style={{ marginLeft: "8px" }}>· AUM: {formatAum(null)}</span>
            <span style={{ marginLeft: "8px" }}>· Expense: {formatPct(null)}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ActionBadge action={action} size="lg" />
          <DataFreshness dataAsOf={xrayMeta?.data_as_of ?? null} />
        </div>
      </div>

      {/* Row 1: Radar + Factor Percentiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-primary)", marginBottom: "8px" }}>
            Factor Profile
          </div>
          <FundRadarChart data={radarData} height={280} />
        </div>
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-primary)", marginBottom: "8px" }}>
            Factor Percentiles
          </div>
          <FactorPercentilesCard fp={fp} />
        </div>
      </div>

      {/* Row 2: Cap Tilt + Sector Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-primary)", marginBottom: "12px" }}>
            Market Cap Allocation
          </div>
          <CapTiltBar
            largePct={lt?.cap_large_pct ?? null}
            midPct={lt?.cap_mid_pct ?? null}
            smallPct={lt?.cap_small_pct ?? null}
            capTilt={lt?.cap_tilt ?? null}
          />
        </div>
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-primary)", marginBottom: "12px" }}>
            Sector Allocation
          </div>
          <SectorDonut sectors={sectorMap} height={240} />
        </div>
      </div>

      {/* Row 3: Holdings Table (full width) */}
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
        <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-primary)" }}>
          Holdings ({xray.holdings?.length ?? 0})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "var(--bg-surface-alt)" }}>
                <SortHeader label="Holding" key="child_name" />
                <SortHeader label="Sector" key="sector" />
                <SortHeader label="Weight" key="weight_pct" />
                <SortHeader label="State" key="state" />
                <SortHeader label="Action" key="action" />
                <SortHeader label="RS 3M" key="rs_nifty_3m_rank" />
                <SortHeader label="3M Ret" key="ret_3m" />
                <SortHeader label="Frag" key="frag_score" />
              </tr>
            </thead>
            <tbody>
              {holdings.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>
                    No holdings data available.
                  </td>
                </tr>
              )}
              {holdings.map((h: HoldingRow, i: number) => (
                <tr
                  key={`${h.child_id ?? i}-${i}`}
                  style={{ borderBottom: "1px solid var(--border-subtle)", cursor: h.child_id ? "pointer" : "default" }}
                  onClick={() => {
                    if (h.child_id) {
                      window.location.href = `/unified/instrument/${h.child_id}`;
                    }
                  }}
                >
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                    {h.child_name ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {h.sector ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontWeight: h.weight_pct !== null && h.weight_pct >= 5 ? 700 : 500,
                      color: "var(--text-primary)",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.weight_pct !== null ? `${h.weight_pct.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {h.state ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      color: actionColor(h.action),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.action ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color:
                        h.rs_nifty_3m_rank === null
                          ? "var(--text-disabled)"
                          : h.rs_nifty_3m_rank >= 60
                          ? "var(--rag-green-600)"
                          : h.rs_nifty_3m_rank >= 40
                          ? "var(--rag-amber-600)"
                          : "var(--rag-red-600)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.rs_nifty_3m_rank !== null ? h.rs_nifty_3m_rank.toFixed(0) : "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color:
                        h.ret_3m === null
                          ? "var(--text-disabled)"
                          : h.ret_3m >= 0
                          ? "var(--rag-green-600)"
                          : "var(--rag-red-600)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.ret_3m !== null ? `${h.ret_3m >= 0 ? "+" : ""}${(h.ret_3m * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.frag_score !== null ? h.frag_score.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Narrative Panel */}
      {snapshot?.narrative && (
        <NarrativePanel narrative={snapshot.narrative} title="Fund Narrative" />
      )}
    </div>
  );
}
