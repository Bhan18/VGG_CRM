"use client";

// Shared data fetching for the admin dashboard. Every admin endpoint is
// gated server-side by the attendance-staff-session cookie + ADMIN role.

import { useCallback, useEffect, useRef, useState } from "react";

export type AdminFetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useAdminFetch<T>(
  url: string,
  deps: unknown[] = [],
): AdminFetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch(url, {
      credentials: "include",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error ?? "Request failed");
        }
        if (active.current) {
          setData(body as T);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        if (active.current) {
          setError(e instanceof Error ? e.message : "Could not load data");
          setLoading(false);
        }
      });
    return () => {
      active.current = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload };
}
