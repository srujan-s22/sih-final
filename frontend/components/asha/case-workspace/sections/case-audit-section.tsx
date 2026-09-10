"use client";

import React from "react";
import { CaseDetailResponse } from "@shared/types/case";
import { useTranslation } from "@/i18n/i18n-context";
import { History } from "lucide-react";

export interface CaseAuditSectionProps {
  caseDetail: CaseDetailResponse;
}

export function CaseAuditSection({ caseDetail }: CaseAuditSectionProps) {
  const { t } = useTranslation();
  const { activities } = caseDetail;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-teal-700" />
              <span>{t("admin.auditTrail")} ({activities.length})</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable audit history of case modifications, state changes, and automated triggers.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {activities.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
              <p className="font-semibold text-slate-600">No activity recorded for this case yet.</p>
            </div>
          ) : (
            activities.map((a) => (
              <div
                key={a.id}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-slate-700">
                    {a.actorName} ({a.actorRole})
                  </span>
                  <span>{new Date(a.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-slate-800">{a.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
