import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATLAS Unified — RS Intelligence Engine",
  description: "Relative Strength, Regime, Sector & Fund Intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ background: "var(--bg-app)", color: "var(--text-primary)", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
