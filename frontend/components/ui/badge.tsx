import React from "react";
import { cn } from "@/lib/utils";
import { BadgeVariant } from "@/types/ui";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const baseStyles =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border";

  const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-teal-50 text-teal-800 border-teal-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-green-50 text-green-800 border-green-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
  };

  return (
    <span className={cn(baseStyles, variantStyles[variant], className)} {...props}>
      {children}
    </span>
  );
}
