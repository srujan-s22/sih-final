"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShieldCheck,
  Building2,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSelector } from "@/components/i18n/language-selector";

export interface NavTabItem {
  id: string;
  label: string;
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
  const pathname = usePathname();
  const { userProfile, signOut } = useAuth();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const getRoleConfig = () => {
    switch (role) {
      case "ADMIN":
        return {
          portalName: t("navigation.adminConsole"),
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
              <span>{t("navigation.adminConsole")}</span>
            </span>
          ),
          homeHref: "/admin",
        };
      case "ASHA":
        return {
          portalName: t("navigation.ashaWorkspace"),
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
              <span>{t("navigation.ashaWorkspace")}</span>
            </span>
          ),
          homeHref: "/asha",
        };
      case "CITIZEN":
      default:
        return {
          portalName: t("navigation.citizenPortal"),
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>{t("navigation.citizenPortal")}</span>
            </span>
          ),
          homeHref: "/citizen",
        };
    }
  };

  const roleConfig = getRoleConfig();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 1. Authenticated Application Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand & Role Identifier */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href={roleConfig.homeHref}
              className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded-lg p-1 -m-1"
            >
              <BrandLogo
                size="md"
                showText={true}
                subtitle={roleConfig.portalName}
                priority={true}
              />
            </Link>

            <div className="hidden sm:block">{roleConfig.portalBadge}</div>
          </div>

          {/* Desktop Navigation Tabs */}
          {navTabs && navTabs.length > 0 && (
            <nav
              aria-label="Portal Navigation"
              className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80"
            >
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange?.(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                      isActive
                        ? "bg-white text-teal-900 shadow-2xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Language Selector, User Profile & Actions */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSelector size="sm" />

            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 max-w-[160px] truncate">
                {userProfile?.displayName || userProfile?.email || "Authenticated User"}
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-medium">
                {userProfile?.email}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="text-xs flex items-center gap-1.5 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>{t("navigation.signOut")}</span>
            </Button>
          </div>

          {/* Mobile Controls (Language + Hamburger) */}
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

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {userProfile?.displayName || "Authenticated User"}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">{userProfile?.email}</p>
              </div>
              <div>{roleConfig.portalBadge}</div>
            </div>

            {navTabs && navTabs.length > 0 && (
              <nav aria-label="Mobile Portal Navigation" className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 pb-1">
                  Navigation
                </p>
                {navTabs.map((tab) => {
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
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors text-left cursor-pointer ${
                        isActive
                          ? "bg-teal-50 text-teal-900 border border-teal-200/80"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4 text-slate-500 shrink-0" />}
                      <span>{tab.label}</span>
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
                className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                {t("navigation.signOut")}
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

      {/* 3. Lightweight Authenticated Footer */}
      <footer className="border-t border-slate-200 bg-white py-3.5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="font-semibold text-slate-700">SwasthyaSetu Portal</span>
            <span className="text-slate-300">•</span>
            <span>Official Government Health Entitlements</span>
          </div>
          <div>
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
