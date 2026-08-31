"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { X } from "lucide-react";

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const { isAuthenticated, role } = useAuth();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const getPortalLink = () => {
    if (role === "ADMIN") return "/admin";
    if (role === "ASHA") return "/asha";
    return "/citizen";
  };

  const getPortalLabel = () => {
    if (role === "ADMIN") return t("navigation.adminConsole");
    if (role === "ASHA") return t("navigation.ashaWorkspace");
    return t("navigation.citizenPortal");
  };

  const content = (
    <div
      className="fixed inset-0 z-[100] md:hidden flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation"
    >
      {/* 1. Full-screen Dimmed Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Solid White Drawer Panel */}
      <div
        className="relative z-[101] w-full max-w-[280px] sm:max-w-xs h-full bg-white shadow-2xl flex flex-col justify-between p-6 border-l border-slate-200"
        style={{ backgroundColor: "#ffffff" }}
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <BrandLogo size="sm" showText={true} subtitle="Healthcare Access" priority={true} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <X className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          {/* Language Selector */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Language / ಭಾಷೆ / भाषा
            </span>
            <LanguageSelector variant="pills" className="w-full justify-between" />
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col space-y-1">
            {siteConfig.navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 hover:text-teal-800 hover:bg-slate-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Action Button & Disclaimer */}
        <div className="pt-5 border-t border-slate-200 space-y-2">
          {isAuthenticated ? (
            <Link href={getPortalLink()} onClick={onClose} className="block w-full">
              <Button variant="primary" size="md" className="w-full text-sm font-bold">
                {getPortalLabel()}
              </Button>
            </Link>
          ) : (
            <Link href="/auth/sign-in" onClick={onClose} className="block w-full">
              <Button variant="primary" size="md" className="w-full text-sm font-bold">
                {t("navigation.signIn")}
              </Button>
            </Link>
          )}
          <p className="text-[10px] text-slate-400 text-center">
            Official Healthcare Entitlement Platform
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
