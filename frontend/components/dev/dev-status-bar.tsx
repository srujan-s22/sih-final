"use client";

import React, { useState } from "react";
import { env } from "@/config/env";
import { useHealthCheck } from "@/hooks/use-health-check";

/**
 * Development & Operational Diagnostic Indicator.
 * Strictly hidden from citizens in production via NEXT_PUBLIC_SHOW_DEV_DIAGNOSTICS.
 */
export function DevStatusBar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isReachable, isLoading, data, error, lastChecked, refetch } = useHealthCheck(30000);

  if (!env.showDevDiagnostics) {
    return null;
  }

  return (
    <aside
      aria-label="Developer Diagnostics"
      className="fixed bottom-3 right-3 z-50 text-xs font-mono"
    >
      <div className="bg-slate-900 text-slate-100 rounded-lg shadow-xl border border-slate-700 overflow-hidden max-w-xs transition-all">
        <div
          className="px-3 py-2 flex items-center justify-between gap-3 cursor-pointer select-none bg-slate-800 hover:bg-slate-750"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isLoading
                  ? "bg-amber-400 animate-pulse"
                  : isReachable
                  ? "bg-emerald-400"
                  : "bg-rose-400"
              }`}
            />
            <span className="font-semibold text-slate-200">Dev Diagnostics</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {isReachable ? "Backend: OK" : isLoading ? "Checking..." : "Offline"}
          </span>
        </div>

        {isExpanded && (
          <div className="p-3 border-t border-slate-700 space-y-2 bg-slate-900/95">
            <div className="flex justify-between">
              <span className="text-slate-400">Backend:</span>
              <span className={isReachable ? "text-emerald-400" : "text-rose-400"}>
                {isReachable ? "Connected (Fastify)" : "Unreachable"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">API URL:</span>
              <span className="text-slate-200 truncate max-w-[150px]">{env.apiBaseUrl}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Env:</span>
              <span className="text-slate-200">{env.appEnv}</span>
            </div>
            {data && (
              <div className="flex justify-between">
                <span className="text-slate-400">Firebase:</span>
                <span className="text-slate-200">{data.services.firebase}</span>
              </div>
            )}
            {error && (
              <div className="text-rose-300 text-[10px] bg-rose-950/60 p-1.5 rounded border border-rose-800/40">
                {error}
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[10px] text-slate-500">
                {lastChecked ? lastChecked.toLocaleTimeString() : "Pending"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  refetch();
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
              >
                Recheck
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
