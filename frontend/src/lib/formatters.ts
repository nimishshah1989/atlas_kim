/**
 * Humanize ALL_CAPS regime labels into proper case natural language.
 */
export function humanizeRegime(regime: string | null | undefined): string {
  if (!regime) return "Unknown";
  const map: Record<string, string> = {
    CAUTION_DEFENSIVE: "Caution — Defensive",
    BULLISH_FULL_RISK: "Bullish (Full Risk)",
    BEARISH_ACCUMULATE: "Bearish — Accumulate",
    CAUTION_SELECTIVE: "Caution — Selective",
    RISK_ON: "Risk On",
    RISK_OFF: "Risk Off",
    DISTRIBUTION: "Distribution",
    ACCUMULATION: "Accumulation",
    UNKNOWN: "Unknown",
  };
  return map[regime] ?? regime
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
