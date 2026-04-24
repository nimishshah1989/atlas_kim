"use client";

import { useState, useMemo } from "react";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import RegimeGauge from "@/components/unified/RegimeGauge";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import type { RegimeResponse, GlobalAggregateResponse, GlobalAggregatePoint } from "@/lib/api-unified";

const FLAG_MAP: Record<string, string> = {
  US: "\ud83c\uddfa\ud83c\uddf8", CN: "\ud83c\udde8\ud83c\uddf3", JP: "\ud83c\uddef\ud83c\uddf5", DE: "\ud83c\udde9\ud83c\uddea", GB: "\ud83c\uddec\ud83c\udde7", UK: "\ud83c\uddec\ud83c\udde7", FR: "\ud83c\uddeb\ud83c\uddf7",
  IN: "\ud83c\uddee\ud83c\uddf3", BR: "\ud83c\udde7\ud83c\uddf7", CA: "\ud83c\udde8\ud83c\udde6", AU: "\ud83c\udde6\ud83c\uddfa", KR: "\ud83c\uddf0\ud83c\uddf7", MX: "\ud83c\uddf2\ud83c\uddfd", ES: "\ud83c\uddea\ud83c\uddf8",
  IT: "\ud83c\uddee\ud83c\uddf9", NL: "\ud83c\uddf3\ud83c\uddf1", CH: "\ud83c\udde8\ud83c\udded", SE: "\ud83c\uddf8\ud83c\uddea", NO: "\ud83c\uddf3\ud83c\uddf4", FI: "\ud83c\uddeb\ud83c\uddee", DK: "\ud83c\udde9\ud83c\uddf0",
  AT: "\ud83c\udde6\ud83c\uddf9", BE: "\ud83c\udde7\ud83c\uddea", IE: "\ud83c\uddee\ud83c\uddea", PT: "\ud83c\uddf5\ud83c\uddf9", GR: "\ud83c\uddec\ud83c\uddf7", PL: "\ud83c\uddf5\ud83c\uddf1", CZ: "\ud83c\udde8\ud83c\uddff",
  HU: "\ud83c\udded\ud83c\uddfa", TR: "\ud83c\uddf9\ud83c\uddf7", RU: "\ud83c\uddf7\ud83c\uddfa", SA: "\ud83c\uddf8\ud83c\udde6", AE: "\ud83c\udde6\ud83c\uddea", QA: "\ud83c\uddf6\ud83c\udde6", IL: "\ud83c\uddee\ud83c\uddf1",
  ZA: "\ud83c\uddff\ud83c\udde6", EG: "\ud83c\uddea\ud83c\uddec", NG: "\ud83c\uddf3\ud83c\uddec", ID: "\ud83c\uddee\ud83c\udde9", MY: "\ud83c\uddf2\ud83c\uddfe", PH: "\ud83c\uddf5\ud83c\udded", TH: "\ud83c\uddf9\ud83c\udded",
  VN: "\ud83c\uddfb\ud83c\uddf3", SG: "\ud83c\uddf8\ud83c\uddec", TW: "\ud83c\uddf9\ud83c\uddfc", HK: "\ud83c\udded\ud83c\uddf0", PK: "\ud83c\uddf5\ud83c\uddf0", CL: "\ud83c\udde8\ud83c\uddf1", PE: "\ud83c\uddf5\ud83c\uddea",
  AR: "\ud83c\udde6\ud83c\uddf7", CO: "\ud83c\udde8\ud83c\uddf4", GLOBAL: "🌐", EM: "🌍", FM: "🌏", APAC: "🌏", INTL: "🌐",
};

function getFlag(country: string): string {
  return FLAG_MAP[country] || "🌍";
}

