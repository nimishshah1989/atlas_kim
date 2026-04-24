"use client";

import type { ScreenerResponse, ScreenerRow } from "@/lib/api-unified";

const KEY_INDICES = [
  { symbol: "NIFTY 50", label: "Nifty 50", category: "Broad" },
  { symbol: "NIFTY NEXT 50", label: "Next 50", category: "Broad" },
  { symbol: "NIFTY 500", label: "Nifty 500", category: "Broad" },
  { symbol: "NIFTY MIDCAP 150", label: "Midcap 150", category: "Mid" },
  { symbol: "NIFTY SMALLCAP 250", label: "Smallcap 250", category: "Small" },
  { symbol: "NIFTY BANK", label: "Bank", category: "Sector" },
  { symbol: "NIFTY IT", label: "IT", category: "Sector" },
  { symbol: "INDIA VIX", label: "India VIX", category: "Fear" },
];

function retColor(ret: number | null): string {
  if (ret == null) return "var(--text-tertiary)";
  return ret >= 0 ? "var(--rag-green-600)" : "var(--rag-red-600)";
}

function stateBg(state: string | null): string {
  if (!state) return "var(--bg-surface-alt)";
  const s = state.toUpperCase();
  if (s.includes("LEADER") || s.includes("EMERGING")) return "var(--rag-green-100)";
  if (s.includes("WEAKENING") || s.includes("BROKEN")) return "var(--rag-red-100)";
  if (s.includes("LAGGING")) return "var(--rag-amber-100)";
  return "var(--bg-surface-alt)";
}

function stateColor(state: string | null): string {
  if (!state) return "var(--text-tertiary)";
  const s = state.toUpperCase();
  if (s.includes("LEADER") || s.includes("EMERGING")) return "var(--rag-green-700)";
  if (s.includes("WEAKENING") || s.includes("BROKEN")) return "var(--rag-red-700)";
  if (s.includes("LAGGING")) return "var(--rag-amber-700)";
  return "var(--text-secondary)";
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

export default function IndexPulse({ data, state }: { data: ScreenerResponse | null; state: string }) {
  if (state === "loading") {
    return (
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>Index Pulse</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: "80px", background: "var(--bg-surface-alt)", borderRadius: "6px" }} />
          ))}
        </div>
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const bySymbol = new Map<string, ScreenerRow>();
  for (const r of rows) {
    if (r.symbol) bySymbol.set(r.symbol, r);
  }

  const signalLabel = (row: ScreenerRow | undefined): string => {
    if (!row) return "—";
    const action = row.action?.toUpperCase() ?? "";
    const state = row.state?.toUpperCase() ?? "";
    if (action === "EXIT" || state === "LAGGING") return "Exit";
    if (action === "REDUCE" || state === "WEAKENING") return "Reduce";
    if (action === "STRONG_ACCUMULATE" || state === "LEADER") return "Strong OW";
    if (action === "ACCUMULATE" || state === "EMERGING") return "OW";
    if (state === "BASE" || state === "HOLDING") return "Base";
    return "Hold";
  };

  const signalColor = (row: ScreenerRow | undefined): string => {
    const label = signalLabel(row);
    if (label === "Strong OW") return "var(--rag-green-700)";
    if (label === "OW") return "var(--rag-green-600)";
    if (label === "Base") return "var(--text-secondary)";
    if (label === "Reduce") return "var(--rag-amber-700)";
    if (label === "Exit") return "var(--rag-red-700)";
    return "var(--text-tertiary)";
  };

  const signalBg = (row: ScreenerRow | undefined): string => {
    const label = signalLabel(row);
    if (label === "Strong OW") return "var(--rag-green-100)";
    if (label === "OW") return "var(--rag-green-50)";
    if (label === "Base") return "var(--bg-surface-alt)";
    if (label === "Reduce") return "var(--rag-amber-100)";
    if (label === "Exit") return "var(--rag-red-100)";
    return "var(--bg-surface-alt)";
  };

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600 }}>Index Pulse</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Key benchmark and sector indices with signals
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", fontSize: "11px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--rag-green-500)", display: "inline-block" }} />
            Bull
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--rag-amber-500)", display: "inline-block" }} />
            Neutral
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--rag-red-500)", display: "inline-block" }} />
            Bear
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        {KEY_INDICES.map((idx) => {
          const row = bySymbol.get(idx.symbol);
          const ret3m = row?.ret_3m ?? null;
          const signal = signalLabel(row);
          const sColor = signalColor(row);
          const sBg = signalBg(row);
          return (
            <div
              key={idx.symbol}
              style={{
                background: "var(--bg-surface-alt)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)" }}>{idx.label}</span>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "999px",
                    background: sBg,
                    color: sColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  {signal}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                {ret3m != null && (
                  <span style={{ fontSize: "15px", fontWeight: 700, color: retColor(ret3m), fontVariantNumeric: "tabular-nums" }}>
                    {ret3m >= 0 ? "+" : ""}{(ret3m * 100).toFixed(1)}%
                  </span>
                )}

              </div>
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                {row?.state ?? "—"} · RS {row?.rs_nifty_3m_rank?.toFixed(0) ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
