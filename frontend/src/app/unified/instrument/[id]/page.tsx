"use client";

import { useParams } from "next/navigation";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import EvidenceCard from "@/components/unified/EvidenceCard";
import RSScorecard from "@/components/unified/RSScorecard";
import NarrativePanel from "@/components/unified/NarrativePanel";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type { SnapshotResponse } from "@/lib/api-unified";

export default function InstrumentPage() {
  const params = useParams();
  const id = (params.id as string) ?? "";
  const { data, state, meta } = useUnifiedData<SnapshotResponse>(`/api/unified/snapshot/${id}`);

  if (state === "loading") {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading instrument…</div>;
  }

  if (state === "error" || !data) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--rag-red-700)" }}>Failed to load instrument.</div>;
  }

  const m = data.metrics;
  const scores = [
    { benchmark: "NIFTY_50", period: "1w", value: m.rs_nifty_1w_rank },
    { benchmark: "NIFTY_50", period: "1m", value: m.rs_nifty_1m_rank },
    { benchmark: "NIFTY_50", period: "3m", value: m.rs_nifty_3m_rank },
    { benchmark: "NIFTY_50", period: "6m", value: m.rs_nifty_6m_rank },
    { benchmark: "NIFTY_50", period: "12m", value: m.rs_nifty_12m_rank },
    { benchmark: "NIFTY_500", period: "1w", value: m.rs_nifty500_3m_rank },
    { benchmark: "NIFTY_500", period: "1m", value: m.rs_nifty500_3m_rank },
    { benchmark: "NIFTY_500", period: "3m", value: m.rs_nifty500_3m_rank },
    { benchmark: "NIFTY_500", period: "6m", value: m.rs_nifty500_12m_rank },
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
