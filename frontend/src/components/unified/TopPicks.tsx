"use client";

import type { ScreenerResponse, ScreenerRow } from "@/lib/api-unified";

function retColor(ret: number | null): string {
  if (ret == null) return "var(--text-tertiary)";
  return ret >= 0 ? "var(--rag-green-600)" : "var(--rag-red-600)";
}

function rsColor(rs: number | null): string {
  if (rs == null) return "var(--text-tertiary)";
  if (rs >= 80) return "var(--rag-green-700)";
  if (rs >= 60) return "var(--rag-green-500)";
  if (rs >= 40) return "var(--text-primary)";
  return "var(--rag-red-500)";
}

function actionBadge(action: string | null): { text: string; bg: string; color: string } {
  if (!action) return { text: "—", bg: "var(--bg-surface-alt)", color: "var(--text-tertiary)" };
  const a = action.toUpperCase();
  if (a.includes("STRONG_ACCUMULATE")) return { text: "Strong Accumulate", bg: "var(--rag-green-100)", color: "var(--rag-green-700)" };
  if (a.includes("ACCUMULATE")) return { text: "Accumulate", bg: "var(--rag-green-50)", color: "var(--rag-green-600)" };
  if (a.includes("HOLD")) return { text: "Hold", bg: "var(--bg-surface-alt)", color: "var(--text-secondary)" };
  if (a.includes("REDUCE")) return { text: "Reduce", bg: "var(--rag-amber-100)", color: "var(--rag-amber-700)" };
  if (a.includes("EXIT")) return { text: "Exit", bg: "var(--rag-red-100)", color: "var(--rag-red-700)" };
  return { text: action, bg: "var(--bg-surface-alt)", color: "var(--text-secondary)" };
}

export default function TopPicks({ data, state }: { data: ScreenerResponse | null; state: string }) {
  if (state === "loading") {
    return (
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>Top Picks from Leading Sectors</div>
        <div style={{ height: "120px", background: "var(--bg-surface-alt)", borderRadius: "6px" }} />
      </div>
    );
  }

  const rows = data?.rows ?? [];

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600 }}>Top Picks from Leading Sectors</div>
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Best RS performers with Accumulate or Strong Accumulate action. Large and mid cap only.
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: "12px", color: "var(--text-tertiary)", padding: "20px 0", textAlign: "center" }}>
          No qualifying stocks found.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "var(--bg-surface-alt)" }}>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Stock</th>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Sector</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>RS 3M</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>3M Ret</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>12M Ret</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>RSI</th>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = actionBadge(r.action);
                return (
                  <tr key={r.instrument_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{r.symbol}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }}>{r.name}</div>
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {r.sector ?? "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: rsColor(r.rs_nifty_3m_rank) }}>
                      {r.rs_nifty_3m_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: retColor(r.ret_3m) }}>
                      {r.ret_3m != null ? `${r.ret_3m >= 0 ? "+" : ""}${(r.ret_3m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: retColor(r.ret_12m) }}>
                      {r.ret_12m != null ? `${r.ret_12m >= 0 ? "+" : ""}${(r.ret_12m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {r.rsi_14?.toFixed(0) ?? "—"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: badge.bg,
                          color: badge.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