function getFullName(country: string): string {
  const names: Record<string, string> = {
    US: "United States", CN: "China", JP: "Japan", DE: "Germany", GB: "United Kingdom", UK: "United Kingdom", FR: "France",
    IN: "India", BR: "Brazil", CA: "Canada", AU: "Australia", KR: "South Korea", MX: "Mexico", ES: "Spain",
    IT: "Italy", NL: "Netherlands", CH: "Switzerland", SE: "Sweden", NO: "Norway", FI: "Finland", DK: "Denmark",
    AT: "Austria", BE: "Belgium", IE: "Ireland", PT: "Portugal", GR: "Greece", PL: "Poland", CZ: "Czech Republic",
    HU: "Hungary", TR: "Turkey", RU: "Russia", SA: "Saudi Arabia", AE: "UAE", QA: "Qatar", IL: "Israel",
    ZA: "South Africa", EG: "Egypt", NG: "Nigeria", ID: "Indonesia", MY: "Malaysia", PH: "Philippines", TH: "Thailand",
    VN: "Vietnam", SG: "Singapore", TW: "Taiwan", HK: "Hong Kong", PK: "Pakistan", CL: "Chile", PE: "Peru",
    AR: "Argentina", CO: "Colombia", GLOBAL: "Global", EM: "Emerging Markets", FM: "Frontier Markets", APAC: "Asia Pacific", INTL: "International",
  };
  return names[country] || country;
}

function colorForRet(val: number | null): string {
  if (val === null) return "var(--text-secondary)";
  return val >= 0 ? "var(--rag-green-500)" : "var(--rag-red-500)";
}

function colorForRS(val: number | null): string {
  if (val === null) return "var(--text-secondary)";
  if (val >= 70) return "var(--rag-green-500)";
  if (val >= 40) return "var(--text-primary)";
  return "var(--rag-red-500)";
}

