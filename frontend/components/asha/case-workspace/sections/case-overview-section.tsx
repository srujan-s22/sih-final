"use client";

import React from "react";
import { CaseDetailResponse } from "@shared/types/case";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { CaseWorkspaceSection } from "../case-workspace-nav";
import { getLocalizedStatus } from "../formatters";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  MapPin,
  Phone,
  Clock,
  Sparkles,
  Activity,
} from "lucide-react";

export interface CaseOverviewSectionProps {
  caseDetail: CaseDetailResponse;
  onNavigateSection: (section: CaseWorkspaceSection) => void;
  onInitiateScheme?: (schemeId: string, beneficiaryId?: string) => void;
}

export function CaseOverviewSection({
  caseDetail,
  onNavigateSection,
}: CaseOverviewSectionProps) {
  const { t } = useTranslation();
  const { case: caseData, household, members, guidance, tasks, followUps } = caseDetail;

  const activeTasks = tasks.filter((t) => t.status !== "COMPLETED");
  const urgentGaps = guidance.gaps.filter(
    (g) => g.priority === "REQUIRED" || g.priority === "IMPORTANT"
  );
  const pendingFollowUps = followUps.filter((f) => f.status === "PENDING");
  const nextFollowUp = pendingFollowUps[0];

  return (
    <div className="space-y-6">
      {/* Overview Grid (4 Key Operational Questions) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ============================================================ */}
        {/* 1. Who is this household?                                    */}
        {/* ============================================================ */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>1. {t("asha.householdSummary")}</span>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {household.incomeCategory}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {household.headOfHouseholdName}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {household.village ? `${household.village}, ` : ""}
                  {household.district}, {household.state}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  {t("common.members")}
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {members.length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  {t("citizen.contactPhone")}
                </span>
                <span className="font-semibold text-slate-800 text-xs truncate block">
                  {household.contactPhone || t("common.notAvailable")}
                </span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigateSection("household")}
            className="w-full text-xs font-semibold text-teal-900 border-slate-200 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
          >
            <span>{t("citizen.householdInfo")}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>

        {/* ============================================================ */}
        {/* 2. What is current case/journey status?                      */}
        {/* ============================================================ */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>2. {t("asha.currentJourneyStatus")}</span>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {getLocalizedStatus(caseData.status, t)}
              </span>
            </div>

            {caseData.schemeName || caseData.schemeId ? (
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                    {t("asha.activeHealthScheme")}
                  </span>
                  <h3 className="text-base font-bold text-teal-950 leading-snug">
                    {caseData.schemeName || caseData.schemeId}
                  </h3>
                  {caseData.beneficiaryName && (
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                      <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                      <span>{t("asha.assistingBeneficiary")}: {caseData.beneficiaryName}</span>
                    </p>
                  )}
                </div>

                {/* Journey Milestone Indicator */}
                {caseDetail.journeySteps && caseDetail.journeySteps.length > 0 && (
                  <div className="p-2.5 bg-teal-50/60 rounded-xl border border-teal-100 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-teal-900 font-bold">
                      <span>{t("asha.milestoneProgress")}</span>
                      <span>
                        {caseDetail.journeySteps.filter((s) => s.status === "COMPLETED").length} /{" "}
                        {caseDetail.journeySteps.length}
                      </span>
                    </div>
                    <div className="w-full bg-teal-200/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-teal-700 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            (caseDetail.journeySteps.filter((s) => s.status === "COMPLETED").length /
                              caseDetail.journeySteps.length) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">{t("asha.noActiveSchemeJourney")}</p>
                <p className="text-[11px] text-slate-500">
                  {t("asha.selectEligibleSchemePrompt")}
                </p>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigateSection("journey")}
            className="w-full text-xs font-semibold text-teal-900 border-slate-200 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
          >
            <span>{t("asha.activeJourney")}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>

        {/* ============================================================ */}
        {/* 3. Is anything urgent?                                       */}
        {/* ============================================================ */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <span>3. {t("asha.urgentAttention")}</span>
              </span>
              {urgentGaps.length > 0 ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                  {urgentGaps.length} Gaps
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {t("forms.priorityNormal")}
                </span>
              )}
            </div>

            {urgentGaps.length > 0 ? (
              <div className="space-y-2">
                {urgentGaps.slice(0, 2).map((gap, gIdx) => (
                  <div
                    key={gap.id || gIdx}
                    className="p-3 bg-rose-50/40 border border-rose-200 rounded-xl text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-900">
                        {gap.title || gap.description}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 uppercase">
                        {gap.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-1">{gap.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 text-xs text-emerald-900 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">{t("asha.noGapsDetected")}</p>
                  <p className="text-[11px] text-emerald-700">
                    {t("asha.allMembersCovered")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigateSection("attention")}
            className="w-full text-xs font-semibold text-teal-900 border-slate-200 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
          >
            <span>{t("asha.attentionRequired")}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>

        {/* ============================================================ */}
        {/* 4. What needs to happen next?                                */}
        {/* ============================================================ */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>4. {t("asha.nextActions")}</span>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {activeTasks.length} Pending
              </span>
            </div>

            {nextFollowUp ? (
              <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  {t("asha.scheduledVisit")}
                </span>
                <p className="font-bold text-slate-900">{nextFollowUp.title || nextFollowUp.reason}</p>
                <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-0.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>Due: {new Date(nextFollowUp.dueAt || nextFollowUp.scheduledAt).toLocaleDateString()}</span>
                </div>
              </div>
            ) : activeTasks.length > 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t("asha.nextMilestoneTask")}
                </span>
                <p className="font-bold text-slate-900">{activeTasks[0].title}</p>
                <p className="text-[11px] text-slate-600 line-clamp-1">{activeTasks[0].description}</p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 text-center space-y-1">
                <p className="font-bold text-slate-700">{t("asha.allTasksUpToDate")}</p>
                <p className="text-[11px] text-slate-500">{t("asha.scheduleVisitPrompt")}</p>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigateSection("tasks")}
            className="w-full text-xs font-semibold text-teal-900 border-slate-200 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
          >
            <span>{t("asha.dueFollowUps")}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>
      </div>
    </div>
  );
}
