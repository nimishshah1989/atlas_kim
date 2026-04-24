"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUnifiedData, useUnifiedDataPost } from "@/hooks/useUnifiedData";
import { humanizeRegime } from "@/lib/formatters";
import BubbleChart from "@/components/unified/BubbleChart";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type {
  RegimeResponse,
  AggregateResponse,
  ScreenerResponse,
  ScreenerRow,
  FundRankingsResponse,
  CohortPoint,
} from "@/lib/api-unified";

const BENCHMARK_OPTIONS = [
  { value: "nifty", label: "Nifty 50" },
  { value: "nifty500", label: "Nifty 500" },
  { value: "sp500", label: "S&P 500" },
  { value: "msci", label: "MSCI" },
  { value: "gold", label: "Gold" },
];

const PERIOD_OPTIONS = [
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
];

type ScreenerRowExt = ScreenerRow & { frag_level?: string | null };

function rsSortField(benchmark: string): string {
  switch (benchmark) {
    case "nifty500":
      return "rs_nifty500_3m_rank";
    case "sp500":
      return "rs_sp500_3m_rank";
    case "msci":
      return "rs_msci_3m_rank";
    case "gold":
      return "rs_gold_3m_rank";
    default:
      return "rs_nifty_3m_rank";
  }
}

function regimeColor(regime: string | null): string {
  if (!regime) return "var(--text-tertiary)";
  const r = regime.toUpperCase();
  if (r.includes("BULLISH") || r.includes("LEADERS") || r.includes("ACCUMULATION"))
    return "var(--rag-green-500)";
  if (r.includes("BEARISH") || r.includes("FRAGILE") || r.includes("DISTRIBUTION"))
    return "var(--rag-red-500)";
  if (r.includes("CAUTION") || r.includes("DEFENSIVE"))
    return "var(--rag-amber-500)";
  return "var(--text-tertiary)";
}

function directionArrow(direction: string | null): string {
  if (!direction) return "→";
  const d = direction.toUpperCase();
  if (d.includes("UP")) return "↗";
  if (d.includes("DOWN")) return "↘";
  return "↔";
}

function zoneColor(pct: number): string {
  if (pct >= 70) return "var(--rag-green-500)";
  if (pct >= 50) return "var(--rag-green-400)";
  if (pct >= 35) return "var(--text-tertiary)";
  if (pct >= 20) return "var(--rag-amber-500)";
  return "var(--rag-red-500)";
}

function rsRankColor(rank: number | null): string {
  if (rank == null) return "var(--text-tertiary)";
  if (rank >= 80) return "var(--rag-green-600)";
  if (rank >= 60) return "var(--rag-green-500)";
  if (rank >= 40) return "var(--rag-amber-500)";
  return "var(--rag-red-500)";
}

function rsRankTooltip(rank: number | null): string {
  if (rank == null) return "";
  if (rank >= 80) return "Top quintile";
  if (rank < 20) return "Bottom quintile";
  return "";
}

function retColor(ret: number | null): string {
  if (ret == null) return "var(--text-tertiary)";
  return ret >= 0 ? "var(--rag-green-500)" : "var(--rag-red-500)";
}

function fragColor(score: number | null): string {
  if (score == null) return "var(--text-tertiary)";
  const pct = score * 100;
  if (pct >= 60) return "var(--rag-red-500)";
  if (pct >= 30) return "var(--rag-amber-500)";
  return "var(--rag-green-500)";
}

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: "999px",
        border: "1px solid var(--border-default)",
        background: active ? "var(--accent-700)" : "var(--bg-surface)",
        color: active ? "#fff" : "var(--text-primary)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 150ms ease",
      }}
    >
      {label}
    </button>
  );
}

function BreadthBar({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const color = zoneColor(pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color,
          }}
        >
          {value != null ? `${value.toFixed(1)}%` : "—"}
        </span>
      </div>
      <div
        style={{
          height: "8px",
          background: "var(--bg-inset)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "4px",
            transition: "width 500ms ease",
          }}
        />
      </div>
    </div>
  );
}

function MicroBar({ value }: { value: number | null }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const color = zoneColor(pct);
  return (
    <div
      style={{
        height: "4px",
        background: "var(--bg-inset)",
        borderRadius: "2px",
        overflow: "hidden",
        marginTop: "2px",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: "2px",
          transition: "width 500ms ease",
        }}
      />
    </div>
  );
}

