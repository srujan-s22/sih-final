import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Unable to load information",
  message = "An error occurred while loading this section. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-xl border border-rose-200 bg-rose-50/40",
        className
      )}
      role="alert"
    >
      <div className="mb-3.5 p-3 rounded-full bg-rose-100 text-rose-700">
        <AlertCircle className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
        {title}
      </h3>
      <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-md leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <div className="mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-xs font-semibold text-slate-800 bg-white border-slate-300 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </div>
  );
}
