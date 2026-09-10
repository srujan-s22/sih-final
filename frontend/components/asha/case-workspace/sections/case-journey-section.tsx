"use client";

import React, { useState } from "react";
import { CaseDetailResponse } from "@shared/types/case";
import { AshaAssistanceRequest } from "@shared/types/assistance";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  CheckCircle2,
  PhoneCall,
  UserCheck,
  Send,
  HelpCircle,
  Activity,
  Plus,
  Check,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export interface CaseJourneySectionProps {
  caseDetail: CaseDetailResponse;
  selectedRequestContext: AshaAssistanceRequest | null;
  onInitiateScheme: (caseId: string, schemeId: string, beneficiaryMemberId?: string | null) => void;
  onCompleteTask: (taskId: string, notes?: string) => void;
  onCreateTask: (title: string, description: string) => Promise<void>;
  onOpenVoiceCall: () => void;
  initiatingSchemeId: string | null;
}

export function CaseJourneySection({
  caseDetail,
  selectedRequestContext,
  onInitiateScheme,
  onCompleteTask,
  onCreateTask,
  onOpenVoiceCall,
  initiatingSchemeId,
}: CaseJourneySectionProps) {
  const { t } = useTranslation();
  const { case: caseData, household, members, journeySteps, tasks, eligibilityResults } = caseDetail;

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setIsTaskSubmitting(true);
    try {
      await onCreateTask(newTaskTitle.trim(), newTaskDesc.trim());
      setNewTaskTitle("");
      setNewTaskDesc("");
      setShowAddTask(false);
    } finally {
      setIsTaskSubmitting(false);
    }
  };

  const isSchemeActive = Boolean(caseData.schemeId && caseData.status !== "NEW" && tasks && tasks.length > 0);

  return (
    <div className="space-y-6">
      {/* Selected Request Scheme Mismatch Callout */}
      {selectedRequestContext?.schemeId &&
        caseData.schemeId &&
        selectedRequestContext.schemeId !== caseData.schemeId && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Active Case Scheme vs. Selected Request</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              This master household case currently tracks the active journey for{" "}
              <strong>{caseData.schemeName || caseData.schemeId}</strong>. The selected assistance request is for{" "}
              <strong>{selectedRequestContext.schemeName || selectedRequestContext.schemeId}</strong>
              {selectedRequestContext.beneficiaryName
                ? ` (Beneficiary: ${selectedRequestContext.beneficiaryName})`
                : ""}
              . The milestones and checklist below belong to the case&apos;s active scheme.
            </p>
          </div>
        )}

      {/* 1. When Scheme Assistance is NOT Started */}
      {!isSchemeActive ? (
        <div className="space-y-6">
          {/* Not Started Hero Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-slate-100 text-slate-700 tracking-wider">
                {t("common.pending")}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {t("common.code")}: {caseData.id}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {t("asha.workspaceDesc")}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              {t("citizen.stepGuideTitle")}
            </p>
          </div>

          {/* Actionable Healthcare Opportunities */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              <span>{t("citizen.healthBenefits")}</span>
            </h4>

            {(() => {
              const actionableSchemes = (eligibilityResults || []).filter(
                (r) =>
                  r.status === "ELIGIBLE" ||
                  (r.schemeId === "jsy" &&
                    members.some((m) => m.maternalStatus === "pregnant"))
              );

              if (actionableSchemes.length === 0) {
                return (
                  <div className="p-8 rounded-2xl border border-slate-200 bg-white text-center space-y-2 text-xs text-slate-500 shadow-xs">
                    <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-700">
                      {t("citizen.noSchemesMessage")}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {actionableSchemes.map((scheme) => {
                    const targetMember =
                      scheme.schemeId === "ab-pmjay"
                        ? members.find((m) => m.age >= 70)
                        : scheme.schemeId === "jsy"
                        ? members.find((m) => m.maternalStatus === "pregnant") ||
                          members.find((m) => m.gender === "female" && m.age >= 18)
                        : undefined;

                    const isInitiating =
                      initiatingSchemeId === `${caseData.id}_${scheme.schemeId}`;

                    return (
                      <div
                        key={scheme.schemeId}
                        className="p-5 rounded-2xl border border-teal-200 bg-teal-50/30 space-y-3.5 text-xs shadow-xs flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-bold text-slate-900 text-sm">
                              {scheme.schemeName}
                            </h5>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                              {scheme.status}
                            </span>
                          </div>
                          <p className="text-slate-600 leading-relaxed">
                            {scheme.benefitSummary}
                          </p>

                          {targetMember && (
                            <div className="p-2.5 rounded-xl bg-white border border-teal-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                  Eligible Beneficiary
                                </span>
                                <span className="font-bold text-slate-900">
                                  {targetMember.fullName} ({targetMember.relationship}, Age {targetMember.age}
                                  {targetMember.maternalStatus === "pregnant"
                                    ? ` • ${t("citizen.pregnantTag")}`
                                    : ""}
                                  )
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-teal-100/80 flex justify-end">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={isInitiating}
                            onClick={() =>
                              onInitiateScheme(
                                caseData.id,
                                scheme.schemeId,
                                targetMember?.id
                              )
                            }
                            className="text-xs font-bold py-2 px-4 bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {isInitiating ? t("common.submitting") : t("citizen.requestAssistanceBtn")}
                            </span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* 2. When Scheme Assistance IS Active or Completed */
        <div className="space-y-6">
          {/* Scheme & Beneficiary Summary Card */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                  {t("citizen.healthBenefits")}:
                </span>
                <h3 className="text-base sm:text-lg font-bold text-teal-950">
                  {caseData.schemeName ||
                    (caseData.schemeId === "ab-pmjay"
                      ? "Ayushman Bharat — PM-JAY (Senior 70+)"
                      : caseData.schemeId === "jsy"
                      ? "Janani Suraksha Yojana (JSY)"
                      : caseData.schemeId)}
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onOpenVoiceCall}
                  className="bg-white hover:bg-teal-50 text-teal-900 border-teal-300 text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer py-1.5 px-3"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-teal-700" />
                  <span>{t("citizen.voiceCallBtn")}</span>
                </Button>

                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                    ["RESOLVED", "CLOSED"].includes(caseData.status)
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : "bg-blue-100 text-blue-900 border-blue-300"
                  }`}
                >
                  {["RESOLVED", "CLOSED"].includes(caseData.status) ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>✓ {t("status.resolved")}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      <span>{t("forms.relationship")}: {caseData.status}</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-teal-100">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  Target Beneficiary
                </span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                  <span>{caseData.beneficiaryName || household.headOfHouseholdName}</span>
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-teal-100">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  {t("citizen.headOfHousehold")}
                </span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {household.headOfHouseholdName}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-teal-100">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  {t("citizen.locationDetails")}
                </span>
                <span className="text-slate-800 mt-0.5 block">
                  {household.district}, {household.state}
                </span>
              </div>
            </div>
          </div>

          {/* Scheme Journey Milestones */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-700" />
              <span>{t("citizen.stepGuideTitle")}</span>
            </h4>

            {journeySteps && journeySteps.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {journeySteps.map((step, sIdx) => {
                  const isDone =
                    step.status === "COMPLETED" ||
                    ["RESOLVED", "CLOSED"].includes(caseData.status);
                  const isCurrent =
                    step.status === "CURRENT" &&
                    !["RESOLVED", "CLOSED"].includes(caseData.status);

                  return (
                    <div
                      key={step.stepId || sIdx}
                      className={`p-3.5 rounded-2xl border transition-all text-xs flex flex-col justify-between ${
                        isDone
                          ? "bg-emerald-50/50 border-emerald-300 text-emerald-950 font-semibold"
                          : isCurrent
                          ? "bg-blue-50/60 border-blue-400 text-blue-950 font-bold ring-2 ring-blue-300/70 shadow-xs"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                            Step {sIdx + 1}
                          </span>
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : isCurrent ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full border border-slate-300" />
                          )}
                        </div>
                        <h5 className="font-bold text-xs">{step.title}</h5>
                        <p className="text-[11px] font-normal text-slate-600 mt-1 line-clamp-2">
                          {step.description}
                        </p>
                      </div>
                      {isDone && (
                        <span className="text-[10px] text-emerald-700 mt-2 font-mono">
                          ✓ {t("status.completed")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Field Tasks Checklist */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-teal-700" />
                <span>Field Tasks Checklist ({tasks?.length || 0})</span>
              </h4>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddTask(!showAddTask)}
                className="text-xs font-semibold self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Add Task</span>
              </Button>
            </div>

            {/* Add Custom Task Form */}
            {showAddTask && (
              <form onSubmit={handleTaskSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <h5 className="font-bold text-slate-800">Add Field Task</h5>
                <input
                  type="text"
                  required
                  placeholder="Task title (e.g. Verify voter ID for age confirmation)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
                />
                <input
                  type="text"
                  placeholder="Additional notes / instructions"
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddTask(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isTaskSubmitting || !newTaskTitle.trim()}
                    className="text-xs bg-teal-800 hover:bg-teal-900 text-white"
                  >
                    {isTaskSubmitting ? t("common.submitting") : "Save Task"}
                  </Button>
                </div>
              </form>
            )}

            {/* Task List */}
            {tasks && tasks.length > 0 ? (
              <div className="space-y-2.5">
                {tasks.map((task, tIdx) => {
                  const isDone = task.status === "COMPLETED";

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-xl border transition-all space-y-2 ${
                        isDone
                          ? "bg-emerald-50/30 border-emerald-200 text-slate-700"
                          : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => !isDone && onCompleteTask(task.id)}
                            disabled={isDone}
                            className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                              isDone
                                ? "bg-emerald-600 border-emerald-600 text-white cursor-default"
                                : "border-slate-300 hover:border-emerald-600 hover:bg-emerald-50 text-transparent hover:text-emerald-700 cursor-pointer"
                            }`}
                            aria-label={`Mark task ${task.title} complete`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          <div className="space-y-0.5">
                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                              {tIdx + 1}. {task.title}
                            </span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {task.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                          {!isDone ? (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => onCompleteTask(task.id)}
                              className="text-xs py-1 px-3 bg-teal-800 hover:bg-teal-900 text-white font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> {t("status.completed")}
                            </Button>
                          ) : (
                            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {t("status.completed")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">
                No active tasks listed for this case.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
