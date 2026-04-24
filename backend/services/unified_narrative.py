"""Deterministic narrative engine for the Unified RS Intelligence Engine.

No LLM. Pure template-based prose generation driven by metric thresholds.
Returns structured JSON: verdict, reasons, risks, technical_snapshot, recommended_action.
"""

from __future__ import annotations

from typing import Any, Optional

import structlog

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Threshold constants
# ---------------------------------------------------------------------------

_RS_RANK_STRONG = 80.0
_RS_RANK_WEAK = 20.0
_RET_STRONG = 10.0
_RET_WEAK = -5.0
_RSI_OVERBOUGHT = 70.0
_RSI_OVERSOLD = 30.0
_FRAG_HIGH = 0.6
_FRAG_CRITICAL = 0.8
_DD_DEEP = -20.0


# ---------------------------------------------------------------------------
# Label humanizers
# ---------------------------------------------------------------------------

_STATE_MAP = {
    "LEADER": "Leader",
    "EMERGING": "Emerging",
    "WEAKENING": "Weakening",
    "LAGGING": "Lagging",
    "BROKEN": "Broken",
    "HOLDING": "Holding",
    "BASE": "Base",
}

_FRAG_LEVEL_MAP = {
    "LOW": "Low",
    "MEDIUM": "Medium",
    "HIGH": "High",
    "CRITICAL": "Critical",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _fmt_pct(value: Optional[float]) -> str:
    if value is None:
        return "N/A"
    return f"{value:+.1f}%"


def _fmt_num(value: Optional[float], prec: int = 1) -> str:
    if value is None:
        return "N/A"
    return f"{value:.{prec}f}"


def _fmt_cr(value: Optional[float]) -> str:
    if value is None:
        return "N/A"
    return f"₹{value:,.1f} Cr"


# ---------------------------------------------------------------------------
# Core narrative generator
# ---------------------------------------------------------------------------


def generate_narrative(
    metrics_dict: dict[str, Any],
    regime_dict: Optional[dict[str, Any]] = None,
    instrument_type: Optional[str] = None,
    lookthrough_dict: Optional[dict[str, Any]] = None,
    factor_dict: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate a deterministic narrative block from raw metrics + context.

    Args:
        metrics_dict: Flat dict of metric values.
        regime_dict: Optional market regime dict.
        instrument_type: EQUITY, MF, ETF, INDEX, INDEX_GLOBAL.
        lookthrough_dict: Optional look-through summary for funds/indices.
        factor_dict: Optional 6-factor percentiles for MFs/ETFs.

    Returns:
        {"verdict": str, "reasons": [...], "risks": [...],
         "technical_snapshot": str, "recommended_action": str}
    """
    rs_3m = _safe_float(metrics_dict.get("rs_nifty_3m_rank") or metrics_dict.get("rs_sp500_3m_rank"))
    rs_12m = _safe_float(metrics_dict.get("rs_nifty_12m_rank") or metrics_dict.get("rs_sp500_12m_rank"))
    ret_3m = _safe_float(metrics_dict.get("ret_3m"))
    ret_12m = _safe_float(metrics_dict.get("ret_12m"))
    rsi = _safe_float(metrics_dict.get("rsi_14"))
    above_ema_20 = metrics_dict.get("above_ema_20")
    above_ema_50 = metrics_dict.get("above_ema_50")
    golden_cross = metrics_dict.get("golden_cross")
    frag_score = _safe_float(metrics_dict.get("frag_score"))
    frag_level = metrics_dict.get("frag_level")
    state = metrics_dict.get("state")
    action = metrics_dict.get("action")
    action_confidence = _safe_float(metrics_dict.get("action_confidence"))
    max_dd = _safe_float(metrics_dict.get("max_dd_252d"))
    current_dd = _safe_float(metrics_dict.get("current_dd"))
    vol_21d = _safe_float(metrics_dict.get("vol_21d"))
    persistence = _safe_float(metrics_dict.get("rs_nifty_persistence") or metrics_dict.get("rs_sp500_persistence"))
    macd = _safe_float(metrics_dict.get("macd"))
    macd_signal = _safe_float(metrics_dict.get("macd_signal"))

    regime = (regime_dict or {}).get("regime") if regime_dict else None
    health_zone = (regime_dict or {}).get("health_zone") if regime_dict else None
    direction = (regime_dict or {}).get("direction") if regime_dict else None

    reasons: list[str] = []
    risks: list[str] = []

    # --- RS reasons / risks ---
    if rs_3m is not None and rs_3m >= _RS_RANK_STRONG:
        reasons.append(
            f"RS 3-month rank is strong at {_fmt_num(rs_3m)} (top quartile vs benchmark)."
        )
    elif rs_3m is not None and rs_3m <= _RS_RANK_WEAK:
        risks.append(
            f"RS 3-month rank is weak at {_fmt_num(rs_3m)} (bottom quartile vs benchmark)."
        )

    if rs_12m is not None and rs_12m >= _RS_RANK_STRONG:
        reasons.append(
            f"RS 12-month rank is robust at {_fmt_num(rs_12m)}, indicating sustained outperformance."
        )
    elif rs_12m is not None and rs_12m <= _RS_RANK_WEAK:
        risks.append(
            f"RS 12-month rank is depressed at {_fmt_num(rs_12m)}, suggesting long-term underperformance."
        )

    if persistence is not None and persistence >= 0.7:
        reasons.append(
            f"RS persistence of {_fmt_num(persistence)} shows consistent relative strength across lookbacks."
        )
    elif persistence is not None and persistence <= 0.3:
        risks.append(
            f"RS persistence of {_fmt_num(persistence)} is low — relative strength is erratic."
        )

    # --- Return reasons / risks ---
    if ret_3m is not None and ret_3m >= _RET_STRONG:
        reasons.append(f"3-month return of {_fmt_pct(ret_3m)} is well above market average.")
    elif ret_3m is not None and ret_3m <= _RET_WEAK:
        risks.append(f"3-month return of {_fmt_pct(ret_3m)} is significantly negative.")

    if ret_12m is not None and ret_12m >= _RET_STRONG:
        reasons.append(f"12-month return of {_fmt_pct(ret_12m)} demonstrates strong trend continuity.")
    elif ret_12m is not None and ret_12m <= _RET_WEAK:
        risks.append(f"12-month return of {_fmt_pct(ret_12m)} reflects prolonged weakness.")

    # --- Trend reasons / risks ---
    if golden_cross is True:
        reasons.append("Golden cross is active (EMA 50 > EMA 200) — medium-term trend is bullish.")
    elif golden_cross is False:
        risks.append("Golden cross is absent (EMA 50 < EMA 200) — medium-term trend remains bearish.")

    if above_ema_50 is True:
        reasons.append("Price is above the 50-day EMA, confirming near-term momentum.")
    elif above_ema_50 is False:
        risks.append("Price is below the 50-day EMA, indicating near-term softness.")

    if above_ema_20 is False:
        risks.append("Price has slipped below the 20-day EMA — short-term pullback in progress.")

    # --- RSI ---
    if rsi is not None and rsi >= _RSI_OVERBOUGHT:
        risks.append(f"RSI-14 at {_fmt_num(rsi)} is overbought; a mean-reversion pullback is possible.")
    elif rsi is not None and rsi <= _RSI_OVERSOLD:
        reasons.append(f"RSI-14 at {_fmt_num(rsi)} is oversold; a bounce could materialise.")

    # --- MACD ---
    if macd is not None and macd_signal is not None:
        if macd > macd_signal:
            reasons.append(f"MACD ({_fmt_num(macd)}) is above signal ({_fmt_num(macd_signal)}) — momentum is positive.")
        else:
            risks.append(f"MACD ({_fmt_num(macd)}) is below signal ({_fmt_num(macd_signal)}) — momentum is negative.")

    # --- Fragility ---
    if frag_level == "CRITICAL" or (frag_score is not None and frag_score >= _FRAG_CRITICAL):
        risks.append(f"Fragility score is critical at {_fmt_num(frag_score)} — high risk of sharp drawdowns.")
    elif frag_level == "HIGH" or (frag_score is not None and frag_score >= _FRAG_HIGH):
        risks.append(f"Fragility score is elevated at {_fmt_num(frag_score)} — exercise caution.")
    elif frag_level == "LOW" or (frag_score is not None and frag_score < 0.3):
        reasons.append(f"Fragility score is low at {_fmt_num(frag_score)} — structure is stable.")

    # --- Drawdown ---
    if current_dd is not None and current_dd <= _DD_DEEP:
        risks.append(f"Current drawdown of {_fmt_pct(current_dd)} is deep — risk management is paramount.")
    if max_dd is not None and max_dd <= _DD_DEEP:
        risks.append(f"Max drawdown over 252 days is {_fmt_pct(max_dd)} — historical tail risk is material.")

    # --- Volatility ---
    if vol_21d is not None and vol_21d > 40.0:
        risks.append(f"21-day realised volatility is very high ({_fmt_num(vol_21d)}%) — position size should be reduced.")
    elif vol_21d is not None and vol_21d < 15.0:
        reasons.append(f"21-day realised volatility is low ({_fmt_num(vol_21d)}%) — calm environment.")

    # --- State / Action ---
    state_label = _STATE_MAP.get(state, state)
    if state == "LEADER":
        reasons.append(f"Instrument is classified as {state_label} — top quintile RS with positive momentum.")
    elif state == "EMERGING":
        reasons.append(f"Instrument is {state_label} — improving RS trajectory, early stage.")
    elif state == "WEAKENING":
        risks.append(f"Instrument is {state_label} — RS is deteriorating; monitor closely.")
    elif state == "LAGGING":
        risks.append(f"Instrument is {state_label} — persistent underperformer.")
    elif state == "BROKEN":
        risks.append(f"Instrument is {state_label} — structural damage in trend; avoid fresh entry.")

    # --- Regime context ---
    _REGIME_MAP = {
        "BULLISH_FULL_RISK": "Bullish (Full Risk)",
        "CAUTION_SELECTIVE": "Caution — Selective",
        "CAUTION_DEFENSIVE": "Caution — Defensive",
        "BEARISH_ACCUMULATE": "Bearish (Accumulate)",
    }
    regime_label = _REGIME_MAP.get(regime, regime)
    if regime == "BULLISH_FULL_RISK":
        reasons.append(f"Market regime is {regime_label} — broad participation supports risk-on positioning.")
    elif regime == "CAUTION_SELECTIVE":
        reasons.append(f"Market regime is {regime_label} — stock picking matters more than beta.")
    elif regime == "CAUTION_DEFENSIVE":
        risks.append(f"Market regime is {regime_label} — raise cash and favour quality.")
    elif regime == "BEARISH_ACCUMULATE":
        reasons.append(f"Market regime is {regime_label} — long-term accumulation zones may be forming.")
        risks.append("Short-term downside pressure remains; stagger entries.")

    if direction == "DETERIORATING":
        risks.append("Market direction is deteriorating — breadth is weakening.")
    elif direction == "ACCELERATING":
        reasons.append("Market direction is accelerating — breadth is expanding.")

    # --- Instrument-type-specific prose ---
    if instrument_type in ("MF", "ETF") and lookthrough_dict:
        lt_rs_3m = _safe_float(lookthrough_dict.get("lookthrough_rs_3m"))
        leader_pct = _safe_float(lookthrough_dict.get("pct_holdings_leader"))
        emerging_pct = _safe_float(lookthrough_dict.get("pct_holdings_emerging"))
        broken_pct = _safe_float(lookthrough_dict.get("pct_holdings_broken"))
        top_sector = lookthrough_dict.get("top_sector")
        num_holdings = lookthrough_dict.get("num_holdings")
        cap_tilt = lookthrough_dict.get("cap_tilt")
        dominant_sectors = lookthrough_dict.get("dominant_sectors")

        if lt_rs_3m is not None:
            if lt_rs_3m >= 75:
                reasons.append(f"Look-through RS 3m is strong at {_fmt_num(lt_rs_3m)} — underlying portfolio is outperforming.")
            elif lt_rs_3m <= 35:
                risks.append(f"Look-through RS 3m is weak at {_fmt_num(lt_rs_3m)} — underlying portfolio is lagging.")

        if leader_pct is not None:
            if leader_pct >= 40:
                reasons.append(f"{_fmt_num(leader_pct)}% of holdings are in Leader state — high-quality underlying exposure.")
            elif leader_pct <= 10:
                risks.append(f"Only {_fmt_num(leader_pct)}% of holdings are in Leader state — portfolio quality is weak.")

        if broken_pct is not None and broken_pct >= 20:
            risks.append(f"{_fmt_num(broken_pct)}% of holdings are in Broken state — significant portfolio damage.")

        if top_sector:
            reasons.append(f"Top sector exposure is {top_sector}.")

        if cap_tilt:
            reasons.append(f"Portfolio shows a {cap_tilt.lower()}-cap tilt.")

        if num_holdings is not None:
            if num_holdings <= 30:
                reasons.append(f"Concentrated portfolio with {num_holdings} holdings — high conviction strategy.")
            elif num_holdings >= 60:
                risks.append(f"Diversified portfolio with {num_holdings} holdings — potential over-diversification.")

        if factor_dict:
            mom = _safe_float(factor_dict.get("factor_momentum_pct"))
            qual = _safe_float(factor_dict.get("factor_quality_pct"))
            res = _safe_float(factor_dict.get("factor_resilience_pct"))
            hold = _safe_float(factor_dict.get("factor_holdings_pct"))
            cost = _safe_float(factor_dict.get("factor_cost_pct"))
            cons = _safe_float(factor_dict.get("factor_consistency_pct"))

            factor_notes = []
            if mom is not None and mom >= 80:
                factor_notes.append("momentum")
            if qual is not None and qual >= 80:
                factor_notes.append("quality")
            if res is not None and res >= 80:
                factor_notes.append("resilience")
            if hold is not None and hold >= 80:
                factor_notes.append("holdings quality")
            if cost is not None and cost >= 80:
                factor_notes.append("cost efficiency")
            if cons is not None and cons >= 80:
                factor_notes.append("consistency")
            if factor_notes:
                reasons.append(f"Top-decile {_fmt_num(len(factor_notes))}-factor strengths: {', '.join(factor_notes)}.")

            er = _safe_float(factor_dict.get("expense_ratio"))
            aum = _safe_float(factor_dict.get("aum_cr"))
            if er is not None:
                if er <= 0.5:
                    reasons.append(f"Expense ratio of {er:.2f}% is attractively low.")
                elif er >= 2.0:
                    risks.append(f"Expense ratio of {er:.2f}% is elevated and will erode long-term returns.")

    elif instrument_type == "INDEX" and lookthrough_dict:
        lt_rs_3m = _safe_float(lookthrough_dict.get("lookthrough_rs_3m"))
        leader_pct = _safe_float(lookthrough_dict.get("pct_holdings_leader"))
        num_holdings = lookthrough_dict.get("num_holdings")

        if lt_rs_3m is not None:
            if lt_rs_3m >= 70:
                reasons.append(f"Index look-through RS is healthy at {_fmt_num(lt_rs_3m)} — constituents are outperforming.")
            elif lt_rs_3m <= 40:
                risks.append(f"Index look-through RS is weak at {_fmt_num(lt_rs_3m)} — breadth is poor.")

        if leader_pct is not None:
            if leader_pct >= 30:
                reasons.append(f"{_fmt_num(leader_pct)}% of constituents are in Leader state — broad market health is good.")
            elif leader_pct <= 10:
                risks.append(f"Only {_fmt_num(leader_pct)}% of constituents are leaders — market breadth is narrow.")

        if num_holdings is not None:
            reasons.append(f"Index tracks {num_holdings} constituents.")

    elif instrument_type == "INDEX_GLOBAL":
        rs_msci = _safe_float(metrics_dict.get("rs_msci_3m_rank"))
        rs_sp500 = _safe_float(metrics_dict.get("rs_sp500_3m_rank"))
        if rs_msci is not None and rs_msci >= 70:
            reasons.append(f"Global RS vs MSCI World is strong at {_fmt_num(rs_msci)} — outperforming global peers.")
        elif rs_msci is not None and rs_msci <= 35:
            risks.append(f"Global RS vs MSCI World is weak at {_fmt_num(rs_msci)} — underperforming global peers.")

    # --- Verdict & recommended action ---
    verdict = "NEUTRAL"
    recommended_action = "HOLD"

    positive_signals = len(reasons)
    negative_signals = len(risks)

    if state == "LEADER" and positive_signals >= 3 and negative_signals <= 1:
        verdict = "BULLISH"
        recommended_action = "STRONG_ACCUMULATE" if regime in ("BULLISH_FULL_RISK", "BEARISH_ACCUMULATE") else "ACCUMULATE"
    elif state in ("LEADER", "EMERGING", "HOLDING") and positive_signals >= 2 and negative_signals <= 2:
        verdict = "BULLISH"
        recommended_action = "ACCUMULATE"
    elif state in ("WEAKENING", "LAGGING") and negative_signals >= 3:
        verdict = "BEARISH"
        recommended_action = "EXIT"
    elif state == "BROKEN" or negative_signals >= 4:
        verdict = "BEARISH"
        recommended_action = "AVOID"
    elif negative_signals > positive_signals:
        verdict = "CAUTIOUS"
        recommended_action = "REDUCE"
    elif positive_signals > negative_signals:
        verdict = "BULLISH"
        recommended_action = "ACCUMULATE"

    # Override if explicit action exists with high confidence
    if action and action_confidence is not None and action_confidence >= 0.75:
        recommended_action = action

    # Technical snapshot paragraph
    trend_phrase = "mixed"
    if golden_cross is True and above_ema_50 is True:
        trend_phrase = "strongly bullish"
    elif golden_cross is True:
        trend_phrase = "bullish medium-term, watch short-term"
    elif golden_cross is False and above_ema_50 is False:
        trend_phrase = "bearish"
    elif golden_cross is False and above_ema_50 is True:
        trend_phrase = "bullish short-term, cautious medium-term"

    frag_label = _FRAG_LEVEL_MAP.get(frag_level, frag_level)
    state_label = _STATE_MAP.get(state, state)
    technical_snapshot = (
        f"The trend is {trend_phrase}. "
        f"RS rank stands at {_fmt_num(rs_3m)} over 3 months and {_fmt_num(rs_12m)} over 12 months. "
        f"Returns are {_fmt_pct(ret_3m)} (3m) and {_fmt_pct(ret_12m)} (12m). "
        f"RSI-14 is {_fmt_num(rsi)}. "
        f"Fragility score is {_fmt_num(frag_score)} ({frag_label or 'unknown'}). "
        f"Max drawdown over 252 days is {_fmt_pct(max_dd)}. "
        f"Current state is {state_label or 'unknown'}."
    )

    return {
        "verdict": verdict,
        "reasons": reasons if reasons else ["No strong positive signals detected."],
        "risks": risks if risks else ["No acute risks flagged."],
        "technical_snapshot": technical_snapshot,
        "recommended_action": recommended_action,
    }
