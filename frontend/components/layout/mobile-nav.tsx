"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

import { BrandLogo } from "@/components/brand-logo";

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const { isAuthenticated, role } = useAuth();
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
    if (role === "ADMIN") return "Admin Area";
    if (role === "ASHA") return "ASHA Workspace";
    return "Citizen Portal";
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <BrandLogo size="sm" showText={true} subtitle="Healthcare Access" priority={true} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col space-y-1.5">
            {siteConfig.navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="px-3 py-3 rounded-lg text-base font-medium text-slate-800 hover:text-teal-800 hover:bg-slate-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Action Button & Disclaimer */}
        <div className="pt-6 border-t border-slate-200 space-y-3">
          {isAuthenticated ? (
            <Link href={getPortalLink()} onClick={onClose} className="block w-full">
              <Button variant="primary" size="md" className="w-full text-sm">
                {getPortalLabel()}
              </Button>
            </Link>
          ) : (
            <Link href="/auth/sign-in" onClick={onClose} className="block w-full">
              <Button variant="primary" size="md" className="w-full text-sm">
                Sign In
              </Button>
            </Link>
          )}
          <p className="text-[11px] text-center text-slate-500 leading-relaxed">
            Public Healthcare Access Initiative
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
