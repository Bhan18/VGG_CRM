"use client";

// Shared data fetching for the admin dashboard. Every admin endpoint is
// gated server-side by the attendance-staff-session cookie + ADMIN role.
//
// Backed by TanStack Query: responses are cached for 30s, so switching
// tabs renders instantly from cache (with a background refresh when the
// data goes stale) instead of refetching + flashing skeletons every time.

import { useQuery } from "@tanstack/react-query";

export type AdminFetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

async function fetchAdminJson(url: string): Promise<unknown> {
  const res = await fetch(url, { credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? "Request failed");
  }
  return body;
}

export function useAdminFetch<T>(
  url: string,
  _deps: unknown[] = [],
): AdminFetchState<T> {
  const query = useQuery({
    queryKey: ["admin", url],
    queryFn: () => fetchAdminJson(url),
    staleTime: 30_000,
    retry: 1,
  });

  return {
    data: (query.data as T | undefined) ?? null,
    loading: query.isLoading || query.isFetching,
    error: query.error ? (query.error as Error).message ?? "Could not load data" : null,
    reload: () => {
      void query.refetch();
    },
  };
}
