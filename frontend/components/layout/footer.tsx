"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";

export function Footer() {
  const pathname = usePathname();

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
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-700 text-white font-bold text-xs">
              SS
            </div>
            <span className="text-sm font-bold text-slate-900">{siteConfig.name}</span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-500">Public Healthcare Access Platform</span>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
            <Link href="/#schemes" className="hover:text-teal-800 transition-colors">
              Healthcare Schemes
            </Link>
            <Link href="/#how-it-works" className="hover:text-teal-800 transition-colors">
              How It Works
            </Link>
            <Link href="/#about" className="hover:text-teal-800 transition-colors">
              About Platform
            </Link>
            <Link href="/auth/consent" className="hover:text-teal-800 transition-colors">
              Privacy & Consent
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
