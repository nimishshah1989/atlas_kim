"use client";

interface ScoreCell {
  benchmark: string;
  period: string;
  value: number | null;
  rank?: number | null;
}

interface RSScorecardProps {
  scores: ScoreCell[];
}

const PERIODS = ["1w", "1m", "3m", "6m", "12m"];
const BENCHMARKS = ["NIFTY_50", "NIFTY_100", "NIFTY_200", "NIFTY_500", "NIFTY_MIDCAP_100", "NIFTY_SMALLCAP_100", "NIFTY_TOTAL_MKT"];

export default function RSScorecard({ scores }: RSScorecardProps) {
  const lookup = new Map<string, ScoreCell>();
  for (const s of scores) {
    lookup.set(`${s.benchmark}-${s.period}`, s);
  }

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
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        RS Scorecard
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "var(--bg-surface-alt)" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontWeight: 600,
                  color: "var(--text-tertiary)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                Benchmark
              </th>
              {PERIODS.map((p) => (
                <th
                  key={p}
                  style={{
                    textAlign: "center",
                    padding: "8px 12px",
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BENCHMARKS.map((bm) => (
              <tr key={bm} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td
                  style={{
                    padding: "8px 12px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  {bm.replace(/_/g, " ")}
                </td>
                {PERIODS.map((p) => {
                  const cell = lookup.get(`${bm}-${p}`);
                  const val = cell?.value ?? null;
                  const color =
                    val === null
                      ? "var(--text-disabled)"
                      : val >= 80
                      ? "var(--rag-green-700)"
                      : val >= 50
                      ? "var(--text-primary)"
                      : "var(--rag-red-700)";
                  return (
                    <td
                      key={p}
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                        color,
                      }}
                    >
                      {val !== null ? val.toFixed(1) : "—"}
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
