"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import { BrandLogo } from "@/components/brand-logo";
import { useTranslation } from "@/i18n/i18n-context";

export function Footer() {
  const pathname = usePathname();
  const { t } = useTranslation();

  // If inside the authenticated workspace, AuthenticatedShell handles its own footer
  if (
    pathname.startsWith("/citizen") ||
    pathname.startsWith("/asha") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <footer className="w-full border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <BrandLogo size="xs" />
            <span className="text-sm font-bold text-slate-900">{siteConfig.name}</span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-500">Public Healthcare Access Platform</span>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
            <Link href="/#schemes" className="hover:text-teal-800 transition-colors">
              {t("navigation.schemes")}
            </Link>
            <Link href="/#how-it-works" className="hover:text-teal-800 transition-colors">
              {t("navigation.howItWorks")}
            </Link>
            <Link href="/#about" className="hover:text-teal-800 transition-colors">
              {t("navigation.aboutPlatform")}
            </Link>
            <Link href="/auth/consent" className="hover:text-teal-800 transition-colors">
              {t("navigation.privacyConsent")}
            </Link>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <p>© {new Date().getFullYear()} SwasthyaSetu. Built for SIH 2026.</p>
          <p>Privacy-first • Data is evaluated solely for official government healthcare entitlement support.</p>
        </div>
      </div>
    </footer>
  );
}
