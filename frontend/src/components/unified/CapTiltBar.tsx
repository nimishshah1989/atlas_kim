"use client";

interface CapTiltBarProps {
  largePct: number | null;
  midPct: number | null;
  smallPct: number | null;
  capTilt: string | null;
}

export default function CapTiltBar({ largePct, midPct, smallPct, capTilt }: CapTiltBarProps) {
  const l = Math.max(0, Math.min(100, largePct ?? 0));
  const m = Math.max(0, Math.min(100, midPct ?? 0));
  const s = Math.max(0, Math.min(100, smallPct ?? 0));
  const total = l + m + s || 1;
  const lp = (l / total) * 100;
  const mp = (m / total) * 100;
  const sp = (s / total) * 100;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", textTransform: "uppercase" }}>
          Cap Tilt: {capTilt ?? "—"}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          height: "28px",
          borderRadius: "6px",
          overflow: "hidden",
          background: "var(--bg-inset)",
          border: "1px solid var(--border-default)",
        }}
      >
        {lp > 0 && (
          <div
            style={{
              width: `${lp}%`,
              background: "var(--accent-500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-inverse)",
              whiteSpace: "nowrap",
            }}
            title={`Large: ${l.toFixed(1)}%`}
          >
            {lp > 12 && `L ${l.toFixed(0)}%`}
          </div>
        )}
        {mp > 0 && (
          <div
            style={{
              width: `${mp}%`,
              background: "var(--accent-300)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--accent-900)",
              whiteSpace: "nowrap",
            }}
            title={`Mid: ${m.toFixed(1)}%`}
          >
            {mp > 12 && `M ${m.toFixed(0)}%`}
          </div>
        )}
        {sp > 0 && (
          <div
            style={{
              width: `${sp}%`,
              background: "var(--accent-100)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--accent-700)",
              whiteSpace: "nowrap",
            }}
            title={`Small: ${s.toFixed(1)}%`}
          >
            {sp > 12 && `S ${s.toFixed(0)}%`}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "6px",
          fontSize: "11px",
          color: "var(--text-tertiary)",
        }}
      >
        <span>Large {l.toFixed(1)}%</span>
        <span>Mid {m.toFixed(1)}%</span>
        <span>Small {s.toFixed(1)}%</span>
      </div>
    </div>
  );
}