function CompactRegimeGauge({
  score,
  zone,
  regime,
  direction,
}: {
  score: number;
  zone: string;
  regime: string;
  direction: string | null;
}) {
  const radius = 36;
  const stroke = 6;
  const normalized = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;
  const color = zoneColor(normalized);
  const size = radius * 2 + stroke;
  const cx = radius + stroke / 2;
  const cy = radius + stroke / 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--bg-inset)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: "16px",
            fontWeight: 700,
            fill: "var(--text-primary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(normalized)}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: "8px",
            fontWeight: 600,
            fill: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {zone}
        </text>
      </svg>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: regimeColor(regime),
        }}
      >
        {humanizeRegime(regime)}
      </div>
      <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
        {directionArrow(direction)}
      </div>
    </div>
  );
}

function StateCountCard({
  title,
  count,
  href,
  color,
  definition,
}: {
  title: string;
  count: number;
  href?: string;
  color: string;
  definition: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color,
          fontFamily: "var(--font-serif)",
          lineHeight: 1,
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--text-secondary)",
          lineHeight: 1.4,
        }}
      >
        {definition}
      </div>
      {href && (
        <Link
          href={href}
          style={{
            fontSize: "11px",
            color: "var(--accent-700)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Click to view →
        </Link>
      )}
    </div>
  );
}

