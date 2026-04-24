"use client";

import React from "react";

export interface SortableTableColumn<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface SortableTableProps<T> {
  rows: T[];
  columns: SortableTableColumn<T>[];
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string, direction: "asc" | "desc") => void;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
}

export default function SortableTable<T>({
  rows,
  columns,
  sortField,
  sortDirection = "asc",
  onSort,
  onRowClick,
  rowKey,
}: SortableTableProps<T>) {
  const handleHeaderClick = (col: SortableTableColumn<T>) => {
    if (!col.sortable || !onSort) return;
    const nextDirection = sortField === col.key && sortDirection === "asc" ? "desc" : "asc";
    onSort(col.key, nextDirection);
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
            {columns.map((col) => {
              const active = sortField === col.key;
              return (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col)}
                  style={{
                    padding: "8px 12px",
                    textAlign: col.align ?? "left",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                    width: col.width,
                    cursor: col.sortable ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {col.header}
                    {active && (
                      <span style={{ color: "var(--accent-700)", fontSize: "11px" }}>
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              style={{
                borderBottom: "1px solid var(--border-subtle)",
                cursor: onRowClick ? "pointer" : "default",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: "10px 12px",
                    textAlign: col.align ?? "left",
                    color: "var(--text-primary)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
