"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export function useApiGet<T>(path: string | null, deps: unknown[] = []) {
  const { accessToken } = useAuth();

  const fetcher = async (url: string) => {
    if (!accessToken) throw new Error("No access token");
    return api.get<T>(url, accessToken);
  };

  const { data, error, mutate, isLoading } = useSWR<T>(
    path && accessToken ? [path, ...deps] : null,
    ([url]) => fetcher(url as string)
  );

  return {
    data: data || null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load") : null,
    refetch: mutate,
  };
}