function MoverCard({
  row,
  extra,
  onClick,
}: {
  row: ScreenerRowExt;
  extra?: React.ReactNode;
  onClick: () => void;
}) {
  const rs = row.rs_nifty_3m_rank;
  const ret3m = row.ret_3m;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          minWidth: 0,
          flex: 1,
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.symbol}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.name}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        {extra}
        {rs != null && (
          <span
            title={rsRankTooltip(rs)}
            style={{
              fontSize: "11px",
              fontVariantNumeric: "tabular-nums",
              color: rsRankColor(rs),
              minWidth: "42px",
              textAlign: "right",
              fontWeight: 600,
            }}
          >
            RS {rs.toFixed(0)}
          </span>
        )}
        {ret3m != null && (
          <span
            style={{
              fontSize: "11px",
              fontVariantNumeric: "tabular-nums",
              color: retColor(ret3m),
              minWidth: "50px",
              textAlign: "right",
              fontWeight: 600,
            }}
          >
            {ret3m >= 0 ? "+" : ""}
            {(ret3m * 100).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

const EQUITY_FILTERS = [
  { field: "instrument_type", op: "eq", value: "EQUITY" },
  { field: "cap_category", op: "in", value: ["LARGE", "MID"] },
];

function SectorHealthTable({
  points,
  onRowClick,
}: {
  points: CohortPoint[];
  onRowClick: (name: string) => void;
}) {
  const sorted = [...points].sort(
    (a, b) => (b.pct_above_ema_50 ?? 0) - (a.pct_above_ema_50 ?? 0)
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
        }}
      >
        <thead>
          <tr style={{ background: "var(--bg-surface-alt)" }}>
            <th
              style={{
                textAlign: "left",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Sector
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Stocks
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              RS Rank
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              3M Ret
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              12M Ret
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              % &gt;EMA-50
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Leader %
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Avg Frag
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "8px 10px",
                color: "var(--text-tertiary)",
                fontWeight: 600,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pt) => {
            const rs = pt.median_rs_rank;
            const ret3m = pt.median_ret_3m;
            const ret12m = pt.median_ret_12m;
            const above50 = pt.pct_above_ema_50;
            const leaderPct = pt.pct_leader_state;
            const avgFrag = pt.avg_frag_score;
            return (
              <tr
                key={pt.cohort_key}
                onClick={() => onRowClick(pt.cohort_key)}
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                }}
              >
                <td
                  style={{
                    padding: "8px 10px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pt.cohort_key}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pt.member_count}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: rsRankColor(rs),
                  }}
                >
                  {rs?.toFixed(0) ?? "—"}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: retColor(ret3m),
                  }}
                >
                  {ret3m != null
                    ? `${ret3m >= 0 ? "+" : ""}${(ret3m * 100).toFixed(1)}%`
                    : "—"}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: retColor(ret12m),
                  }}
                >
                  {ret12m != null
                    ? `${ret12m >= 0 ? "+" : ""}${(ret12m * 100).toFixed(1)}%`
                    : "—"}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                  }}
                >
                  {above50 != null ? `${above50.toFixed(0)}%` : "—"}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: rsRankColor(leaderPct),
                  }}
                >
                  {leaderPct != null ? `${leaderPct.toFixed(0)}%` : "—"}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: fragColor(avgFrag),
                  }}
                >
                  {avgFrag != null ? `${(avgFrag * 100).toFixed(0)}%` : "—"}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  {pt.consensus_action ? (
                    <ActionBadge action={pt.consensus_action} size="sm" />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function UnifiedDashboard() {
  const router = useRouter();
  const [benchmark, setBenchmark] = useState("nifty");
  const [period, setPeriod] = useState("3m");

  const { data: regime, state: regimeState, meta: regimeMeta } =
    useUnifiedData<RegimeResponse>("/api/unified/regime", {
      benchmark,
      period,
    });

  const { data: aggregate, state: aggState } = useUnifiedData<AggregateResponse>(
    "/api/unified/aggregate",
    {
      cohort_type: "sector",
      benchmark,
      period,
    }
  );

  const sortField = rsSortField(benchmark);

  // Movers screens (limit=5)
  const { data: leaders, state: leadersState } = useUnifiedDataPost<ScreenerResponse>(
    "/api/unified/screen",
    {
      filters: [
        ...EQUITY_FILTERS,
        { field: "action", op: "in", value: ["STRONG_ACCUMULATE", "ACCUMULATE"] },
      ],
      sort_field: sortField,
      sort_direction: "desc",
      limit: 5,
      offset: 0,
      benchmark,
      period,
    }
  );

  const { data: weakening, state: weakeningState } = useUnifiedDataPost<ScreenerResponse>(
    "/api/unified/screen",
    {
      filters: [
        ...EQUITY_FILTERS,
        { field: "action", op: "in", value: ["REDUCE", "EXIT"] },
      ],
      sort_field: sortField,
      sort_direction: "desc",
      limit: 5,
      offset: 0,
      benchmark,
      period,
    }
  );

  const { data: fragile, state: fragileState } = useUnifiedDataPost<ScreenerResponse>(
    "/api/unified/screen",
    {
      filters: [
        ...EQUITY_FILTERS,
        { field: "frag_level", op: "in", value: ["HIGH", "CRITICAL"] },
      ],
      sort_field: "frag_score",
      sort_direction: "desc",
      limit: 5,
      offset: 0,
      benchmark,
      period,
    }
  );

  // Count screens (limit=1, just for total_count)
  const { data: leadersCountData } = useUnifiedDataPost<ScreenerResponse>(
    "/api/unified/screen",
    {
      filters: [
        ...EQUITY_FILTERS,
        { field: "action", op: "eq", value: "STRONG_ACCUMULATE" },
      ],
      sort_field: sortField,
      sort_direction: "desc",
      limit: 1,
      offset: 0,
      benchmark,
      period,
    }
  );

  const { data: emergingCountData } = useUnifiedDataPost<ScreenerResponse>(
    "/api/unified/screen",
    {
      filters: [
        ...EQUITY_FILTERS,
        { field: "action", op: "eq", value: "ACCUMULATE" },
      ],
      sort_field: sortField,
      sort_direction: "desc",
      limit: 1,
      offset: 0,
      benchmark,
      period,
    }
  );

  const { data: weakeningCountData } = useUnifiedDataPost<ScreenerResponse>(
    "/api/unified/screen",
    {
      filters: [
        ...EQUITY_FILTERS,
        { field: "action", op: "in", value: ["REDUCE", "EXIT"] },
      ],
      sort_field: sortField,
      sort_direction: "desc",
      limit: 1,
      offset: 0,
      benchmark,
      period,
    }
  );

  const { data: fragileCountData } = useUnifiedDataPost<ScreenerResponse>(
    "/api/unified/screen",
    {
      filters: [
        ...EQUITY_FILTERS,
        { field: "frag_level", op: "in", value: ["HIGH", "CRITICAL"] },
      ],
      sort_field: "frag_score",
      sort_direction: "desc",
      limit: 1,
      offset: 0,
      benchmark,
      period,
    }
  );

  const { data: fundRankings, state: fundRankingsState } =
    useUnifiedData<FundRankingsResponse>("/api/unified/funds/rankings", {
      benchmark,
      period,
    });

  // State counts from dedicated count screens
  const leadersCount = leadersCountData?.total_count ?? 0;
  const emergingCount = emergingCountData?.total_count ?? 0;
  const weakeningCount = weakeningCountData?.total_count ?? 0;
  const fragileCount = fragileCountData?.total_count ?? 0;

  // Top funds with client-side filtering
  const topFunds = (fundRankings?.rows ?? [])
    .filter((f) => {
      if ((f.aum_cr ?? 0) <= 100) return false;
      const nameUpper = f.name?.toUpperCase() ?? "";
      const catUpper = f.mf_category?.toUpperCase() ?? "";
      if (catUpper.includes("INDEX")) return false;
      if (nameUpper.includes("INDEX")) return false;
      if (nameUpper.includes("FOF")) return false;
      if (nameUpper.includes("ETF")) return false;
      return true;
    })
    .slice()
    .sort((a, b) => (b.lookthrough_rs_3m ?? 0) - (a.lookthrough_rs_3m ?? 0))
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "26px",
            fontWeight: 400,
            margin: 0,
            color: "var(--text-primary)",
          }}
        >
          Command Center
        </h1>
        <DataFreshness dataAsOf={regimeMeta?.data_as_of ?? null} />
      </div>

      {/* Section 1: Market Health Banner — dense 3-column grid */}
      {regimeState === "ready" && regime && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px 20px",
            display: "grid",
            gridTemplateColumns: "120px 1fr 280px",
            gap: "16px",
            alignItems: "start",
          }}
        >
          {/* Column 1: Regime Summary */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <CompactRegimeGauge
              score={regime.metrics.health_score ?? 0}
              zone={regime.metrics.health_zone ?? "NEUTRAL"}
              regime={regime.regime ?? ""}
              direction={regime.direction}
            />
          </div>

          {/* Column 2: Market Breadth Metrics Grid (2×3) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-tertiary)",
                }}
              >
                % Above EMA-20
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: zoneColor(regime.metrics.pct_above_ema_20 ?? 0),
                }}
              >
                {regime.metrics.pct_above_ema_20 != null
                  ? `${regime.metrics.pct_above_ema_20.toFixed(1)}%`
                  : "—"}
              </div>
              <MicroBar value={regime.metrics.pct_above_ema_20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-tertiary)",
                }}
              >
                % Above EMA-50
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: zoneColor(regime.metrics.pct_above_ema_50 ?? 0),
                }}
              >
                {regime.metrics.pct_above_ema_50 != null
                  ? `${regime.metrics.pct_above_ema_50.toFixed(1)}%`
                  : "—"}
              </div>
              <MicroBar value={regime.metrics.pct_above_ema_50} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-tertiary)",
                }}
              >
                % Above EMA-200
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: zoneColor(regime.metrics.pct_above_ema_200 ?? 0),
                }}
              >
                {regime.metrics.pct_above_ema_200 != null
                  ? `${regime.metrics.pct_above_ema_200.toFixed(1)}%`
                  : "—"}
              </div>
              <MicroBar value={regime.metrics.pct_above_ema_200} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-tertiary)",
                }}
              >
                Golden Cross %
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: zoneColor(regime.metrics.pct_golden_cross ?? 0),
                }}
              >
                {regime.metrics.pct_golden_cross != null
                  ? `${regime.metrics.pct_golden_cross.toFixed(1)}%`
                  : "—"}
              </div>
              <MicroBar value={regime.metrics.pct_golden_cross} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-tertiary)",
                }}
              >
                Participation
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: zoneColor(regime.metrics.participation ?? 0),
                }}
              >
                {regime.metrics.participation != null
                  ? `${regime.metrics.participation.toFixed(1)}%`
                  : "—"}
              </div>
              <MicroBar value={regime.metrics.participation} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-tertiary)",
                }}
              >
                RS Dispersion
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text-primary)",
                }}
              >
                {regime.metrics.rs_dispersion != null
                  ? regime.metrics.rs_dispersion.toFixed(2)
                  : "—"}
              </div>
            </div>
          </div>

          {/* Column 3: Narrative + Quick Stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {regime.narrative?.verdict ??
                regime.narrative?.technical_snapshot ??
                "Market regime analysis in progress."}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                fontSize: "11px",
                color: "var(--text-tertiary)",
              }}
            >
              <span>
                Total Stocks:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {aggregate?.points?.reduce((sum, p) => sum + p.member_count, 0) ??
                    "—"}
                </strong>
              </span>
              <span>
                Leaders:{" "}
                <strong style={{ color: "var(--rag-green-500)" }}>
                  {leadersCount}
                </strong>
              </span>
              <span>
                Above 50 EMA:{" "}
                <strong
                  style={{
                    color: zoneColor(regime.metrics.pct_above_ema_50 ?? 0),
                  }}
                >
                  {regime.metrics.pct_above_ema_50 != null
                    ? `${regime.metrics.pct_above_ema_50.toFixed(1)}%`
                    : "—"}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {regimeState === "loading" && (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "13px",
            background: "var(--bg-surface)",
            borderRadius: "8px",
            border: "1px solid var(--border-default)",
          }}
        >
          Loading regime data…
        </div>
      )}

      {/* Section 2: State Count Cards */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}
      >
        <StateCountCard
          title="LEADERS"
          count={leadersCount}
          href="/unified/leaders"
          color="var(--rag-green-500)"
          definition="RS 3M ≥80 & Above EMA-50"
        />
        <StateCountCard
          title="EMERGING"
          count={emergingCount}
          href="/unified/emerging"
          color="#4ade80"
          definition="RS 3M ≥60 & Building strength"
        />
        <StateCountCard
          title="WEAKENING"
          count={weakeningCount}
          href="/unified/weakening"
          color="var(--rag-amber-500)"
          definition="RS 3M <60 or Below EMA-50"
        />
        <StateCountCard
          title="FRAGILE"
          count={fragileCount}
          href="/unified/fragile"
          color="var(--rag-red-500)"
          definition="High fragility score — review"
        />
      </div>

      {/* Section 3: Global Controls (sticky) */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-tertiary)",
            }}
          >
            Period
          </span>
          {PERIOD_OPTIONS.map((p) => (
            <PillButton
              key={p.value}
              label={p.label}
              active={period === p.value}
              onClick={() => setPeriod(p.value)}
            />
          ))}
        </div>
        <div
          style={{
            width: "1px",
            height: "20px",
            background: "var(--border-default)",
            flexShrink: 0,
          }}
        />
        <div
          style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-tertiary)",
            }}
          >
            Benchmark
          </span>
          {BENCHMARK_OPTIONS.map((b) => (
            <PillButton
              key={b.value}
              label={b.label}
              active={benchmark === b.value}
              onClick={() => setBenchmark(b.value)}
            />
          ))}
        </div>
      </div>

      {/* Section 4: Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: "16px" }}>
        {/* Left: Sector RRG Quadrant Chart */}
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
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Sector Rotation (RRG)
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginTop: "2px",
              }}
            >
              X = RS Rank · Y = 3M Return · Size = Market Breadth
            </div>
          </div>
          {(aggState === "ready" || aggState === "stale") && aggregate && (
            <>
              <BubbleChart
                data={aggregate.points}
                height={400}
                onBubbleClick={(key) =>
                  router.push(`/unified/sectors/${encodeURIComponent(key)}`)
                }
              />
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  justifyContent: "center",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  marginTop: "4px",
                }}
              >
                <span>
                  <span style={{ color: "var(--rag-green-500)" }}>●</span>{" "}
                  STRONG_ACCUMULATE
                </span>
                <span>
                  <span style={{ color: "var(--rag-green-400)" }}>●</span>{" "}
                  ACCUMULATE
                </span>
                <span>
                  <span style={{ color: "var(--rag-amber-500)" }}>●</span> HOLD
                </span>
                <span>
                  <span style={{ color: "var(--rag-orange-500)" }}>●</span>{" "}
                  REDUCE
                </span>
                <span>
                  <span style={{ color: "var(--rag-red-500)" }}>●</span> EXIT
                </span>
              </div>
            </>
          )}
          {(aggState === "loading" || !aggregate) && (
            <div
              style={{
                height: "400px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-tertiary)",
                fontSize: "13px",
              }}
            >
              Loading sector rotation…
            </div>
          )}
        </div>

        {/* Right: Market Breadth Gauges */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Market Breadth
          </div>
          {regimeState === "ready" && regime ? (
            <>
              <BreadthBar
                label="% Above EMA-20"
                value={regime.metrics.pct_above_ema_20}
              />
              <BreadthBar
                label="% Above EMA-50"
                value={regime.metrics.pct_above_ema_50}
              />
              <BreadthBar
                label="% Above EMA-200"
                value={regime.metrics.pct_above_ema_200}
              />
              <BreadthBar
                label="Participation Rate"
                value={regime.metrics.participation}
              />
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-tertiary)",
                fontSize: "13px",
              }}
            >
              Loading breadth metrics…
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Sector Health Table */}
      {(aggState === "ready" || aggState === "stale") &&
        aggregate &&
        aggregate.points.length > 0 && (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              padding: "16px",
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
              Sector Health
            </div>
            <SectorHealthTable
              points={aggregate.points}
              onRowClick={(name) =>
                router.push(`/unified/sectors/${encodeURIComponent(name)}`)
              }
            />
          </div>
        )}

      {/* Section 6: Top Movers */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}
      >
        {/* Column 1: Top Leaders */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            Top Leaders
          </div>
          {(leadersState === "ready" || leadersState === "stale") &&
          leaders &&
          leaders.rows.length > 0 ? (
            leaders.rows.slice(0, 5).map((stock) => (
              <MoverCard
                key={stock.instrument_id}
                row={stock}
                extra={
                  stock.action ? (
                    <ActionBadge action={stock.action} size="sm" />
                  ) : null
                }
                onClick={() =>
                  router.push(`/unified/instrument/${stock.instrument_id}`)
                }
              />
            ))
          ) : (
            <div
              style={{
                padding: "16px 0",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: "12px",
              }}
            >
              Loading…
            </div>
          )}
        </div>

        {/* Column 2: Top Weakening */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            Top Weakening
          </div>
          {(weakeningState === "ready" || weakeningState === "stale") &&
          weakening &&
          weakening.rows.length > 0 ? (
            weakening.rows.slice(0, 5).map((stock) => (
              <MoverCard
                key={stock.instrument_id}
                row={stock}
                extra={
                  stock.action ? (
                    <ActionBadge action={stock.action} size="sm" />
                  ) : null
                }
                onClick={() =>
                  router.push(`/unified/instrument/${stock.instrument_id}`)
                }
              />
            ))
          ) : (
            <div
              style={{
                padding: "16px 0",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: "12px",
              }}
            >
              Loading…
            </div>
          )}
        </div>

        {/* Column 3: Most Fragile */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            Most Fragile
          </div>
          {(fragileState === "ready" || fragileState === "stale") &&
          fragile &&
          fragile.rows.length > 0 ? (
            fragile.rows.slice(0, 5).map((stock) => {
              const ext = stock as ScreenerRowExt;
              const fscore = stock.frag_score;
              return (
                <div
                  key={stock.instrument_id}
                  onClick={() =>
                    router.push(`/unified/instrument/${stock.instrument_id}`)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {stock.symbol}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {stock.name}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexShrink: 0,
                    }}
                  >
                    {ext.frag_level && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--rag-red-500)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid var(--rag-red-500)",
                        }}
                      >
                        {ext.frag_level}
                      </span>
                    )}
                    {fscore != null && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontVariantNumeric: "tabular-nums",
                          color: fragColor(fscore),
                          minWidth: "36px",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {(fscore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div
              style={{
                padding: "16px 0",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: "12px",
              }}
            >
              Loading…
            </div>
          )}
        </div>
      </div>

      {/* Section 7: Top Funds Preview */}
      {(fundRankingsState === "ready" || fundRankingsState === "stale") &&
        topFunds.length > 0 && (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Top Funds
              </div>
              <Link
                href="/unified/funds"
                style={{
                  fontSize: "12px",
                  color: "var(--accent-700)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                View all →
              </Link>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                }}
              >
                <thead>
                  <tr style={{ background: "var(--bg-surface-alt)" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        color: "var(--text-tertiary)",
                        fontWeight: 600,
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        color: "var(--text-tertiary)",
                        fontWeight: 600,
                      }}
                    >
                      Fund Name
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        color: "var(--text-tertiary)",
                        fontWeight: 600,
                      }}
                    >
                      Category
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 10px",
                        color: "var(--text-tertiary)",
                        fontWeight: 600,
                      }}
                    >
                      LT RS 3M
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        color: "var(--text-tertiary)",
                        fontWeight: 600,
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topFunds.map((f, i) => (
                    <tr
                      key={f.instrument_id}
                      onClick={() =>
                        router.push(`/unified/funds/${f.instrument_id}`)
                      }
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 10px",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          fontWeight: 500,
                          maxWidth: "300px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {f.name}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {f.mf_category ?? "—"}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                          color: rsRankColor(f.lookthrough_rs_3m),
                        }}
                      >
                        {f.lookthrough_rs_3m?.toFixed(0) ?? "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <ActionBadge action={f.action ?? "HOLD"} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {fundRankingsState === "loading" && (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "13px",
            background: "var(--bg-surface)",
            borderRadius: "8px",
            border: "1px solid var(--border-default)",
          }}
        >
          Loading fund rankings…
        </div>
      )}
    </div>
  );
}
