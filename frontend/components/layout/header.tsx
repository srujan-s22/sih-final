"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useAuth } from "@/lib/auth/auth-context";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isAuthenticated, userProfile, role, signOut, isLoading } = useAuth();

  // If inside the authenticated workspace, AuthenticatedShell handles its own header
  if (
    pathname.startsWith("/citizen") ||
    pathname.startsWith("/asha") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  const getPortalLink = () => {
    if (role === "ADMIN") return "/admin";
    if (role === "ASHA") return "/asha";
    return "/citizen";
  };

  const getPortalLabel = () => {
    if (role === "ADMIN") return "Admin Console";
    if (role === "ASHA") return "ASHA Workspace";
    return "Citizen Portal";
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/sign-in");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded-md"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white font-bold text-base shadow-xs group-hover:bg-teal-800 transition-colors">
              SS
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                {siteConfig.name}
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                Healthcare Access
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {siteConfig.navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 hover:text-teal-800 transition-colors py-2"
            >
              {item.label}
            </Link>
          ))}
          {isAuthenticated && (
            <Link
              href={getPortalLink()}
              className="text-sm font-semibold text-teal-800 hover:text-teal-900 transition-colors flex items-center gap-1.5 py-2"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{getPortalLabel()}</span>
            </Link>
          )}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {!isLoading &&
            (isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link href={getPortalLink()}>
                  <Button variant="primary" size="sm" className="font-semibold shadow-xs">
                    Open {getPortalLabel()}
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/sign-in">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/sign-in">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            ))}
        </div>

        {/* Mobile Actions & Menu Trigger */}
        <div className="flex md:hidden items-center gap-2">
          {!isLoading &&
            (isAuthenticated ? (
              <Link href={getPortalLink()}>
                <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 inline-block">
                  Workspace
                </span>
              </Link>
            ) : (
              <Link href="/auth/sign-in">
                <Button variant="primary" size="sm" className="h-8 text-xs px-2.5">
                  Sign In
                </Button>
              </Link>
            ))}

          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open main menu"
            className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </header>
  );
}