/* ---------- Mini Bubble Chart (SVG) ---------- */
function GlobalBubbleChart({ data }: { data: GlobalAggregatePoint[] }) {
  const width = 800;
  const height = 420;
  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xVals = data.map((d) => d.median_rs_sp500_3m ?? 0);
  const yVals = data.map((d) => (d.median_ret_3m ?? 0) * 100);
  const xMin = Math.min(...xVals, 0);
  const xMax = Math.max(...xVals, 100);
  const yMin = Math.min(...yVals, -30);
  const yMax = Math.max(...yVals, 30);

  const sx = (v: number) => pad.left + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const sy = (v: number) => pad.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const sizes = data.map((d) => d.instrument_count ?? 1);
  const maxSize = Math.max(...sizes, 1);
  const radius = (count: number) => 6 + (count / maxSize) * 28;

  const actionColor: Record<string, string> = {
    STRONG_ACCUMULATE: "#16a34a",
    ACCUMULATE: "#22c55e",
    HOLD: "#f59e0b",
    REDUCE: "#f97316",
    EXIT: "#ef4444",
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", maxHeight: 460 }}>
      {/* Quadrant backgrounds */}
      <rect x={pad.left} y={pad.top} width={plotW / 2} height={plotH / 2} fill="rgba(239,68,68,0.04)" />
      <rect x={pad.left + plotW / 2} y={pad.top} width={plotW / 2} height={plotH / 2} fill="rgba(34,197,94,0.04)" />
      <rect x={pad.left} y={pad.top + plotH / 2} width={plotW / 2} height={plotH / 2} fill="rgba(249,115,22,0.04)" />
      <rect x={pad.left + plotW / 2} y={pad.top + plotH / 2} width={plotW / 2} height={plotH / 2} fill="rgba(234,179,8,0.04)" />

      {/* Axes */}
      <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="var(--border-default)" strokeWidth={1} />
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="var(--border-default)" strokeWidth={1} />
      {/* Zero lines */}
      <line x1={sx(0)} y1={pad.top} x2={sx(0)} y2={pad.top + plotH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="4 4" />
      <line x1={pad.left} y1={sy(0)} x2={pad.left + plotW} y2={sy(0)} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="4 4" />

      {/* Quadrant labels */}
      <text x={pad.left + plotW * 0.25} y={pad.top + 14} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">Lagging</text>
      <text x={pad.left + plotW * 0.75} y={pad.top + 14} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">Leading</text>
      <text x={pad.left + plotW * 0.25} y={pad.top + plotH - 6} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">Improving</text>
      <text x={pad.left + plotW * 0.75} y={pad.top + plotH - 6} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">Weakening</text>

      {/* Axis labels */}
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">RS vs S&amp;P 500 (rank)</text>
      <text x={14} y={pad.top + plotH / 2} textAnchor="middle" fontSize={11} fill="var(--text-secondary)" transform={`rotate(-90, 14, ${pad.top + plotH / 2})`}>3M Return (%)</text>

      {/* Bubbles */}
      {data.map((d) => {
        const cx = sx(d.median_rs_sp500_3m ?? 0);
        const cy = sy((d.median_ret_3m ?? 0) * 100);
        const r = radius(d.instrument_count ?? 1);
        const color = actionColor[d.bubble_color ?? "HOLD"] || "var(--text-tertiary)";
        return (
          <g key={d.country}>
            <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.25} stroke={color} strokeWidth={1.5} />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>
              {getFlag(d.country)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Sortable Table ---------- */
type SortField = "country" | "instrument_count" | "median_rs_sp500_3m" | "median_rs_msci_3m" | "median_ret_3m" | "median_ret_12m" | "pct_leader" | "bubble_color";

export default function GlobalPulsePage() {
  const { data: regime, state: regimeState, meta: regimeMeta } = useUnifiedData<RegimeResponse>("/api/unified/global/regime");
  const { data: globalAgg, state: globalAggState } = useUnifiedData<GlobalAggregateResponse>("/api/unified/global/aggregate");

  const [sortField, setSortField] = useState<SortField>("median_ret_3m");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const list = globalAgg?.points ?? [];
    return [...list].sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return 0;
    });
  }, [globalAgg, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>⇅</span>;
    return <span style={{ color: "var(--accent-700)", fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0, color: "var(--text-primary)" }}>
          Global Pulse
        </h1>
        <DataFreshness dataAsOf={regimeMeta?.data_as_of ?? null} />
      </div>

      {/* Regime Banner */}
      {regimeState === "ready" && regime && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <RegimeGauge healthScore={regime.metrics.health_score ?? 0} healthZone={regime.metrics.health_zone ?? "NEUTRAL"} regime={regime.regime ?? ""} />
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
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
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>
              Markets Covered
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-serif)" }}>
              {globalAgg?.points.length ?? 0}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Countries &amp; regions tracked
            </div>
          </div>
        </div>
      )}

      {regimeState === "loading" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>Loading global regime…</div>
      )}

      {/* Bubble Chart */}
      {(globalAggState === "ready" || globalAggState === "stale") && globalAgg && globalAgg.points.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            Country Rotation Map
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
            X = RS vs S&amp;P 500 · Y = 3M Return · Size = Instrument Count · Color = Consensus Action
          </div>
          <GlobalBubbleChart data={globalAgg.points} />
        </div>
      )}

      {/* Sortable Table */}
      {(globalAggState === "ready" || globalAggState === "stale") && globalAgg && globalAgg.points.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
            Global Markets
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th onClick={() => handleSort("country")} style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                    Country {sortIndicator("country")}
                  </th>
                  <th onClick={() => handleSort("instrument_count")} style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                    Inst. {sortIndicator("instrument_count")}
                  </th>
                  <th onClick={() => handleSort("median_rs_sp500_3m")} style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                    RS S&amp;P 500 {sortIndicator("median_rs_sp500_3m")}
                  </th>
                  <th onClick={() => handleSort("median_rs_msci_3m")} style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                    RS MSCI {sortIndicator("median_rs_msci_3m")}
                  </th>
                  <th onClick={() => handleSort("median_ret_3m")} style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                    3M Ret {sortIndicator("median_ret_3m")}
                  </th>
                  <th onClick={() => handleSort("median_ret_12m")} style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                    12M Ret {sortIndicator("median_ret_12m")}
                  </th>
                  <th onClick={() => handleSort("pct_leader")} style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                    Leaders % {sortIndicator("pct_leader")}
                  </th>
                  <th onClick={() => handleSort("bubble_color")} style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                    Action {sortIndicator("bubble_color")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pt) => (
                  <tr key={pt.country} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                      <span style={{ fontSize: 16, marginRight: 8 }}>{getFlag(pt.country)}</span>
                      <span>{getFullName(pt.country)}</span>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 6 }}>{pt.country}</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {pt.instrument_count}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: colorForRS(pt.median_rs_sp500_3m) }}>
                      {pt.median_rs_sp500_3m?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: colorForRS(pt.median_rs_msci_3m) }}>
                      {pt.median_rs_msci_3m?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: colorForRet(pt.median_ret_3m) }}>
                      {pt.median_ret_3m ? `${(pt.median_ret_3m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: colorForRet(pt.median_ret_12m) }}>
                      {pt.median_ret_12m ? `${(pt.median_ret_12m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {pt.pct_leader?.toFixed(1) ?? "—"}%
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
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>Loading global markets…</div>
      )}
    </div>
  );
}
