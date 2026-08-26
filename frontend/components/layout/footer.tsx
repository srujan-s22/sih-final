import React from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-700 text-white font-bold text-xs">
                SS
              </div>
              <span className="text-base font-bold text-slate-900">{siteConfig.name}</span>
            </div>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
              SwasthyaSetu is designed to identify healthcare access gaps, verify scheme
              eligibility, and connect households with actionable healthcare support.
            </p>
          </div>

          {/* Nav Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Platform
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#schemes" className="hover:text-teal-800 transition-colors">
                  Schemes Directory
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-teal-800 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="#about" className="hover:text-teal-800 transition-colors">
                  Architecture Overview
                </Link>
              </li>
            </ul>
          </div>

          {/* Public Standards */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Governance & Security
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Protected by role-based authorization, end-to-end data encryption, and strict
              consent-driven data exchange standards.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} SwasthyaSetu Platform. Public Service Initiative.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-800 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-800 cursor-pointer">Terms of Access</span>
            <span className="hover:text-slate-800 cursor-pointer">Accessibility Standards</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
