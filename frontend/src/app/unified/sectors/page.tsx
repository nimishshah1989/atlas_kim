"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUnifiedData } from "@/hooks/useUnifiedData";
import BubbleChart from "@/components/unified/BubbleChart";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type { AggregateResponse } from "@/lib/api-unified";

const BENCHMARK_OPTIONS = [
  { value: "nifty", label: "Nifty 50" },
  { value: "nifty500", label: "Nifty 500" },
  { value: "sp500", label: "S&P 500" },
  { value: "msci", label: "MSCI World" },
  { value: "gold", label: "Gold" },
];

const PERIOD_OPTIONS = ["1m", "3m", "6m", "12m"];

export default function SectorsPage() {
  const router = useRouter();
  const [benchmark, setBenchmark] = useState("nifty");
  const [period, setPeriod] = useState("3m");

  const { data: bubble, state, meta } = useUnifiedData<AggregateResponse>("/api/unified/aggregate", {
    cohort_type: "sector",
    benchmark,
    period,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>Sectors</h1>
        <DataFreshness dataAsOf={meta?.data_as_of ?? null} />
      </div>

      {bubble && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>Sector Bubble</div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <select
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                }}
              >
                {BENCHMARK_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                }}
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <BubbleChart
            data={bubble.points}
            height={360}
            onBubbleClick={(key) => router.push(`/unified/sectors/${encodeURIComponent(key)}`)}
          />
        </div>
      )}

      {(state === "ready" || state === "stale") && bubble && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600 }}>
            Sector Health
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Sector</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Stocks</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Median RS</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>3M Ret</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Above 50 EMA</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Leaders</th>
                  <th style={{ padding: "10px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {bubble.points.map((s) => (
                  <tr key={s.cohort_key} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                      <Link href={`/unified/sectors/${encodeURIComponent(s.cohort_key)}`} style={{ color: "var(--accent-700)", textDecoration: "none" }}>
                        {s.cohort_key}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.member_count}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {s.median_rs_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {s.median_ret_3m ? `${(s.median_ret_3m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {s.pct_above_ema_50?.toFixed(1) ?? "—"}%
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {s.pct_leader_state?.toFixed(1) ?? "—"}%
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <Link href={`/unified/sectors/${encodeURIComponent(s.cohort_key)}`} style={{ fontSize: "11px", color: "var(--text-tertiary)", textDecoration: "none" }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state === "loading" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading sectors…</div>
      )}
    </div>
  );
}
