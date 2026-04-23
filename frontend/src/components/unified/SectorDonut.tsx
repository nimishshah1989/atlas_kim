"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SectorDonutProps {
  sectors: Record<string, number> | null;
  height?: number;
}

const SECTOR_COLORS = [
  "var(--accent-700)",
  "var(--accent-500)",
  "var(--accent-300)",
  "var(--rag-green-500)",
  "var(--rag-amber-500)",
  "var(--rag-red-500)",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F97316",
];

export default function SectorDonut({ sectors, height = 280 }: SectorDonutProps) {
  const data = useMemo(() => {
    if (!sectors) return [];
    return Object.entries(sectors)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [sectors]);

  if (data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-tertiary)",
          fontSize: "13px",
        }}
      >
        No sector data available
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            stroke="var(--bg-surface)"
            strokeWidth={2}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0];
              return (
                <div
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                    {p.name}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    {typeof p.value === "number" ? `${p.value.toFixed(2)}%` : p.value}
                  </div>
                </div>
              );
            }}
          />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ fontSize: "11px", color: "var(--text-secondary)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
