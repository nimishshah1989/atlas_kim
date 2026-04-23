"use client";

import { useParams } from "next/navigation";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import EvidenceCard from "@/components/unified/EvidenceCard";
import RSScorecard from "@/components/unified/RSScorecard";
import NarrativePanel from "@/components/unified/NarrativePanel";
import DataFreshness from "@/components/unified/DataFreshness";
import ActionBadge from "@/components/unified/ActionBadge";
import Link from "next/link";
import type {
  SnapshotResponse,
  FundXrayResponse,
  FactorPercentiles,
  LookthroughSummary,
} from "@/lib/api-unified";

function isEquityLike(type: string | null): boolean {
  if (!type) return true;
  return ["EQUITY", "INDEX", "INDEX_GLOBAL"].includes(type);
}

function isFundLike(type: string | null): boolean {
  if (!type) return false;
  return ["MF", "ETF"].includes(type);
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
      <div
        style={{
          height: "6px",
          background: "var(--bg-inset)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
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

function FundFactorCard({ factors }: { factors: FactorPercentiles | null }) {
  if (!factors) return null;
  return (
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
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>Factor Percentiles</div>
      <FactorBar label="Momentum" value={factors.factor_momentum_pct} />
      <FactorBar label="Quality" value={factors.factor_quality_pct} />
      <FactorBar label="Resilience" value={factors.factor_resilience_pct} />
      <FactorBar label="Holdings" value={factors.factor_holdings_pct} />
      <FactorBar label="Cost" value={factors.factor_cost_pct} />
      <FactorBar label="Consistency" value={factors.factor_consistency_pct} />
      {factors.rank_in_category !== null && factors.total_in_category !== null && (
        <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
          Rank in category: <strong>{factors.rank_in_category}</strong> of {factors.total_in_category}
        </div>
      )}
    </div>
  );
}

function LookthroughCard({ lt }: { lt: LookthroughSummary | null }) {
  if (!lt) return null;
  return (
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
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>Lookthrough</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
        <MetricItem label="Lookthrough RS 3M" value={lt.lookthrough_rs_3m?.toFixed(1) ?? "—"} />
        <MetricItem label="Lookthrough RS 12M" value={lt.lookthrough_rs_12m?.toFixed(1) ?? "—"} />
        <MetricItem label="Leaders %" value={lt.pct_holdings_leader !== null ? `${(lt.pct_holdings_leader * 100).toFixed(1)}%` : "—"} />
        <MetricItem label="Emerging %" value={lt.pct_holdings_emerging !== null ? `${(lt.pct_holdings_emerging * 100).toFixed(1)}%` : "—"} />
        <MetricItem label="Broken %" value={lt.pct_holdings_broken !== null ? `${(lt.pct_holdings_broken * 100).toFixed(1)}%` : "—"} />
        <MetricItem label="Top Sector" value={lt.top_sector ?? "—"} />
        <MetricItem label="Holdings" value={lt.num_holdings?.toString() ?? "—"} />
        <MetricItem label="Top 10 Conc." value={lt.top10_concentration !== null ? `${(lt.top10_concentration * 100).toFixed(1)}%` : "—"} />
        <MetricItem label="Cap Tilt" value={lt.cap_tilt ?? "—"} />
      </div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 500, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

export default function InstrumentPage() {
  const params = useParams();
  const id = (params.id as string) ?? "";
  const { data, state, meta } = useUnifiedData<SnapshotResponse>(`/api/unified/snapshot/${id}`);
  const { data: xray, state: xrayState } = useUnifiedData<FundXrayResponse>(
    data && isFundLike(data.instrument.instrument_type) ? `/api/unified/funds/${id}/xray` : null
  );

  if (state === "loading") {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading instrument…</div>;
  }

  if (state === "error" || !data) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--rag-red-700)" }}>Failed to load instrument.</div>;
  }

  const instrumentType = data.instrument.instrument_type;
  const isFund = isFundLike(instrumentType);

  if (isFund) {
    const fundFactors = xray?.factor_percentiles ?? data.factor_percentiles ?? null;
    const fundLookthrough = xray?.lookthrough ?? data.lookthrough ?? null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              <Link href="/unified" style={{ color: "var(--accent-700)", textDecoration: "none" }}>Dashboard</Link>
              <span style={{ margin: "0 6px", color: "var(--border-strong)" }}>/</span>
              {data.instrument.symbol}
              <span
                style={{
                  marginLeft: "8px",
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "var(--bg-inset)",
                  color: "var(--text-secondary)",
                }}
              >
                {instrumentType}
              </span>
            </div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>{data.instrument.name}</h1>
          </div>
          <DataFreshness dataAsOf={meta?.data_as_of ?? null} />
        </div>

        {/* Fund Header */}
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
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {data.instrument.mf_category ?? "—"}
                {data.instrument.sector ? ` · ${data.instrument.sector}` : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <ActionBadge action={data.metrics.action ?? "HOLD"} confidence={data.metrics.action_confidence} size="lg" />
              </div>
            </div>
            <Link
              href={`/unified/funds/${id}`}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--accent-700)",
                textDecoration: "none",
                padding: "6px 12px",
                border: "1px solid var(--accent-700)",
                borderRadius: "6px",
              }}
            >
              View Full X-Ray →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "12px" }}>
            <MetricItem label="Category" value={data.instrument.mf_category ?? "—"} />
            <MetricItem label="Cap Tilt" value={fundLookthrough?.cap_tilt ?? "—"} />
            <MetricItem label="Lookthrough RS 3M" value={fundLookthrough?.lookthrough_rs_3m?.toFixed(1) ?? "—"} />
            <MetricItem label="Holdings" value={fundLookthrough?.num_holdings?.toString() ?? "—"} />
          </div>
        </div>

        {/* Factor Percentiles */}
        <FundFactorCard factors={fundFactors} />

        {/* Lookthrough */}
        <LookthroughCard lt={fundLookthrough} />

        {/* Narrative */}
        {data.narrative && <NarrativePanel narrative={data.narrative} title="Engine Narrative" />}

        {xrayState === "loading" && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading x-ray data…</div>
        )}
      </div>
    );
  }

  // EQUITY / INDEX / INDEX_GLOBAL
  const m = data.metrics;
  const scores = [
    { benchmark: "NIFTY_50", period: "1w", value: m.rs_nifty_1w_rank },
    { benchmark: "NIFTY_50", period: "1m", value: m.rs_nifty_1m_rank },
    { benchmark: "NIFTY_50", period: "3m", value: m.rs_nifty_3m_rank },
    { benchmark: "NIFTY_50", period: "6m", value: m.rs_nifty_6m_rank },
    { benchmark: "NIFTY_50", period: "12m", value: m.rs_nifty_12m_rank },
    { benchmark: "NIFTY_500", period: "3m", value: m.rs_nifty500_3m_rank },
    { benchmark: "NIFTY_500", period: "12m", value: m.rs_nifty500_12m_rank },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
            <Link href="/unified" style={{ color: "var(--accent-700)", textDecoration: "none" }}>Dashboard</Link>
            <span style={{ margin: "0 6px", color: "var(--border-strong)" }}>/</span>
            {data.instrument.symbol}
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>{data.instrument.name}</h1>
        </div>
        <DataFreshness dataAsOf={meta?.data_as_of ?? null} />
      </div>

      <EvidenceCard
        instrumentId={data.instrument.instrument_id}
        symbol={data.instrument.symbol}
        name={data.instrument.name}
        sector={data.instrument.sector}
        metrics={m}
        narrative={data.narrative}
        dataAsOf={meta?.data_as_of ?? null}
      />

      <RSScorecard scores={scores} />

      {data.narrative && <NarrativePanel narrative={data.narrative} title="Engine Narrative" />}
    </div>
  );
}
