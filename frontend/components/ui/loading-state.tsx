import React from "react";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Loading information...",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 md:p-12 text-center",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-teal-700 animate-spin" />
      </div>
      <p className="mt-3 text-sm text-slate-500 font-medium">{message}</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
