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


# ---------------------------------------------------------------------------
# Core narrative generator
# ---------------------------------------------------------------------------


def generate_narrative(
    metrics_dict: dict[str, Any],
    regime_dict: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate a deterministic narrative block from raw metrics + regime.

    Args:
        metrics_dict: Flat dict of metric values (rs_nifty_3m_rank, ret_3m, etc.).
        regime_dict: Optional market regime dict (regime, direction, health_zone, etc.).

    Returns:
        {"verdict": str, "reasons": [...], "risks": [...],
         "technical_snapshot": str, "recommended_action": str}
    """
    rs_3m = _safe_float(metrics_dict.get("rs_nifty_3m_rank"))
    rs_12m = _safe_float(metrics_dict.get("rs_nifty_12m_rank"))
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
    persistence = _safe_float(metrics_dict.get("rs_nifty_persistence"))
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
            f"RS 3-month rank is strong at {_fmt_num(rs_3m)} (top quartile vs Nifty)."
        )
    elif rs_3m is not None and rs_3m <= _RS_RANK_WEAK:
        risks.append(
            f"RS 3-month rank is weak at {_fmt_num(rs_3m)} (bottom quartile vs Nifty)."
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
    if state == "LEADER":
        reasons.append("Instrument is classified as LEADER — top quintile RS with positive momentum.")
    elif state == "EMERGING":
        reasons.append("Instrument is EMERGING — improving RS trajectory, early stage.")
    elif state == "WEAKENING":
        risks.append("Instrument is WEAKENING — RS is deteriorating; monitor closely.")
    elif state == "LAGGING":
        risks.append("Instrument is LAGGING — persistent underperformer.")
    elif state == "BROKEN":
        risks.append("Instrument is BROKEN — structural damage in trend; avoid fresh entry.")

    # --- Regime context ---
    if regime == "BULLISH_FULL_RISK":
        reasons.append("Market regime is BULLISH_FULL_RISK — broad participation supports risk-on positioning.")
    elif regime == "CAUTION_SELECTIVE":
        reasons.append("Market regime is CAUTION_SELECTIVE — stock picking matters more than beta.")
    elif regime == "CAUTION_DEFENSIVE":
        risks.append("Market regime is CAUTION_DEFENSIVE — raise cash and favour quality.")
    elif regime == "BEARISH_ACCUMULATE":
        reasons.append("Market regime is BEARISH_ACCUMULATE — long-term accumulation zones may be forming.")
        risks.append("Short-term downside pressure remains; stagger entries.")

    if direction == "DETERIORATING":
        risks.append("Market direction is deteriorating — breadth is weakening.")
    elif direction == "ACCELERATING":
        reasons.append("Market direction is accelerating — breadth is expanding.")

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

    technical_snapshot = (
        f"Trend is {trend_phrase}. "
        f"RS 3m / 12m rank: {_fmt_num(rs_3m)} / {_fmt_num(rs_12m)}. "
        f"Returns (3m / 12m): {_fmt_pct(ret_3m)} / {_fmt_pct(ret_12m)}. "
        f"RSI-14: {_fmt_num(rsi)}. "
        f"Fragility: {_fmt_num(frag_score)} ({frag_level or 'unknown'}). "
        f"Max DD: {_fmt_pct(max_dd)}. "
        f"State: {state or 'unknown'}."
    )

    return {
        "verdict": verdict,
        "reasons": reasons if reasons else ["No strong positive signals detected."],
        "risks": risks if risks else ["No acute risks flagged."],
        "technical_snapshot": technical_snapshot,
        "recommended_action": recommended_action,
    }
