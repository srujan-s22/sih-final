"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-white p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-teal-700 text-white flex items-center justify-center font-bold text-sm">
                SS
              </span>
              <span className="font-bold text-slate-900 text-base">{siteConfig.name}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col space-y-2">
            {siteConfig.navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="px-3 py-2.5 rounded-md text-base font-medium text-slate-700 hover:text-teal-800 hover:bg-slate-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-200 space-y-3">
          <Button variant="primary" className="w-full" onClick={onClose}>
            Access Portal
          </Button>
          <p className="text-[11px] text-center text-slate-500">
            SwasthyaSetu Public Healthcare Access Platform
          </p>
        </div>
      </div>
    </div>
  );
}
