import { ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success";

export type ButtonSize = "sm" | "md" | "lg";

export type BadgeVariant =
  | "default"
  | "neutral"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "urgent";

export type StatusType =
  | "verified"
  | "pending"
  | "gap"
  | "action_required"
  | "inactive"
  | "completed"
  | "blocked"
  | "operational";

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}
