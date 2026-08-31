import React from "react";
import { cn } from "@/lib/utils";
import { BadgeVariant } from "@/types/ui";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const baseStyles =
    "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] sm:text-xs font-semibold transition-colors border select-none";

  const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-teal-50 text-teal-800 border-teal-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    error: "bg-rose-50 text-rose-800 border-rose-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    urgent: "bg-rose-100 text-rose-900 border-rose-300 font-bold",
  };

  return (
    <span className={cn(baseStyles, variantStyles[variant], className)} {...props}>
      {children}
    </span>
  );
}
