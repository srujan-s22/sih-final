import React from "react";
import { Badge } from "@/components/ui/badge";
import { StatusType } from "@/types/ui";

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const configs: Record<
    StatusType,
    {
      variant: "success" | "warning" | "error" | "info" | "neutral" | "urgent";
      defaultLabel: string;
      dotColor: string;
    }
  > = {
    verified: {
      variant: "success",
      defaultLabel: "Coverage Verified",
      dotColor: "bg-emerald-600",
    },
    completed: {
      variant: "success",
      defaultLabel: "Completed",
      dotColor: "bg-emerald-600",
    },
    operational: {
      variant: "success",
      defaultLabel: "Operational",
      dotColor: "bg-emerald-600",
    },
    pending: {
      variant: "warning",
      defaultLabel: "Verification Pending",
      dotColor: "bg-amber-600",
    },
    action_required: {
      variant: "warning",
      defaultLabel: "Action Required",
      dotColor: "bg-amber-600",
    },
    gap: {
      variant: "error",
      defaultLabel: "Access Gap Identified",
      dotColor: "bg-rose-600",
    },
    blocked: {
      variant: "error",
      defaultLabel: "Blocked / Escalated",
      dotColor: "bg-rose-600",
    },
    inactive: {
      variant: "neutral",
      defaultLabel: "Inactive",
      dotColor: "bg-slate-400",
    },
  };

  const config = configs[status] || configs.inactive;

  return (
    <Badge variant={config.variant} className={className}>
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${config.dotColor}`}
        aria-hidden="true"
      />
      <span>{label || config.defaultLabel}</span>
    </Badge>
  );
}
