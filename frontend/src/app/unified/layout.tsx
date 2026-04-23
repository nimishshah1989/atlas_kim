"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/unified" },
  { label: "Sectors", href: "/unified/sectors" },
  { label: "Funds", href: "/unified/funds" },
  { label: "Leaders", href: "/unified/leaders" },
  { label: "Weakening", href: "/unified/weakening" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/unified") return pathname === "/unified";
  return pathname.startsWith(href);
}

export default function UnifiedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "stretch",
          height: 52,
          padding: "0 24px",
          gap: "16px",
        }}
      >
        <Link
          href="/unified"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            marginRight: "8px",
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          atlas<strong style={{ fontWeight: 600, color: "var(--accent-700)" }}>.</strong>
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Unified
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "stretch", flex: 1, gap: 0 }} aria-label="Unified navigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--accent-700)" : "var(--text-secondary)",
                  padding: "0 14px",
                  borderBottom: active ? "2px solid var(--accent-700)" : "2px solid transparent",
                  marginBottom: -1,
                  textDecoration: "none",
                  transition: "color 100ms, background 100ms",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main style={{ flex: 1, padding: "24px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        {children}
      </main>
    </div>
  );
}
