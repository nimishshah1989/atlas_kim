"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import NarrativePanel from "@/components/unified/NarrativePanel";
import FundRadarChart from "@/components/unified/FundRadarChart";
import HoldingsTable from "@/components/unified/HoldingsTable";
import SectorDonut from "@/components/unified/SectorDonut";
import CapTiltBar from "@/components/unified/CapTiltBar";
import type {
  FundXrayResponse,
  FundHoldingsResponse,
  SnapshotResponse,
} from "@/lib/api-unified";

function formatAum(aum: number | null): string {
  if (aum === null || aum === undefined) return "—";
  return `₹${Math.round(aum).toLocaleString("en-IN")} Cr`;
}

function formatPct(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(2)}%`;
}

export default function FundXrayPage() {
  const params = useParams();
  const id = (params.id as string) ?? "";

  const { data: xray, state: xrayState, meta: xrayMeta } = useUnifiedData<FundXrayResponse>(
    id ? `/api/unified/funds/${id}/xray` : null
  );
  const { data: holdingsData, state: holdingsState } = useUnifiedData<FundHoldingsResponse>(
    id ? `/api/unified/funds/${id}/holdings` : null
  );
  const { data: snapshot } = useUnifiedData<SnapshotResponse>(
    id ? `/api/unified/snapshot/${id}` : null
  );

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

  const topSector = lt?.dominant_sectors && lt.dominant_sectors.length > 0
    ? lt.dominant_sectors.sort((a, b) => (b.weight_pct ?? 0) - (a.weight_pct ?? 0))[0]?.sector ?? "—"
    : "—";

  // Build sector map for donut: { [sector]: weight_pct }
  const sectorMap: Record<string, number> = {};
  lt?.dominant_sectors?.forEach((s) => {
    if (s.sector && s.weight_pct !== null) {
      sectorMap[s.sector] = s.weight_pct;
    }
  });

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
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>
            {inst.name}
          </h1>
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

      {/* Radar Chart */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "20px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "12px",
          }}
        >
          Factor Profile
        </div>
        <FundRadarChart data={radarData} height={320} />
      </div>

      {/* Evidence Card */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Key Metrics</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1px",
            background: "var(--border-subtle)",
            border: "1px solid var(--border-default)",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <MetricBox label="Lookthrough RS 3M" value={lt?.lookthrough_rs_3m?.toFixed(1) ?? null} />
          <MetricBox label="Lookthrough RS 12M" value={lt?.lookthrough_rs_12m?.toFixed(1) ?? null} />
          <MetricBox label="Leaders %" value={lt?.pct_holdings_leader !== null ? `${lt.pct_holdings_leader.toFixed(1)}%` : null} />
          <MetricBox label="Emerging %" value={lt?.pct_holdings_emerging !== null ? `${lt.pct_holdings_emerging.toFixed(1)}%` : null} />
          <MetricBox label="Top Sector" value={topSector} />
          <MetricBox label="Top 10 Conc." value={lt?.top10_concentration !== null ? `${lt.top10_concentration.toFixed(1)}%` : null} />
          <MetricBox label="Sector HHI" value={lt?.sector_herfindahl?.toFixed(2) ?? null} />
          <MetricBox label="Expense Ratio" value={formatPct(null)} />
        </div>
      </div>

      {/* Cap Tilt Bar */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "20px",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
          Market Cap Allocation
        </div>
        <CapTiltBar
          largePct={lt?.cap_large_pct ?? null}
          midPct={lt?.cap_mid_pct ?? null}
          smallPct={lt?.cap_small_pct ?? null}
          capTilt={lt?.cap_tilt ?? null}
        />
      </div>

      {/* Sector Allocation */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "20px",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
          Sector Allocation
        </div>
        <SectorDonut sectors={sectorMap} height={280} />
      </div>

      {/* Holdings Table */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
          Top Holdings
        </div>
        {holdingsState === "loading" && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading holdings…</div>
        )}
        {holdingsState === "error" && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--rag-red-700)" }}>Failed to load holdings.</div>
        )}
        {holdingsData?.holdings && holdingsData.holdings.length > 0 && (
          <HoldingsTable holdings={holdingsData.holdings} maxRows={20} />
        )}
        {holdingsData?.holdings && holdingsData.holdings.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>No holdings data available.</div>
        )}
      </div>

      {/* Narrative Panel */}
      {snapshot?.narrative && (
        <NarrativePanel narrative={snapshot.narrative} title="Fund Narrative" />
      )}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number | null }) {
  const display = value === null || value === undefined ? "—" : String(value);
  return (
    <div style={{ background: "var(--bg-surface)", padding: "10px 12px" }}>
      <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 500, marginBottom: "3px" }}>{label}</div>
      <div style={{ fontSize: "15px", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)", lineHeight: 1.2 }}>
        {display}
      </div>
    </div>
  );
}
