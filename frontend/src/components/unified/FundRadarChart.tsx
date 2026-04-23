"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RadarDataPoint {
  factor: string;
  fund: number;
  median: number | null;
}

interface FundRadarChartProps {
  data: RadarDataPoint[];
  height?: number;
}

export default function FundRadarChart({ data, height = 320 }: FundRadarChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="var(--border-default)" />
          <PolarAngleAxis
            dataKey="factor"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
            tickCount={6}
            stroke="var(--border-subtle)"
          />
          <Radar
            name="This Fund"
            dataKey="fund"
            stroke="var(--accent-700)"
            fill="var(--accent-700)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          {data.some((d) => d.median !== null) && (
            <Radar
              name="Category Median"
              dataKey="median"
              stroke="var(--text-tertiary)"
              fill="var(--text-tertiary)"
              fillOpacity={0.05}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
