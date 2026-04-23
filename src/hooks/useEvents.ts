"use client";

import useSWR from "swr";
import type { ApiResponse, IncidentEvent } from "@/types";
import { CATEGORY_FILTERS, categoryLabel } from "@/lib/constants";
import type { EventCategory } from "@/types";

async function fetcher(url: string): Promise<ApiResponse<IncidentEvent>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return (await response.json()) as ApiResponse<IncidentEvent>;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function useSource(path: string, refreshMs: number) {
  return useSWR<ApiResponse<IncidentEvent>>(path, fetcher, {
    refreshInterval: refreshMs,
    revalidateOnFocus: false,
    shouldRetryOnError: true,
    errorRetryCount: 3,
    dedupingInterval: 10_000,
  });
}

const REFRESH = Object.fromEntries(
  CATEGORY_FILTERS.map((f) => [f.id, f.refreshMs]),
);

export interface UseEventsResult {
  events: IncidentEvent[];
  loading: boolean;
  refreshing: boolean;
  hasSettled: boolean;
  error?: string;
  lastUpdated?: string;
  sources: SourceStatus[];
}

export interface SourceStatus {
  id: EventCategory;
  label: string;
  count: number;
  loading: boolean;
  error?: string;
  fetchedAt?: string;
}

export function useEvents(): UseEventsResult {
  const police = useSource("/api/police", REFRESH.police);
  const fire = useSource("/api/fire", REFRESH.fire);
  const weather = useSource("/api/weather", REFRESH.weather);
  const transit = useSource("/api/transit", REFRESH.transit);
  const bridge = useSource("/api/bridge", REFRESH.bridge);
  const road = useSource("/api/road", REFRESH.road);
  const health = useSource("/api/health", REFRESH.health);
  const waterworks = useSource("/api/waterworks", REFRESH.waterworks);
  const advisories = useSource("/api/advisories", REFRESH.advisories);

  const swrSources = [
    { id: "police", state: police },
    { id: "fire", state: fire },
    { id: "weather", state: weather },
    { id: "transit", state: transit },
    { id: "bridge", state: bridge },
    { id: "road", state: road },
    { id: "health", state: health },
    { id: "waterworks", state: waterworks },
    { id: "advisories", state: advisories },
  ] as const;

  const sourceStates: SourceStatus[] = swrSources.map(({ id, state }) => ({
    id,
    label: categoryLabel(id),
    count: state.data?.data.length ?? 0,
    loading: state.isLoading,
    error:
      state.error instanceof Error ? state.error.message : state.data?.error,
    fetchedAt: state.data?.fetchedAt,
  }));

  const loading = sourceStates.every(
    (source) =>
      source.loading &&
      !source.error &&
      source.count === 0 &&
      !source.fetchedAt,
  );
  const refreshing = sourceStates.some((source) => source.loading);
  const hasSettled = sourceStates.some(
    (source) =>
      source.count > 0 || Boolean(source.error) || Boolean(source.fetchedAt),
  );

  const errors = sourceStates
    .flatMap((source) =>
      source.error ? [`${source.label}: ${source.error}`] : [],
    )
    .filter(Boolean);

  const allEvents: IncidentEvent[] = swrSources.flatMap(
    ({ state }) => state.data?.data ?? [],
  );

  const fetchedAts = swrSources
    .map(({ state }) => state.data?.fetchedAt)
    .filter(Boolean) as string[];

  const lastUpdated =
    fetchedAts.length > 0
      ? fetchedAts.reduce((a, b) => (a > b ? a : b))
      : undefined;

  return {
    events: allEvents,
    loading,
    refreshing,
    hasSettled,
    error: allEvents.length === 0 && errors.length > 0 ? errors[0] : undefined,
    lastUpdated,
    sources: sourceStates,
  };
}
