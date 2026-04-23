const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""; // relative paths — nginx or next rewrite handles routing

export interface AtlasMeta {
  data_as_of?: string;
  record_count: number;
  query_ms?: number;
  cache_hit?: boolean;
  tenant_id: string;
}

export class AtlasApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AtlasApiError";
    this.code = code;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  let url = `${API_BASE}${endpoint}`;
  if (params && Object.keys(params).length > 0) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url = `${url}?${qs}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      const e = err as Error;
      if (e.name === "AbortError") {
        throw new AtlasApiError("TIMEOUT", "Request timed out after 15 seconds");
      }
      throw new AtlasApiError("NETWORK_ERROR", e.message || "Network error");
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new AtlasApiError(
        `HTTP_${res.status}`,
        `Server returned ${res.status} ${res.statusText}`
      );
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface InstrumentIdentity {
  instrument_id: string;
  symbol: string;
  name: string;
  instrument_type: string;
  sector: string | null;
  industry: string | null;
  country: string;
  exchange: string | null;
  cap_category: string | null;
  mf_category: string | null;
  is_active: boolean;
}

export interface MetricSnapshot {
  date: string;
  ret_1d: number | null;
  ret_1w: number | null;
  ret_1m: number | null;
  ret_3m: number | null;
  ret_6m: number | null;
  ret_12m: number | null;
  ema_20: number | null;
  ema_50: number | null;
  ema_200: number | null;
  above_ema_20: boolean | null;
  above_ema_50: boolean | null;
  golden_cross: boolean | null;
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  vol_21d: number | null;
  max_dd_252d: number | null;
  rs_nifty_1d_rank: number | null;
  rs_nifty_1w_rank: number | null;
  rs_nifty_1m_rank: number | null;
  rs_nifty_3m_rank: number | null;
  rs_nifty_6m_rank: number | null;
  rs_nifty_12m_rank: number | null;
  rs_nifty_24m_rank: number | null;
  rs_nifty_36m_rank: number | null;
  rs_nifty500_3m_rank: number | null;
  rs_nifty500_12m_rank: number | null;
  rs_sp500_3m_rank: number | null;
  rs_sp500_12m_rank: number | null;
  rs_msci_3m_rank: number | null;
  rs_msci_12m_rank: number | null;
  rs_gold_3m_rank: number | null;
  rs_gold_12m_rank: number | null;
  state: string | null;
  action: string | null;
  action_confidence: number | null;
  frag_score: number | null;
  frag_level: string | null;
}

export interface NarrativeBlock {
  verdict: string;
  reasons: string[];
  risks: string[];
  technical_snapshot: string;
  recommended_action: string;
}

export interface SnapshotResponse {
  instrument: InstrumentIdentity;
  metrics: MetricSnapshot;
  narrative: NarrativeBlock | null;
  meta: AtlasMeta;
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export interface CohortPoint {
  cohort_key: string;
  cohort_label?: string | null;
  member_count: number;
  median_rs_rank: number | null;
  median_ret_3m: number | null;
  median_ret_12m: number | null;
  pct_above_ema_50: number | null;
  pct_leader_state: number | null;
  avg_frag_score: number | null;
  consensus_action: string | null;
  action_confidence: number | null;
  bubble_x: number | null;
  bubble_y: number | null;
  bubble_size: number | null;
  bubble_color: string | null;
}

export interface AggregateResponse {
  cohort_type: string;
  benchmark: string;
  period: string;
  points: CohortPoint[];
  meta: AtlasMeta;
}

// ---------------------------------------------------------------------------
// Screener
// ---------------------------------------------------------------------------

export interface ScreenerRow {
  instrument_id: string;
  symbol: string;
  name: string;
  instrument_type: string;
  sector: string | null;
  cap_category: string | null;
  mf_category: string | null;
  state: string | null;
  action: string | null;
  action_confidence: number | null;
  rs_nifty_3m_rank: number | null;
  rs_nifty_12m_rank: number | null;
  ret_3m: number | null;
  ret_12m: number | null;
  rsi_14: number | null;
  frag_score: number | null;
  above_ema_50: boolean | null;
}

export interface ScreenerRequest {
  filters: { field: string; op: string; value: unknown }[];
  sort_field?: string | null;
  sort_direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
  include_narrative?: boolean;
}

export interface ScreenerResponse {
  rows: ScreenerRow[];
  total_count: number;
  meta: AtlasMeta;
}

// ---------------------------------------------------------------------------
// Regime
// ---------------------------------------------------------------------------

export interface RegimeMetrics {
  date: string;
  pct_above_ema_20: number | null;
  pct_above_ema_50: number | null;
  pct_above_ema_200: number | null;
  pct_golden_cross: number | null;
  participation: number | null;
  rs_dispersion: number | null;
  health_score: number | null;
  health_zone: string | null;
}

export interface RegimeResponse {
  regime: string | null;
  direction: string | null;
  metrics: RegimeMetrics;
  narrative: NarrativeBlock | null;
  meta: AtlasMeta;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export async function getSnapshot(instrumentId: string) {
  return apiFetch<SnapshotResponse>(`/api/unified/snapshot/${instrumentId}`);
}

export async function getAggregate(cohort: string, benchmark = "nifty", period = "3m") {
  return apiFetch<AggregateResponse>("/api/unified/aggregate", { cohort_type: cohort, benchmark, period });
}

export async function postApi<T>(endpoint: string, body: unknown): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new AtlasApiError(`HTTP_${res.status}`, `Server returned ${res.status}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export async function runScreen(body: ScreenerRequest) {
  return postApi<ScreenerResponse>("/api/unified/screen", body);
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases (pages still reference these)
// ---------------------------------------------------------------------------

export type RegimeData = RegimeResponse;
export type AggregateData = AggregateResponse;
export type ScreenData = ScreenerResponse;
export type ScreenResult = ScreenerRow;
export type SnapshotData = SnapshotResponse;

export interface FundSummary {
  id: string;
  scheme_name: string;
  amc: string;
  category: string;
  aum_cr: number | null;
  nav: number | null;
  rs_composite: number | null;
  rs_momentum: number | null;
  action: string;
  confidence: number;
}

export interface FundXray {
  id: string;
  scheme_name: string;
  amc: string;
  category: string;
  aum_cr: number | null;
  nav: number | null;
  rs_composite: number | null;
  rs_momentum: number | null;
  action: string;
  confidence: number;
  top_holdings: { symbol: string; name: string; weight_pct: number }[];
  sector_exposure: { sector: string; weight_pct: number }[];
  lookthrough_rs: number | null;
  narrative: string | null;
}

export interface SectorAggregate {
  sector: string;
  stock_count: number;
  avg_rs_composite: number | null;
  avg_rs_momentum: number | null;
  avg_frag_level: number | null;
  breadth_pct: number | null;
}

export interface SectorDetail {
  sector: string;
  stocks: ScreenResult[];
  aggregate: SectorAggregate;
}

// Helpers that pages still import
export async function getFunds() {
  return apiFetch<FundSummary[]>("/api/unified/funds");
}

export async function getFundXray(fundId: string) {
  return apiFetch<FundXray>(`/api/unified/funds/${fundId}`);
}

export async function getSectors() {
  return apiFetch<SectorAggregate[]>("/api/unified/sectors");
}

export async function getSectorDetail(sectorName: string) {
  return apiFetch<SectorDetail>(`/api/unified/sectors/${encodeURIComponent(sectorName)}`);
}

export async function getRegime() {
  return apiFetch<RegimeResponse>("/api/unified/regime");
}
