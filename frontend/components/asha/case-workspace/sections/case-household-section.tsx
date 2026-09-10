"use client";

import React from "react";
import { CaseDetailResponse } from "@shared/types/case";
import { HouseholdNfcStatusResponse } from "@shared/types/nfc";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Users,
  Radio,
  CheckCircle2,
  MapPin,
  Phone,
  FileText,
  ShieldAlert,
} from "lucide-react";

export interface CaseHouseholdSectionProps {
  caseDetail: CaseDetailResponse;
  caseNfcStatus: HouseholdNfcStatusResponse | null;
  onOpenNfc: () => void;
}

export function CaseHouseholdSection({
  caseDetail,
  caseNfcStatus,
  onOpenNfc,
}: CaseHouseholdSectionProps) {
  const { t } = useTranslation();
  const { household, members } = caseDetail;

  return (
    <div className="space-y-6">
      {/* 1. Household Metadata Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
          <FileText className="w-4 h-4 text-teal-700" />
          <span>{t("citizen.householdInfo")}</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
              {t("citizen.incomeCategory")}
            </span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {household.incomeCategory}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
              {t("citizen.rationCardNumber")}
            </span>
            <span className="font-mono font-semibold text-slate-800 text-sm mt-0.5 block truncate">
              {household.rationCardNumber || "N/A"}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
              {t("citizen.locationDetails")}
            </span>
            <span className="font-semibold text-slate-900 mt-0.5 block truncate">
              {household.village ? `${household.village}, ` : ""}
              {household.district}, {household.state}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
              {t("citizen.contactPhone")}
            </span>
            <span className="font-semibold text-slate-900 mt-0.5 block truncate">
              {household.contactPhone || "Not Provided"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Household NFC Card Access Section */}
      <div className="p-5 rounded-2xl border border-teal-200 bg-teal-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 shadow-2xs">
            <Radio className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 text-sm">Household NFC Smart Card</h4>
              {caseNfcStatus?.hasActiveNfc ? (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px] flex items-center gap-1 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Active v{caseNfcStatus.record?.version}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 font-bold rounded-full text-[10px]">
                  Not Registered
                </span>
              )}
            </div>
            <p className="text-slate-600 text-xs leading-relaxed max-w-xl">
              {caseNfcStatus?.hasActiveNfc
                ? `Physical NFC tag is linked to this household. Activated on ${new Date(
                    caseNfcStatus.record?.createdAt || ""
                  ).toLocaleDateString()}. Tap to view entitlements offline.`
                : "Provision a physical NDEF tag to grant the family tap-to-access scheme details at doorstep or health sub-centers."}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenNfc}
          className="text-xs font-bold shrink-0 bg-white border-teal-300 text-teal-900 hover:bg-teal-100/50 cursor-pointer shadow-2xs py-2 px-3.5"
        >
          <Radio className="w-3.5 h-3.5 mr-1 text-teal-700" />
          <span>{caseNfcStatus?.hasActiveNfc ? "Manage NFC Card" : "Register NFC Card"}</span>
        </Button>
      </div>

      {/* 3. Family Members List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            <span>{t("citizen.familyMembers")} ({members.length})</span>
          </h4>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
          {members.map((m) => (
            <div
              key={m.id}
              className="p-3.5 bg-white hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <span className="font-bold text-slate-900 text-sm">{m.fullName}</span>
                <span className="text-slate-500 ml-2">
                  {m.relationship} • {m.age} yrs • {m.gender}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 self-start sm:self-auto">
                {m.age >= 70 && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded text-[10px] border border-emerald-200">
                    {t("citizen.seniorCitizenTag")}
                  </span>
                )}
                {m.maternalStatus === "pregnant" && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-800 font-bold rounded text-[10px] border border-purple-200">
                    {t("citizen.pregnantTag")}
                  </span>
                )}
                {m.disabilityStatus && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-bold rounded text-[10px] border border-blue-200">
                    {t("citizen.disabilityTag")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
