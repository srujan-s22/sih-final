"use client";

import React from "react";
import { CaseDetailResponse } from "@shared/types/case";
import { useTranslation } from "@/i18n/i18n-context";
import { ShieldCheck, CheckCircle2, HelpCircle } from "lucide-react";

export interface CaseBenefitsSectionProps {
  caseDetail: CaseDetailResponse;
}

export function CaseBenefitsSection({ caseDetail }: CaseBenefitsSectionProps) {
  const { t } = useTranslation();
  const { eligibilityResults } = caseDetail;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              <span>{t("citizen.healthBenefits")} ({eligibilityResults?.length || 0})</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("asha.benefitsDesc")}
            </p>
          </div>
        </div>

        {!eligibilityResults || eligibilityResults.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-2">
            <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">{t("citizen.noSchemesMessage")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eligibilityResults.map((r) => {
              const isEligible = r.status === "ELIGIBLE";
              return (
                <div
                  key={r.schemeId}
                  className={`p-4 rounded-2xl border space-y-2.5 text-xs transition-all flex flex-col justify-between ${
                    isEligible
                      ? "bg-emerald-50/30 border-emerald-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="font-bold text-slate-900 text-sm">{r.schemeName}</h5>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                          isEligible
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{r.benefitSummary}</p>
                  </div>

                  {r.matchedRules && r.matchedRules.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {t("asha.criteriaMet")}
                      </span>
                      <ul className="space-y-1 text-[11px] text-slate-600">
                        {r.matchedRules.map((rule) => (
                          <li key={rule.ruleId} className="flex items-start gap-1.5">
                            <span className="text-teal-700 font-bold">•</span>
                            <span>{rule.explanation || rule.ruleName}</span>
                          </li>
                        ))}
                      </ul>
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
