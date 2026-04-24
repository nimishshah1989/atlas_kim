"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import EvidenceCard from "@/components/unified/EvidenceCard";
import RSScorecard from "@/components/unified/RSScorecard";
import NarrativePanel from "@/components/unified/NarrativePanel";
import DataFreshness from "@/components/unified/DataFreshness";
import ActionBadge from "@/components/unified/ActionBadge";
import type {
  SnapshotResponse,
  FundXrayResponse,
  FactorPercentiles,
  LookthroughSummary,
  MetricSnapshot,
} from "@/lib/api-unified";

function isEquityLike(type: string | null): boolean {
  if (!type) return true;
  return ["EQUITY", "INDEX", "INDEX_GLOBAL"].includes(type);
}

function isFundLike(type: string | null): boolean {
  if (!type) return false;
  return ["MF", "ETF"].includes(type);
}

function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(digits);
}

function boolColor(val: boolean | null): string {
  if (val === null) return "var(--text-disabled)";
  return val ? "var(--rag-green-600)" : "var(--rag-red-600)";
}

function fragColor(level: string | null): string {
  if (!level) return "var(--text-disabled)";
  const l = level.toUpperCase();
  if (l === "LOW") return "var(--rag-green-600)";
  if (l === "MEDIUM") return "var(--rag-amber-600)";
  if (l === "HIGH") return "var(--rag-red-600)";
  if (l === "CRITICAL") return "var(--rag-red-800)";
  return "var(--text-secondary)";
}

function rsiColor(rsi: number | null): string {
  if (rsi === null) return "var(--text-disabled)";
  if (rsi >= 60) return "var(--rag-green-600)";
  if (rsi <= 30) return "var(--rag-red-600)";
  return "var(--text-primary)";
}

function macdStatus(metrics: MetricSnapshot): { text: string; color: string } {
  if (metrics.macd === null || metrics.macd_signal === null) return { text: "—", color: "var(--text-disabled)" };
  const diff = metrics.macd - metrics.macd_signal;
  if (diff > 0) return { text: "Bullish", color: "var(--rag-green-600)" };
  if (diff < 0) return { text: "Bearish", color: "var(--rag-red-600)" };
  return { text: "Neutral", color: "var(--text-secondary)" };
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
      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        Factor Percentiles
      </div>
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
      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        Lookthrough Summary
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
        <MetricItem label="Cap Tilt" value={lt.cap_tilt ?? "—"} />
        <MetricItem label="Lookthrough RS 3M" value={lt.lookthrough_rs_3m?.toFixed(1) ?? "—"} />
        <MetricItem label="Leaders %" value={lt.pct_holdings_leader !== null ? `${(lt.pct_holdings_leader * 100).toFixed(1)}%` : "—"} />
        <MetricItem label="Holdings" value={lt.num_holdings?.toString() ?? "—"} />
        <MetricItem label="Top Sector" value={lt.top_sector ?? "—"} />
        <MetricItem label="Top 10 Conc." value={lt.top10_concentration !== null ? `${(lt.top10_concentration * 100).toFixed(1)}%` : "—"} />
      </div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 500, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function TechnicalSnapshot({ metrics }: { metrics: MetricSnapshot }) {
  const macd = macdStatus(metrics);
  const pct52w = (metrics as unknown as Record<string, number | null>).pct_from_52w_high;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "12px" }}>
        Technical Snapshot
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <TechRow label="RSI-14" value={fmtNum(metrics.rsi_14, 1)} color={rsiColor(metrics.rsi_14)} />
          <TechRow label="EMA-20" value={metrics.above_ema_20 === null ? "—" : metrics.above_ema_20 ? "Above" : "Below"} color={boolColor(metrics.above_ema_20)} />
          <TechRow label="EMA-50" value={metrics.above_ema_50 === null ? "—" : metrics.above_ema_50 ? "Above" : "Below"} color={boolColor(metrics.above_ema_50)} />
          <TechRow label="EMA-200" value={metrics.above_ema_200 === null ? "—" : metrics.above_ema_200 ? "Above" : "Below"} color={boolColor(metrics.above_ema_200)} />
          <TechRow label="MACD" value={macd.text} color={macd.color} />
        </div>
        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <TechRow label="% from 52W High" value={pct52w !== undefined && pct52w !== null ? fmtNum(pct52w, 1) + "%" : "—"} color={pct52w !== undefined && pct52w !== null && pct52w >= 0 ? "var(--rag-green-600)" : "var(--text-primary)"} />
          <TechRow label="Volatility (21d)" value={metrics.vol_21d !== null ? `${(metrics.vol_21d * 100).toFixed(1)}%` : "—"} />
          <TechRow label="Golden Cross" value={metrics.golden_cross === null ? "—" : metrics.golden_cross ? "Yes" : "No"} color={boolColor(metrics.golden_cross)} />
          <TechRow label="Fragility" value={metrics.frag_level ?? "—"} color={fragColor(metrics.frag_level)} />
          <TechRow label="Max Drawdown (252d)" value={metrics.max_dd_252d !== null ? fmtPct(metrics.max_dd_252d) : "—"} color={metrics.max_dd_252d !== null && metrics.max_dd_252d < 0 ? "var(--rag-red-600)" : "var(--text-primary)"} />
        </div>
      </div>
    </div>
  );
}

function TechRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
      <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>{label}</span>
      <span style={{ color: color ?? "var(--text-primary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Row */}
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
                fontWeight: 700,
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

      {isFund ? (
        <>
          {/* Section A: Fund Header */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              padding: "16px 20px",
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
          </div>

          {/* Section B: Factor Percentiles */}
          <FundFactorCard factors={xray?.factor_percentiles ?? data.factor_percentiles ?? null} />

          {/* Section C: Lookthrough Summary */}
          <LookthroughCard lt={xray?.lookthrough ?? data.lookthrough ?? null} />

          {/* Section D: Narrative */}
          {data.narrative && <NarrativePanel narrative={data.narrative} title="Engine Narrative" />}

          {xrayState === "loading" && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading x-ray data…</div>
          )}
        </>
      ) : (
        <>
          {/* Section A: Evidence Card (full width) */}
          <EvidenceCard
            instrumentId={data.instrument.instrument_id}
            symbol={data.instrument.symbol}
            name={data.instrument.name}
            sector={data.instrument.sector}
            metrics={data.metrics}
            narrative={data.narrative}
            dataAsOf={meta?.data_as_of ?? null}
            compact={false}
          />

          {/* Section B: RS Scorecard (full width) */}
          <RSScorecard metrics={data.metrics} />

          {/* Section C: Technical Snapshot Grid (2 columns) */}
          <TechnicalSnapshot metrics={data.metrics} />

          {/* Section D: Narrative Panel (full width) */}
          {data.narrative && <NarrativePanel narrative={data.narrative} title="Engine Narrative" />}
        </>
      )}
    </div>
  );
}
