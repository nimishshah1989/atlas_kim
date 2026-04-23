"use client";

import { useUnifiedData } from "@/hooks/useUnifiedData";
import RegimeGauge from "@/components/unified/RegimeGauge";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import type { RegimeResponse, GlobalAggregateResponse } from "@/lib/api-unified";

export default function GlobalPulsePage() {
  const { data: regime, state: regimeState, meta: regimeMeta } = useUnifiedData<RegimeResponse>("/api/unified/global/regime");
  const { data: globalAgg, state: globalAggState } = useUnifiedData<GlobalAggregateResponse>("/api/unified/global/aggregate");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0, color: "var(--text-primary)" }}>
          Global Pulse
        </h1>
        <DataFreshness dataAsOf={regimeMeta?.data_as_of ?? null} />
      </div>

      {regimeState === "ready" && regime && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <RegimeGauge
            healthScore={regime.metrics.health_score ?? 0}
            healthZone={regime.metrics.health_zone ?? "NEUTRAL"}
            regime={regime.regime ?? ""}
          />
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
            <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>
              Global Direction
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-serif)" }}>
              {regime.direction ?? ""}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Regime: <strong>{regime.regime ?? "—"}</strong>
            </div>
          </div>
        </div>
      )}

      {regimeState === "loading" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>
          Loading global regime data…
        </div>
      )}

      {(globalAggState === "ready" || globalAggState === "stale") && globalAgg && globalAgg.points.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
            Global Markets
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Country</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Instruments</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>RS S&P 500</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>RS MSCI</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>3M Ret</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>12M Ret</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {globalAgg.points.map((pt) => (
                  <tr key={pt.country} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{pt.country}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {pt.instrument_count}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {pt.median_rs_sp500_3m?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {pt.median_rs_msci_3m?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {pt.median_ret_3m ? `${(pt.median_ret_3m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {pt.median_ret_12m ? `${(pt.median_ret_12m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <ActionBadge action={pt.bubble_color ?? "HOLD"} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {globalAggState === "loading" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>
          Loading global markets…
        </div>
      )}

      {globalAggState === "empty" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>No global data available.</div>
      )}

      {globalAggState === "error" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--rag-red-700)" }}>
          Failed to load global data. <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
    </div>
  );
}
