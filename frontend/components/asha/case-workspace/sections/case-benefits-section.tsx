"use client";

import React, { useState } from "react";
import { CaseDetailResponse } from "@shared/types/case";
import { useTranslation } from "@/i18n/i18n-context";
import { ShieldCheck, CheckCircle2, HelpCircle, Check, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CaseBenefitsSectionProps {
  caseDetail: CaseDetailResponse;
  onResolveScheme?: (schemeId: string, resolved: boolean) => Promise<void>;
}

export function CaseBenefitsSection({ caseDetail, onResolveScheme }: CaseBenefitsSectionProps) {
  const { t } = useTranslation();
  const { case: caseData, eligibilityResults } = caseDetail;
  const [resolvingSchemeId, setResolvingSchemeId] = useState<string | null>(null);

  const resolvedSet = new Set(caseData.resolvedSchemes || []);
  if (["RESOLVED", "CLOSED"].includes(caseData.status) && caseData.schemeId) {
    resolvedSet.add(caseData.schemeId);
  }

  const handleToggleResolve = async (schemeId: string, newResolvedState: boolean) => {
    if (!onResolveScheme) return;
    setResolvingSchemeId(schemeId);
    try {
      await onResolveScheme(schemeId, newResolvedState);
    } finally {
      setResolvingSchemeId(null);
    }
  };

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
              const isResolved = resolvedSet.has(r.schemeId);
              const isEligible = r.status === "ELIGIBLE";
              const isNeedsInfo = r.status === "NEEDS_INFORMATION";
              const isProcessing = resolvingSchemeId === r.schemeId;

              return (
                <div
                  key={r.schemeId}
                  className={`p-4 rounded-2xl border space-y-3 text-xs transition-all flex flex-col justify-between ${
                    isResolved
                      ? "bg-emerald-50/40 border-emerald-300 shadow-2xs"
                      : isEligible || isNeedsInfo
                      ? "bg-amber-50/20 border-amber-200 shadow-2xs"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="font-bold text-slate-900 text-sm leading-snug">{r.schemeName}</h5>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] shrink-0 border flex items-center gap-1 ${
                          isResolved
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                            : isEligible
                            ? "bg-amber-50 text-amber-900 border-amber-300"
                            : isNeedsInfo
                            ? "bg-amber-50 text-amber-900 border-amber-300"
                            : "bg-slate-200 text-slate-700 border-slate-300"
                        }`}
                      >
                        {isResolved ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>{t("status.resolved_eligible")}</span>
                          </>
                        ) : isEligible ? (
                          t("status.eligible_action_required")
                        ) : isNeedsInfo ? (
                          t("status.action_required")
                        ) : (
                          t("status.not_eligible")
                        )}
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

                  {onResolveScheme && (
                    <div className="pt-3 border-t border-slate-200/60 flex items-center justify-end gap-2">
                      {isResolved ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleToggleResolve(r.schemeId, false)}
                          className="text-xs border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>{t("asha.reopenScheme")}</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleToggleResolve(r.schemeId, true)}
                          className="text-xs bg-teal-800 hover:bg-teal-900 text-white font-semibold flex items-center gap-1 shadow-2xs"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{t("asha.markSchemeResolved")}</span>
                        </Button>
                      )}
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
