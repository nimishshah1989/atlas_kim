"use client";

import type { FundHolding } from "@/lib/api-unified";
import ActionBadge from "./ActionBadge";

interface HoldingsTableProps {
  holdings: FundHolding[];
  maxRows?: number;
}

export default function HoldingsTable({ holdings, maxRows = 20 }: HoldingsTableProps) {
  const rows = holdings.slice(0, maxRows);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ background: "var(--bg-surface-alt)" }}>
            <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>#</th>
            <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Name</th>
            <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Weight %</th>
            <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>RS Rank</th>
            <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>State</th>
            <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Sector</th>
            <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={h.child_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td style={{ padding: "10px 12px", color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                {i + 1}
              </td>
              <td style={{ padding: "10px 12px", fontWeight: 500 }}>{h.name}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {h.weight_pct !== null ? `${h.weight_pct.toFixed(2)}%` : "—"}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {h.rs_nifty_3m_rank?.toFixed(1) ?? "—"}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{h.state ?? "—"}</td>
              <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{h.sector ?? "—"}</td>
              <td style={{ padding: "10px 12px" }}>
                <ActionBadge action={h.action ?? "HOLD"} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
