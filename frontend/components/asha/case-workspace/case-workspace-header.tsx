"use client";

import React from "react";
import Link from "next/link";
import { CaseDetailResponse, CaseStatus, CasePriority } from "@shared/types/case";
import { HouseholdNfcStatusResponse } from "@shared/types/nfc";
import { AshaAssistanceRequest } from "@shared/types/assistance";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bot,
  Radio,
  PhoneCall,
  UserCheck,
  Users,
  MapPin,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";

export interface CaseWorkspaceHeaderProps {
  caseDetail: CaseDetailResponse;
  caseNfcStatus: HouseholdNfcStatusResponse | null;
  selectedRequestContext: AshaAssistanceRequest | null;
  onStatusChange: (status: CaseStatus) => void;
  onPriorityChange: (priority: CasePriority) => void;
  onOpenNfc: () => void;
  onOpenAssistant: () => void;
  onOpenVoiceCall: () => void;
  exitHref: string;
  isUpdating?: boolean;
}

export function CaseWorkspaceHeader({
  caseDetail,
  caseNfcStatus,
  selectedRequestContext,
  onStatusChange,
  onPriorityChange,
  onOpenNfc,
  onOpenAssistant,
  onOpenVoiceCall,
  exitHref,
  isUpdating = false,
}: CaseWorkspaceHeaderProps) {
  const { t } = useTranslation();
  const { case: caseData, household, members } = caseDetail;

  const priorityStyles: Record<CasePriority, { badge: string; dot: string }> = {
    URGENT: {
      badge: "bg-rose-50 text-rose-800 border-rose-200",
      dot: "bg-rose-600",
    },
    HIGH: {
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-600",
    },
    NORMAL: {
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      dot: "bg-slate-500",
    },
    LOW: {
      badge: "bg-slate-50 text-slate-600 border-slate-200",
      dot: "bg-slate-400",
    },
  };

  const getStatusStyle = (status: CaseStatus): string => {
    switch (status) {
      case "RESOLVED":
      case "CLOSED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "NEEDS_ATTENTION":
      case "ESCALATED":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "BLOCKED":
      case "CITIZEN_DECLINED":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "ACTIVE":
      case "ACCEPTED":
      case "IN_PROGRESS":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "FOLLOW_UP":
      case "FOLLOW_UP_REQUIRED":
        return "bg-indigo-50 text-indigo-800 border-indigo-200";
      case "NEW":
      case "REQUESTED":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <header className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* 1. Top Exit Bar & Breadcrumb Navigation */}
      <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={exitHref}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-teal-900 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700 cursor-pointer"
          aria-label={t("asha.exitCaseDetails")}
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>{t("asha.exitCaseDetails")}</span>
        </Link>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <span className="hidden sm:inline">{t("asha.caseWorkspace")}</span>
          <span className="hidden sm:inline">•</span>
          <span className="font-mono text-slate-700 font-semibold truncate max-w-[180px]">
            {caseData.id}
          </span>
        </div>
      </div>

      {/* 2. Main Case Identity & Quick Action Zone */}
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Household Identity */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate max-w-[450px]">
                {household.headOfHouseholdName}
              </h1>

              {/* Priority Indicator Pill */}
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  priorityStyles[caseData.priority]?.badge || "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    priorityStyles[caseData.priority]?.dot || "bg-slate-400"
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {caseData.priority === "URGENT"
                    ? t("forms.priorityUrgent")
                    : caseData.priority === "HIGH"
                    ? t("forms.priorityHigh")
                    : caseData.priority === "LOW"
                    ? t("forms.priorityLow")
                    : t("forms.priorityNormal")}
                </span>
              </span>

              {/* Status Badge */}
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusStyle(
                  caseData.status
                )}`}
              >
                {caseData.status.replace(/_/g, " ")}
              </span>
            </div>

            {/* Context Details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[220px]">
                  {household.village ? `${household.village}, ` : ""}
                  {household.district}, {household.state}
                </span>
              </span>

              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span>
                  {members.length} {members.length === 1 ? "Member" : "Members"}
                </span>
              </span>

              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span>{t("citizen.incomeCategory")}: <strong className="text-slate-700">{household.incomeCategory}</strong></span>
              </span>

              {household.rationCardNumber && (
                <span className="hidden sm:inline font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  RC: {household.rationCardNumber}
                </span>
              )}
            </div>
          </div>

          {/* Action Button Group */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
            {/* Outbound Voice Outreach */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenVoiceCall}
              className="text-xs font-bold border-teal-200 text-teal-900 bg-teal-50/50 hover:bg-teal-100/70 cursor-pointer shadow-2xs"
              title="Initiate doorstep voice reminder call"
            >
              <PhoneCall className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>{t("citizen.voiceCallBtn")}</span>
            </Button>

            {/* NFC Card Management */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenNfc}
              className="text-xs font-bold border-teal-300 text-teal-900 hover:bg-teal-50 cursor-pointer shadow-2xs"
              title={caseNfcStatus?.hasActiveNfc ? "Manage household NFC card" : "Register household NFC card"}
            >
              <Radio className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>
                {caseNfcStatus?.hasActiveNfc
                  ? `NFC (v${caseNfcStatus.record?.version || 1})`
                  : "Register NFC"}
              </span>
            </Button>

            {/* AI Assistant */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenAssistant}
              className="text-xs font-bold border-emerald-300 text-emerald-900 hover:bg-emerald-50 cursor-pointer shadow-2xs"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              <span>{t("assistant.badge")}</span>
            </Button>
          </div>
        </div>

        {/* 3. Live Operational Controls Bar (Inline Status & Priority Selectors) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="case-status-select" className="font-semibold text-slate-600">
                {t("forms.relationship")}:
              </label>
              <select
                id="case-status-select"
                value={caseData.status}
                disabled={isUpdating}
                onChange={(e) => onStatusChange(e.target.value as CaseStatus)}
                className="py-1 px-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 text-xs focus:ring-2 focus:ring-teal-700 focus:outline-hidden cursor-pointer"
              >
                <option value="NEW">New</option>
                <option value="ACTIVE">{t("common.active")}</option>
                <option value="NEEDS_ATTENTION">{t("status.action_required")}</option>
                <option value="FOLLOW_UP">{t("navigation.followUps")}</option>
                <option value="RESOLVED">{t("status.resolved")}</option>
                <option value="CLOSED">{t("status.completed")}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="case-priority-select" className="font-semibold text-slate-600">
                {t("status.urgent")}:
              </label>
              <select
                id="case-priority-select"
                value={caseData.priority}
                disabled={isUpdating}
                onChange={(e) => onPriorityChange(e.target.value as CasePriority)}
                className="py-1 px-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 text-xs focus:ring-2 focus:ring-teal-700 focus:outline-hidden cursor-pointer"
              >
                <option value="LOW">{t("forms.priorityLow")}</option>
                <option value="NORMAL">{t("forms.priorityNormal")}</option>
                <option value="HIGH">{t("forms.priorityHigh")}</option>
                <option value="URGENT">{t("forms.priorityUrgent")}</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            {caseData.lastContactAt ? (
              <span>
                Last contact: {new Date(caseData.lastContactAt).toLocaleDateString()}
              </span>
            ) : (
              <span>Created {new Date(caseData.createdAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Request Context Banner (when navigated from an Assistance Request) */}
      {selectedRequestContext && (
        <div className="px-4 sm:px-6 py-2.5 bg-teal-50/90 border-t border-teal-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-teal-800 text-white tracking-wider">
              {selectedRequestContext.category.replace(/_/g, " ")}
            </span>
            {selectedRequestContext.schemeName && (
              <span className="font-bold text-teal-950">
                {selectedRequestContext.schemeName}
              </span>
            )}
            {selectedRequestContext.beneficiaryName && (
              <span className="text-teal-800 flex items-center gap-1 font-medium">
                • <UserCheck className="w-3.5 h-3.5 text-teal-700 inline" />
                <span>{selectedRequestContext.beneficiaryName}</span>
                {selectedRequestContext.beneficiaryRelationship && (
                  <span className="text-teal-600 text-[11px]">
                    ({selectedRequestContext.beneficiaryRelationship}
                    {selectedRequestContext.beneficiaryAge
                      ? `, ${selectedRequestContext.beneficiaryAge}y`
                      : ""}
                    )
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-teal-700">
            <span className="font-mono">Req #{selectedRequestContext.id.slice(-6)}</span>
            <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-bold uppercase text-[10px]">
              {selectedRequestContext.status}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
