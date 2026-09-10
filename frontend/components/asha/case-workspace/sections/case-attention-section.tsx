"use client";

import React from "react";
import { CaseDetailResponse } from "@shared/types/case";
import { useTranslation } from "@/i18n/i18n-context";
import { AlertTriangle, CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";

export interface CaseAttentionSectionProps {
  caseDetail: CaseDetailResponse;
}

export function CaseAttentionSection({ caseDetail }: CaseAttentionSectionProps) {
  const { t } = useTranslation();
  const { case: caseData, guidance, members, assistanceRequests } = caseDetail;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>{t("asha.attentionRequired")} ({guidance.gaps.length})</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Proactive system intelligence identifying missed government health entitlements.
            </p>
          </div>
        </div>

        {guidance.gaps.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">{t("status.completed")}</p>
            <p className="text-slate-500 max-w-sm mx-auto">
              {t("asha.noAttentionSignals")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {guidance.gaps.map((g, idx) => {
              const isAssistanceCompleted =
                (g.schemeId &&
                  g.schemeId === caseData.schemeId &&
                  ["RESOLVED", "CLOSED"].includes(caseData.status)) ||
                Boolean(
                  assistanceRequests?.some(
                    (r) =>
                      r.schemeId === g.schemeId &&
                      ["RESOLVED", "CLOSED"].includes(r.status)
                  )
                );

              const isAssistanceInProgress =
                !isAssistanceCompleted &&
                ((g.schemeId &&
                  g.schemeId === caseData.schemeId &&
                  !["RESOLVED", "CLOSED", "CITIZEN_DECLINED"].includes(caseData.status)) ||
                  Boolean(
                    assistanceRequests?.some(
                      (r) =>
                        r.schemeId === g.schemeId &&
                        !["RESOLVED", "CLOSED", "DECLINED"].includes(r.status)
                    )
                  ));

              const targetMember =
                g.schemeId === "ab-pmjay"
                  ? members.find((m) => m.age >= 70)
                  : g.schemeId === "jsy"
                  ? members.find((m) => m.maternalStatus === "pregnant") ||
                    members.find((m) => m.gender === "female" && m.age >= 18)
                  : undefined;

              return (
                <div
                  key={g.id || idx}
                  className={`p-4 rounded-xl border space-y-2 text-xs transition-all ${
                    isAssistanceCompleted
                      ? "bg-emerald-50/40 border-emerald-300 text-slate-800"
                      : isAssistanceInProgress
                      ? "bg-blue-50/40 border-blue-300 text-slate-800"
                      : g.priority === "REQUIRED"
                      ? "bg-rose-50/50 border-rose-200 text-rose-950"
                      : g.priority === "IMPORTANT"
                      ? "bg-amber-50/50 border-amber-200 text-amber-950"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-700">
                      {g.type.replace(/_/g, " ")}
                    </span>

                    {isAssistanceCompleted ? (
                      <span className="font-bold text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{t("status.completed")}</span>
                      </span>
                    ) : isAssistanceInProgress ? (
                      <span className="font-bold text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded border border-blue-200">
                        ● {t("common.active")}
                      </span>
                    ) : (
                      <span
                        className={`font-bold text-[10px] px-2 py-0.5 rounded uppercase ${
                          g.priority === "REQUIRED"
                            ? "bg-rose-100 text-rose-800"
                            : g.priority === "IMPORTANT"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {g.priority}
                      </span>
                    )}
                  </div>

                  <div>
                    <h5 className="font-bold text-sm text-slate-900">
                      {g.title || g.description}
                    </h5>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">{g.description}</p>
                  </div>

                  {targetMember && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                      <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                      <span>
                        Target: {targetMember.fullName} ({targetMember.relationship}, {targetMember.age}y)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
