import React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "neutral" | "brand" | "success" | "warning" | "error" | "info";
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  variant = "neutral",
  onClick,
  className,
}: MetricCardProps) {
  const variantStyles = {
    neutral: {
      card: "bg-white border-slate-200 hover:border-slate-300",
      label: "text-slate-500",
      icon: "text-slate-400",
      value: "text-slate-900",
      desc: "text-slate-500",
    },
    brand: {
      card: "bg-white border-slate-200 hover:border-teal-300",
      label: "text-teal-800",
      icon: "text-teal-600",
      value: "text-teal-950",
      desc: "text-teal-700",
    },
    success: {
      card: "bg-white border-slate-200 hover:border-emerald-300",
      label: "text-emerald-800",
      icon: "text-emerald-600",
      value: "text-emerald-950",
      desc: "text-emerald-700",
    },
    warning: {
      card: "bg-white border-slate-200 hover:border-amber-300",
      label: "text-amber-800",
      icon: "text-amber-600",
      value: "text-amber-950",
      desc: "text-amber-700",
    },
    error: {
      card: "bg-rose-50/40 border-rose-200 hover:border-rose-300",
      label: "text-rose-800",
      icon: "text-rose-600",
      value: "text-rose-950",
      desc: "text-rose-700",
    },
    info: {
      card: "bg-white border-slate-200 hover:border-blue-300",
      label: "text-blue-800",
      icon: "text-blue-600",
      value: "text-blue-950",
      desc: "text-blue-700",
    },
  };

  const v = variantStyles[variant] || variantStyles.neutral;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 sm:p-5 shadow-2xs transition-all",
        v.card,
        onClick ? "cursor-pointer hover:shadow-xs" : "",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px] font-bold uppercase tracking-wider", v.label)}>
          {label}
        </span>
        {Icon && <Icon className={cn("w-4 h-4 shrink-0", v.icon)} />}
      </div>
      <p className={cn("text-2xl sm:text-3xl font-black mt-1.5", v.value)}>
        {value}
      </p>
      {description && (
        <p className={cn("text-xs mt-0.5 leading-snug", v.desc)}>{description}</p>
      )}
    </div>
  );
}
