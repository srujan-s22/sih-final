"use client";

import React, { useState } from "react";
import { CaseDetailResponse, CaseFollowUp } from "@shared/types/case";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Check,
  PhoneCall,
} from "lucide-react";

export interface CaseTasksSectionProps {
  caseDetail: CaseDetailResponse;
  onScheduleFollowUp: (dueAt: string, reason: string) => Promise<void>;
  onCompleteFollowUp: (followUpId: string, outcome?: string, notes?: string) => Promise<void>;
  onOpenVoiceCall: (followUp?: CaseFollowUp) => void;
}

export function CaseTasksSection({
  caseDetail,
  onScheduleFollowUp,
  onCompleteFollowUp,
  onOpenVoiceCall,
}: CaseTasksSectionProps) {
  const { t } = useTranslation();
  const { followUps } = caseDetail;

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Quick completion modal/inline state
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [outcomeText, setOutcomeText] = useState("");

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpDate || !followUpReason.trim()) return;
    setIsSubmitting(true);
    try {
      await onScheduleFollowUp(followUpDate, followUpReason.trim());
      setFollowUpDate("");
      setFollowUpReason("");
      setShowScheduleForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickComplete = async (id: string) => {
    setIsSubmitting(true);
    try {
      await onCompleteFollowUp(
        id,
        outcomeText.trim() || "Completed during doorstep visit"
      );
      setCompletingId(null);
      setOutcomeText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Follow-up Header & Schedule Action */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-teal-700" />
              <span>{t("asha.dueFollowUps")} ({followUps.length})</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled doorstep visits, outreach calls, and compliance checks.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowScheduleForm(!showScheduleForm)}
            className="text-xs font-semibold self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Schedule Follow-up</span>
          </Button>
        </div>

        {/* Schedule Form */}
        {showScheduleForm && (
          <form
            onSubmit={handleFormSubmit}
            className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs"
          >
            <h5 className="font-bold text-slate-900">Schedule Field Follow-up Visit</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Scheduled Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Visit Reason / Objective *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Check PM-JAY e-Card generation status"
                  value={followUpReason}
                  onChange={(e) => setFollowUpReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowScheduleForm(false)}
                className="text-xs"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting || !followUpDate || !followUpReason.trim()}
                className="text-xs bg-teal-800 hover:bg-teal-900 text-white"
              >
                {isSubmitting ? t("common.submitting") : t("common.confirm")}
              </Button>
            </div>
          </form>
        )}

        {/* Follow-up List */}
        {followUps.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-1" />
            <p className="font-bold text-slate-800">{t("asha.noFollowUpsDue")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {followUps.map((f) => {
              const isCompleted = f.status === "COMPLETED";
              const isCancelled = f.status === "CANCELLED";
              const isOverdue = !isCompleted && !isCancelled && new Date(f.dueAt || f.scheduledAt) < new Date();

              return (
                <div
                  key={f.id}
                  className={`p-4 rounded-xl border space-y-2 text-xs transition-all ${
                    isCompleted
                      ? "bg-emerald-50/30 border-emerald-200"
                      : isCancelled
                      ? "bg-slate-50 border-slate-200 opacity-60"
                      : isOverdue
                      ? "bg-rose-50/40 border-rose-200"
                      : "bg-white border-slate-200 shadow-2xs"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-900 text-sm">
                          {f.title || f.reason}
                        </h5>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800"
                              : isCancelled
                              ? "bg-slate-200 text-slate-700"
                              : isOverdue
                              ? "bg-rose-100 text-rose-800 animate-pulse"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isCompleted
                            ? t("status.completed")
                            : isCancelled
                            ? "Cancelled"
                            : isOverdue
                            ? "Overdue"
                            : "Scheduled"}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Due: {new Date(f.dueAt || f.scheduledAt).toLocaleDateString()}
                        </span>
                        {f.outcome && (
                          <span className="text-emerald-700 font-medium">
                            • Outcome: {f.outcome}
                          </span>
                        )}
                      </p>
                    </div>

                    {!isCompleted && !isCancelled && (
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenVoiceCall(f)}
                          className="text-[11px] py-1 px-2.5 border-teal-200 text-teal-800 hover:bg-teal-50"
                        >
                          <PhoneCall className="w-3 h-3 mr-1" />
                          <span>Call</span>
                        </Button>

                        {completingId === f.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Outcome notes"
                              value={outcomeText}
                              onChange={(e) => setOutcomeText(e.target.value)}
                              className="p-1 px-2 text-xs border border-slate-300 rounded bg-white"
                            />
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleQuickComplete(f.id)}
                              className="text-[11px] py-1 px-2 bg-emerald-700 hover:bg-emerald-800 text-white"
                            >
                              Confirm
                            </Button>
                            <button
                              type="button"
                              onClick={() => setCompletingId(null)}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setCompletingId(f.id)}
                            className="text-[11px] py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>{t("status.completed")}</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
