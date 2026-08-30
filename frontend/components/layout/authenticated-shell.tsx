"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  ShieldCheck,
  Building2,
  LogOut,
  Menu,
  X,
  HeartPulse,
  Home,
  FileCheck,
  AlertCircle,
  Settings,
  Layers,
  Search,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/sign-in");
  };

  const getRoleConfig = () => {
    switch (role) {
      case "ADMIN":
        return {
          portalName: "Admin Console",
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">
              <Building2 className="w-3 h-3 text-slate-600" />
              <span>Admin Area</span>
            </span>
          ),
          homeHref: "/admin",
          accentColor: "slate",
        };
      case "ASHA":
        return {
          portalName: "ASHA Workspace",
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>ASHA Field Access</span>
            </span>
          ),
          homeHref: "/asha",
          accentColor: "emerald",
        };
      case "CITIZEN":
      default:
        return {
          portalName: "Citizen Portal",
          portalBadge: (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs">
              <Users className="w-3 h-3 text-teal-700" />
              <span>Citizen Workspace</span>
            </span>
          ),
          homeHref: "/citizen",
          accentColor: "teal",
        };
    }
  };

  const roleConfig = getRoleConfig();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 1. Authenticated Application Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white shadow-2xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand & Role Identifier */}
          <div className="flex items-center gap-4">
            <Link
              href={roleConfig.homeHref}
              className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded-md"
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

          {/* Desktop Navigation Tabs (If Provided) */}
          {navTabs && navTabs.length > 0 && (
            <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/60">
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange?.(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-white text-teal-900 shadow-xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* User Info & Actions */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 max-w-[160px] truncate">
                {userProfile?.displayName || userProfile?.email || "Authenticated User"}
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-medium uppercase">
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
              <span>Sign Out</span>
            </Button>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="p-2"
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
                <p className="text-xs font-semibold text-slate-800">
                  {userProfile?.displayName || "Authenticated User"}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">{userProfile?.email}</p>
              </div>
              <div>{roleConfig.portalBadge}</div>
            </div>

            {navTabs && navTabs.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2">
                  Navigation
                </p>
                {navTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        onTabChange?.(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                        isActive
                          ? "bg-teal-50 text-teal-900 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4 text-slate-500" />}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <Link
                href="/"
                className="text-xs text-slate-500 hover:text-slate-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Public Website
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Main Page Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10 space-y-6 sm:space-y-8">
        {(title || actions) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
            <div>
              {title && (
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
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
      <footer className="border-t border-slate-200/80 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>SwasthyaSetu Authenticated Session</span>
            <span className="text-slate-300">•</span>
            <span>Official Government Scheme Data</span>
          </div>
          <div>
            <Link href="/" className="hover:text-teal-800 transition-colors">
              Public Overview
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
