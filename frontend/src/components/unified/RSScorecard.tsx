"use client";

import type { MetricSnapshot } from "@/lib/api-unified";

interface RSScorecardProps {
  metrics: MetricSnapshot;
}

const PERIODS: { key: string; label: string }[] = [
  { key: "1d", label: "1d" },
  { key: "1w", label: "1w" },
  { key: "1m", label: "1m" },
  { key: "3m", label: "3m" },
  { key: "6m", label: "6m" },
  { key: "12m", label: "12m" },
  { key: "24m", label: "24m" },
  { key: "36m", label: "36m" },
];

const BENCHMARKS: { key: string; label: string; prefix: string }[] = [
  { key: "nifty", label: "Nifty", prefix: "rs_nifty" },
  { key: "nifty500", label: "Nifty 500", prefix: "rs_nifty500" },
  { key: "sp500", label: "S&P 500", prefix: "rs_sp500" },
  { key: "msci", label: "MSCI", prefix: "rs_msci" },
  { key: "gold", label: "Gold", prefix: "rs_gold" },
];

function getRank(metrics: MetricSnapshot, prefix: string, period: string): number | null {
  const key = `${prefix}_${period}_rank` as keyof MetricSnapshot;
  const val = metrics[key];
  return typeof val === "number" ? val : null;
}

function rankColor(val: number | null): string {
  if (val === null) return "var(--text-disabled)";
  if (val >= 80) return "var(--rag-green-700)";
  if (val >= 60) return "var(--rag-green-600)";
  if (val >= 40) return "var(--rag-amber-600)";
  return "var(--rag-red-700)";
}

function rankBg(val: number | null): string {
  if (val === null) return "transparent";
  if (val >= 80) return "var(--rag-green-50)";
  if (val >= 60) return "var(--rag-green-25)";
  if (val >= 40) return "var(--rag-amber-50)";
  return "var(--rag-red-50)";
}

export default function RSScorecard({ metrics }: RSScorecardProps) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-primary)",
        }}
      >
        RS Scorecard — Rank vs Benchmark (0-100)
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ background: "var(--bg-surface-alt)" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  fontWeight: 600,
                  color: "var(--text-tertiary)",
                  borderBottom: "1px solid var(--border-subtle)",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  position: "sticky",
                  left: 0,
                  background: "var(--bg-surface-alt)",
                  zIndex: 1,
                }}
              >
                Period
              </th>
              {BENCHMARKS.map((bm) => (
                <th
                  key={bm.key}
                  style={{
                    textAlign: "center",
                    padding: "6px 8px",
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bm.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period.key} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td
                  style={{
                    padding: "6px 8px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                    position: "sticky",
                    left: 0,
                    background: "var(--bg-surface)",
                    zIndex: 1,
                    fontSize: "11px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {period.label}
                </td>
                {BENCHMARKS.map((bm) => {
                  const val = getRank(metrics, bm.prefix, period.key);
                  const color = rankColor(val);
                  const bg = rankBg(val);
                  return (
                    <td
                      key={bm.key}
                      style={{
                        padding: "6px 8px",
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 700,
                        color,
                        background: bg,
                        fontSize: "11px",
                        minWidth: "48px",
                      }}
                    >
                      {val !== null ? val.toFixed(0) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
