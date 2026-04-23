"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { apiFetch, postApi, AtlasMeta, AtlasApiError } from "@/lib/api-unified";

type DataState = "loading" | "ready" | "stale" | "empty" | "error";

export interface UseUnifiedResult<T> {
  data: T | null;
  meta: AtlasMeta | null;
  state: DataState;
  error: AtlasApiError | null;
  isLoading: boolean;
  mutate: () => void;
}

function hasData(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => k !== "meta");
  if (keys.length === 0) return false;
  const first = obj[keys[0]];
  if (Array.isArray(first)) return first.length > 0;
  return first !== undefined && first !== null;
}

function computeState<T>(
  swrData: { data: T; meta: AtlasMeta } | undefined,
  swrError: unknown,
  isValidating: boolean
): DataState {
  if (swrError) return "error";
  if (!swrData && isValidating) return "loading";
  if (!swrData) return "loading";
  if (!hasData(swrData.data)) return "empty";
  return "ready";
}

export function useUnifiedData<T>(
  endpoint: string | null,
  params?: Record<string, string | number | boolean | undefined>,
  options?: SWRConfiguration
): UseUnifiedResult<T> {
  const key = endpoint ? [endpoint, JSON.stringify(params ?? {})] : null;

  const fetcher = async ([ep, p]: [string, string]) => {
    const parsedParams = p
      ? (JSON.parse(p) as Record<string, string | number | boolean | undefined>)
      : undefined;
    const raw = (await apiFetch<Record<string, unknown>>(ep, parsedParams)) as Record<string, unknown>;
    const meta = (raw.meta ?? { data_as_of: undefined, record_count: 0, tenant_id: "default" }) as AtlasMeta;
    // Strip meta from data payload
    const { meta: _m, ...data } = raw;
    return { data: data as unknown as T, meta };
  };

  const { data: swrData, error: swrError, isValidating, mutate } = useSWR<
    { data: T; meta: AtlasMeta },
    unknown
  >(key, fetcher, options);

  const state = computeState<T>(swrData, swrError, isValidating);

  const error =
    swrError instanceof AtlasApiError
      ? swrError
      : swrError instanceof Error
      ? new AtlasApiError("UNKNOWN", swrError.message)
      : swrError
      ? new AtlasApiError("UNKNOWN", String(swrError))
      : null;

  return {
    data: swrData?.data ?? null,
    meta: swrData?.meta ?? null,
    state,
    error,
    isLoading: state === "loading",
    mutate: () => mutate(),
  };
}

export function useUnifiedDataPost<T>(
  endpoint: string | null,
  body?: unknown,
  options?: SWRConfiguration
): UseUnifiedResult<T> {
  const key = endpoint ? [endpoint, JSON.stringify(body ?? {})] : null;

  const fetcher = async ([ep, b]: [string, string]) => {
    const parsedBody = b ? JSON.parse(b) : undefined;
    const raw = (await postApi<Record<string, unknown>>(ep, parsedBody)) as Record<string, unknown>;
    const meta = (raw.meta ?? { data_as_of: undefined, record_count: 0, tenant_id: "default" }) as AtlasMeta;
    const { meta: _m, ...data } = raw;
    return { data: data as unknown as T, meta };
  };

  const { data: swrData, error: swrError, isValidating, mutate } = useSWR<
    { data: T; meta: AtlasMeta },
    unknown
  >(key, fetcher, options);

  const state = computeState<T>(swrData, swrError, isValidating);

  const error =
    swrError instanceof AtlasApiError
      ? swrError
      : swrError instanceof Error
      ? new AtlasApiError("UNKNOWN", swrError.message)
      : swrError
      ? new AtlasApiError("UNKNOWN", String(swrError))
      : null;

  return {
    data: swrData?.data ?? null,
    meta: swrData?.meta ?? null,
    state,
    error,
    isLoading: state === "loading",
    mutate: () => mutate(),
  };
}
