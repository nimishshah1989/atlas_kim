"use client";

import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import type { CohortPoint } from "@/lib/api-unified";

interface BubbleChartProps {
  data: CohortPoint[];
  height?: number;
  onBubbleClick?: (cohortKey: string) => void;
}

const ACTION_COLORS: Record<string, string> = {
  STRONG_ACCUMULATE: "var(--rag-green-500)",
  ACCUMULATE: "var(--rag-green-400)",
  HOLD: "var(--rag-amber-500)",
  REDUCE: "var(--rag-orange-500)",
  EXIT: "var(--rag-red-500)",
  AVOID: "var(--rag-red-600)",
};

const QUADRANT_BG = {
  leading: "var(--rag-green-100)",
  weakening: "var(--rag-amber-100)",
  lagging: "var(--rag-red-100)",
  improving: "var(--accent-100)",
};

function colorForAction(action: string | null): string {
  return ACTION_COLORS[action ?? ""] ?? "var(--text-tertiary)";
}

export default function BubbleChart({ data, height = 400, onBubbleClick }: BubbleChartProps) {
  const normalized = useMemo(() => {
    const maxSize = Math.max(...data.map((d) => d.bubble_size ?? d.member_count), 1);
    return data.map((d) => {
      const rawY = (d.bubble_y ?? d.median_ret_3m ?? 0) * 100;
      const y = Math.max(-30, Math.min(30, rawY));
      return {
        x: d.bubble_x ?? d.median_rs_rank ?? 0,
        y,
        rawY,
        z: Math.max(30, ((d.bubble_size ?? d.member_count) / maxSize) * 300),
        label: d.cohort_label ?? d.cohort_key,
        key: d.cohort_key,
        color: colorForAction(d.bubble_color ?? d.consensus_action),
        count: d.member_count,
        action: d.consensus_action,
      };
    });
  }, [data]);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />

          {/* Quadrant backgrounds */}
          <ReferenceArea x1={50} x2={100} y1={0} y2={30} fill={QUADRANT_BG.leading} fillOpacity={0.35} stroke="none" label={{ value: "Leading", position: "insideTopRight", fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={50} x2={100} y1={-30} y2={0} fill={QUADRANT_BG.weakening} fillOpacity={0.35} stroke="none" label={{ value: "Weakening", position: "insideBottomRight", fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={0} x2={50} y1={-30} y2={0} fill={QUADRANT_BG.lagging} fillOpacity={0.35} stroke="none" label={{ value: "Lagging", position: "insideBottomLeft", fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea x1={0} x2={50} y1={0} y2={30} fill={QUADRANT_BG.improving} fillOpacity={0.35} stroke="none" label={{ value: "Improving", position: "insideTopLeft", fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 600 }} />

          <ReferenceLine x={50} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="4 4" />

          <XAxis
            type="number"
            dataKey="x"
            name="Median RS Rank"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
            axisLine={{ stroke: "var(--border-default)" }}
            tickLine={false}
            label={{ value: "Median RS Rank", position: "insideBottom", offset: -10, style: { fontSize: 11, fill: "var(--text-tertiary)" } }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Median 3M Return (%)"
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
            axisLine={{ stroke: "var(--border-default)" }}
            tickLine={false}
            domain={[-30, 30]}
            label={{ value: "Median 3M Return (%)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "var(--text-tertiary)" } }}
          />
          <ZAxis type="number" dataKey="z" range={[30, 300]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0].payload as typeof normalized[0];
              return (
                <div
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>{p.label}</div>
                  <div style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    Members: {p.count}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    Median RS: {p.x.toFixed(1)}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    Median 3M Return: {p.rawY.toFixed(2)}%
                  </div>
                  {p.action && (
                    <div style={{ color: "var(--text-tertiary)", marginTop: "2px", textTransform: "uppercase", fontSize: "11px", fontWeight: 600 }}>
                      {p.action}
                    </div>
                  )}
                </div>
              );
            }}
          />



          <Scatter data={normalized}>
            {normalized.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.7} stroke={entry.color} strokeWidth={1} onClick={() => onBubbleClick?.(entry.key)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
