"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/services/api-client";
import { HealthCheckResponse } from "@shared/types/api";

export interface HealthState {
  isLoading: boolean;
  isReachable: boolean;
  data: HealthCheckResponse | null;
  error: string | null;
  lastChecked: Date | null;
}

export function useHealthCheck(pollIntervalMs = 0) {
  const [state, setState] = useState<HealthState>({
    isLoading: true,
    isReachable: false,
    data: null,
    error: null,
    lastChecked: null,
  });

  const check = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const result = await apiClient.checkHealth();
    if (result.success) {
      setState({
        isLoading: false,
        isReachable: true,
        data: result.data,
        error: null,
        lastChecked: new Date(),
      });
    } else {
      setState({
        isLoading: false,
        isReachable: false,
        data: null,
        error: result.error.message,
        lastChecked: new Date(),
      });
    }
  }, []);

  useEffect(() => {
    check();
    if (pollIntervalMs > 0) {
      const interval = setInterval(check, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [check, pollIntervalMs]);

  return { ...state, refetch: check };
}
