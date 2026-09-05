"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Copy,
  Check,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSelector } from "@/components/i18n/language-selector";

export interface NavTabItem {
  id: string;
  label: string;
  badge?: number | string;
  badgeVariant?: "default" | "primary" | "warning" | "danger" | "success";
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface AuthenticatedShellProps {
  role: "CITIZEN" | "ASHA" | "ADMIN";
  children: React.ReactNode;
  title?: string;
  description?: string;
  navTabs?: NavTabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  actions?: React.ReactNode;
}

/** Helper to clean embedded string counts like "Label (3)" and extract badge value */
function parseTabLabel(label: string, explicitBadge?: number | string) {
  if (explicitBadge !== undefined) {
    return { cleanLabel: label, badgeValue: explicitBadge };
  }
  const match = label.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (match) {
    return { cleanLabel: match[1].trim(), badgeValue: match[2].trim() };
  }
  return { cleanLabel: label, badgeValue: undefined };
}

/** Helper to generate 2-letter initials from display name or email */
function getUserInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

export function AuthenticatedShell({
  role,
  children,
  title,
  description,
  navTabs,
  activeTab,
  onTabChange,
  actions,
}: AuthenticatedShellProps) {
  const router = useRouter();
  const { userProfile, signOut } = useAuth();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/sign-in");
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getRoleConfig = () => {
    switch (role) {
      case "ADMIN":
        return {
          portalName: t("navigation.adminConsole"),
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50/90 text-indigo-900 border border-indigo-200/90 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
              <span>{t("navigation.adminConsole")}</span>
            </span>
          ),
          avatarGradient: "bg-gradient-to-br from-indigo-600 to-slate-800",
          homeHref: "/admin",
        };
      case "ASHA":
        return {
          portalName: t("navigation.ashaWorkspace"),
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50/90 text-emerald-900 border border-emerald-200/90 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span>{t("navigation.ashaWorkspace")}</span>
            </span>
          ),
          avatarGradient: "bg-gradient-to-br from-teal-600 to-emerald-700",
          homeHref: "/asha",
        };
      case "CITIZEN":
      default:
        return {
          portalName: t("navigation.citizenPortal"),
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50/90 text-teal-900 border border-teal-200/90 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
              <span>{t("navigation.citizenPortal")}</span>
            </span>
          ),
          avatarGradient: "bg-gradient-to-br from-teal-700 to-cyan-700",
          homeHref: "/citizen",
        };
    }
  };

  const roleConfig = getRoleConfig();
  const userInitials = getUserInitials(userProfile?.displayName, userProfile?.email);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 1. Authenticated Application Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-2xs">
        {/* Tier 1: Identity & Primary Utilities */}
        <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand & Role Identifier */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              href={roleConfig.homeHref}
              className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded-lg p-1 -m-1 transition-opacity hover:opacity-90"
            >
              <BrandLogo
                size="md"
                showText={true}
                priority={true}
              />
            </Link>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="hidden sm:block">{roleConfig.portalBadge}</div>

            {/* ASHA Service Code Quick-Copy Chip */}
            {role === "ASHA" && userProfile?.ashaServiceCode && (
              <button
                type="button"
                onClick={() => handleCopyCode(userProfile.ashaServiceCode!)}
                title="Click to copy your unique ASHA Service Code"
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 transition-colors shadow-2xs cursor-pointer select-none"
              >
                <span className="text-[10px] font-sans font-semibold uppercase text-slate-400">ID:</span>
                <span className="text-slate-900">{userProfile.ashaServiceCode}</span>
                {copiedCode ? (
                  <Check className="w-3 h-3 text-emerald-600 ml-0.5" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400 ml-0.5" />
                )}
              </button>
            )}
          </div>

          {/* Right Action Group: Language Selector, User Profile & Sign Out */}
          <div className="hidden md:flex items-center gap-3.5 shrink-0">
            <LanguageSelector size="sm" />

            <div className="h-5 w-px bg-slate-200" />

            {/* User Profile Card with Initials Avatar */}
            <div className="flex items-center gap-2.5 pl-1">
              <div
                className={`w-8 h-8 rounded-full ${roleConfig.avatarGradient} text-white font-bold text-xs flex items-center justify-center shadow-2xs ring-2 ring-white select-none shrink-0`}
              >
                {userInitials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 max-w-[140px] truncate leading-tight">
                  {userProfile?.displayName || userProfile?.email || "Authenticated User"}
                </span>
                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px] leading-tight">
                  {userProfile?.ashaServiceCode ? userProfile.ashaServiceCode : userProfile?.email}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="text-xs flex items-center gap-1.5 border-slate-200 text-slate-600 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-all font-semibold ml-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t("navigation.signOut")}</span>
            </Button>
          </div>

          {/* Mobile Controls (Always visible on mobile) */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageSelector size="sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="p-2 min-h-[36px] min-w-[36px]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Tier 2: Workspace Navigation Tabs Strip */}
        {navTabs && navTabs.length > 0 && (
          <div className="border-t border-slate-100 bg-white/95 shadow-2xs">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <nav
                aria-label="Portal Navigation"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2"
              >
                {navTabs.map((tab) => {
                  const { cleanLabel, badgeValue } = parseTabLabel(tab.label, tab.badge);
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange?.(tab.id)}
                      className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer select-none shrink-0 ${
                        isActive
                          ? "bg-teal-50/90 text-teal-950 font-bold border border-teal-200/90 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
                      }`}
                    >
                      {Icon && (
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive
                              ? "text-teal-700"
                              : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                      )}
                      <span className="tracking-tight">{cleanLabel}</span>
                      {badgeValue !== undefined && badgeValue !== "" && (
                        <span
                          className={`ml-0.5 px-2 py-0.5 text-[11px] font-bold rounded-full transition-colors leading-tight ${
                            isActive
                              ? "bg-teal-200/80 text-teal-900 shadow-2xs"
                              : tab.badgeVariant === "danger"
                              ? "bg-rose-100 text-rose-700"
                              : tab.badgeVariant === "warning"
                              ? "bg-amber-100 text-amber-800"
                              : tab.badgeVariant === "success"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600 group-hover:bg-slate-200/80 border border-slate-200/60"
                          }`}
                        >
                          {badgeValue}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-full ${roleConfig.avatarGradient} text-white font-bold text-xs flex items-center justify-center shadow-2xs ring-2 ring-white select-none`}
                >
                  {userInitials}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {userProfile?.displayName || "Authenticated User"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">{userProfile?.email}</p>
                </div>
              </div>
              <div>{roleConfig.portalBadge}</div>
            </div>

            {/* Prominent Language Switcher inside Mobile Drawer */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Language / ಭಾಷೆ / भाषा
              </p>
              <LanguageSelector variant="pills" className="w-full justify-between" />
            </div>

            {navTabs && navTabs.length > 0 && (
              <nav aria-label="Mobile Portal Navigation" className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 pb-1">
                  Workspace Navigation
                </p>
                {navTabs.map((tab) => {
                  const { cleanLabel, badgeValue } = parseTabLabel(tab.label, tab.badge);
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        onTabChange?.(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        isActive
                          ? "bg-teal-50 text-teal-900 border border-teal-200 font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {Icon && (
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? "text-teal-700" : "text-slate-500"
                            }`}
                          />
                        )}
                        <span>{cleanLabel}</span>
                      </div>
                      {badgeValue !== undefined && badgeValue !== "" && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            isActive
                              ? "bg-teal-200/80 text-teal-900"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {badgeValue}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <Link
                href="/"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("navigation.publicWebsite")}
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50 font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                <span>{t("navigation.signOut")}</span>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Main Page Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 md:py-8 space-y-6">
        {(title || actions) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 pb-4 sm:pb-5">
            <div>
              {title && (
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        )}

        {children}
      </main>

      {/* 3. Lightweight Authenticated Footer with Language Selector */}
      <footer className="border-t border-slate-200 bg-white py-3.5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="font-semibold text-slate-700">SwasthyaSetu Portal</span>
            <span className="text-slate-300">•</span>
            <span>Official Government Health Entitlements</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">Language:</span>
              <LanguageSelector variant="pills" size="sm" />
            </div>
            <Link
              href="/"
              className="hover:text-teal-800 transition-colors font-medium text-slate-500"
            >
              {t("navigation.publicWebsite")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
