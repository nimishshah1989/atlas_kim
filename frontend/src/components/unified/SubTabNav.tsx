"use client";

interface SubTabNavProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function SubTabNav({ tabs, activeTab, onTabChange }: SubTabNavProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
              background: "transparent",
              border: "none",
              borderBottom: isActive ? "2px solid var(--accent-700)" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: "-1px",
              transition: "color 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
