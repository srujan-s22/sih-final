"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/i18n-context";

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message,
  className,
}: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-10 text-center",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-teal-700 animate-spin" />
      </div>
      <p className="mt-3 text-xs sm:text-sm text-slate-500 font-medium">{message || t("common.loading")}</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/80", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
