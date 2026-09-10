"use client";

import React, { useState } from "react";
import { useTranslation } from "@/i18n/i18n-context";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  AlertTriangle,
  ShieldCheck,
  CalendarDays,
  FileText,
  History,
  ChevronDown,
  Check,
} from "lucide-react";

export type CaseWorkspaceSection =
  | "overview"
  | "journey"
  | "household"
  | "attention"
  | "benefits"
  | "tasks"
  | "notes"
  | "audit";

export interface NavItemConfig {
  id: CaseWorkspaceSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeVariant?: "default" | "warning" | "success" | "danger";
}

export interface CaseWorkspaceNavProps {
  activeSection: CaseWorkspaceSection;
  onSelectSection: (section: CaseWorkspaceSection) => void;
  badgeCounts: {
    gapsCount?: number;
    schemesCount?: number;
    tasksCount?: number;
    notesCount?: number;
    activitiesCount?: number;
    isUrgent?: boolean;
  };
}

export function CaseWorkspaceNav({
  activeSection,
  onSelectSection,
  badgeCounts,
}: CaseWorkspaceNavProps) {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sections: {
    category: string;
    items: NavItemConfig[];
  }[] = [
    {
      category: t("asha.navCategoryCase"),
      items: [
        {
          id: "overview",
          label: t("asha.caseOverview"),
          icon: LayoutDashboard,
          badge: badgeCounts.isUrgent ? "!" : undefined,
          badgeVariant: "danger",
        },
      ],
    },
    {
      category: t("asha.navCategoryCaseWork"),
      items: [
        {
          id: "journey",
          label: t("asha.activeJourney"),
          icon: CheckSquare,
        },
        {
          id: "household",
          label: t("citizen.householdInfo"),
          icon: Users,
        },
        {
          id: "attention",
          label: t("asha.attentionRequired"),
          icon: AlertTriangle,
          badge: badgeCounts.gapsCount && badgeCounts.gapsCount > 0 ? badgeCounts.gapsCount : undefined,
          badgeVariant: "warning",
        },
        {
          id: "benefits",
          label: t("citizen.healthBenefits"),
          icon: ShieldCheck,
          badge: badgeCounts.schemesCount && badgeCounts.schemesCount > 0 ? badgeCounts.schemesCount : undefined,
          badgeVariant: "success",
        },
        {
          id: "tasks",
          label: t("asha.dueFollowUps"),
          icon: CalendarDays,
          badge: badgeCounts.tasksCount && badgeCounts.tasksCount > 0 ? badgeCounts.tasksCount : undefined,
          badgeVariant: "default",
        },
        {
          id: "notes",
          label: t("forms.notes"),
          icon: FileText,
          badge: badgeCounts.notesCount && badgeCounts.notesCount > 0 ? badgeCounts.notesCount : undefined,
          badgeVariant: "default",
        },
      ],
    },
    {
      category: t("asha.navCategorySystem"),
      items: [
        {
          id: "audit",
          label: t("admin.auditTrail"),
          icon: History,
          badge: badgeCounts.activitiesCount && badgeCounts.activitiesCount > 0 ? badgeCounts.activitiesCount : undefined,
          badgeVariant: "default",
        },
      ],
    },
  ];

  const allItems = sections.flatMap((g) => g.items);
  const activeItem = allItems.find((item) => item.id === activeSection) || allItems[0];
  const ActiveIcon = activeItem.icon;

  const handleSelect = (id: CaseWorkspaceSection) => {
    onSelectSection(id);
    setMobileMenuOpen(false);
  };

  return (
    <div>
      {/* ============================================================ */}
      {/* 1. MOBILE & TABLET (< 1024px): Touch-Friendly Section Picker */}
      {/* ============================================================ */}
      <div className="lg:hidden relative">
        <label htmlFor="mobile-section-selector" className="sr-only">
          {t("asha.selectSection")}
        </label>

        {/* Custom Mobile Selector Button */}
        <button
          id="mobile-section-selector"
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label={t("asha.selectSection")}
          className="w-full flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-700 cursor-pointer min-h-[44px]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
              <ActiveIcon className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="truncate text-sm">{activeItem.label}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            {activeItem.badge !== undefined && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200">
                {activeItem.badge}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                mobileMenuOpen ? "rotate-180 text-teal-700" : ""
              }`}
              aria-hidden="true"
            />
          </div>
        </button>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 space-y-3 max-h-[70vh] overflow-y-auto animate-in fade-in zoom-in-98 duration-150">
            {sections.map((group) => (
              <div key={group.category} className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block">
                  {group.category}
                </span>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isSelected = item.id === activeSection;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[40px] text-left ${
                          isSelected
                            ? "bg-teal-50 text-teal-950 font-bold border border-teal-200"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isSelected ? "text-teal-700" : "text-slate-400"
                            }`}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.badge !== undefined && (
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                item.badgeVariant === "danger"
                                  ? "bg-rose-100 text-rose-800"
                                  : item.badgeVariant === "warning"
                                  ? "bg-amber-100 text-amber-800"
                                  : item.badgeVariant === "success"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-700" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. DESKTOP (>= 1024px): Persistent Left Sidebar Navigation  */}
      {/* ============================================================ */}
      <nav
        aria-label="Case Workspace Sections"
        className="hidden lg:block bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-4 w-60 shrink-0"
      >
        {sections.map((group) => (
          <div key={group.category} className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 block select-none">
              {group.category}
            </span>

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isSelected = item.id === activeSection;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left select-none ${
                      isSelected
                        ? "bg-teal-800 text-white font-bold shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? "text-teal-200" : "text-slate-400"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isSelected
                            ? "bg-white text-teal-900"
                            : item.badgeVariant === "danger"
                            ? "bg-rose-100 text-rose-800"
                            : item.badgeVariant === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : item.badgeVariant === "success"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
