"use client";

import { useEffect, useState } from "react";
import ActionBadge from "@/components/unified/ActionBadge";
import DataFreshness from "@/components/unified/DataFreshness";
import Link from "next/link";
import type { ScreenerResponse, ScreenerRow } from "@/lib/api-unified";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function postMfScreen(): Promise<ScreenerResponse> {
  const res = await fetch(`${API_BASE}/api/unified/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: [{ field: "instrument_type", op: "eq", value: "MF" }],
      sort_field: "rs_nifty_3m_rank",
      sort_direction: "desc",
      limit: 200,
      offset: 0,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function FundsPage() {
  const [funds, setFunds] = useState<ScreenerRow[]>([]);
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const resp = await postMfScreen();
        if (!cancelled) {
          setFunds(resp.rows);
          setDataAsOf(resp.meta?.data_as_of ?? null);
        }
      } catch {
        setFunds([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>Loading funds…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: 400, margin: 0 }}>Funds</h1>
        <DataFreshness dataAsOf={dataAsOf} />
      </div>

      {funds.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: 600 }}>
            Mutual Fund Rankings ({funds.length})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--bg-surface-alt)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Name</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Category</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>RS 3M</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>3M Ret</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Action</th>
                  <th style={{ padding: "10px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {funds.map((f) => (
                  <tr key={f.instrument_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{f.name}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{f.mf_category}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {f.rs_nifty_3m_rank?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {f.ret_3m ? `${(f.ret_3m * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <ActionBadge action={f.action ?? "HOLD"} confidence={f.action_confidence} size="sm" />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <Link href={`/unified/funds/${f.instrument_id}`} style={{ fontSize: "11px", color: "var(--text-tertiary)", textDecoration: "none" }}>
                        X-Ray →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {funds.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>No funds found.</div>
      )}
    </div>
  );
}
