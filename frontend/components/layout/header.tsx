"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { Menu } from "lucide-react";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isAuthenticated, role, signOut, isLoading } = useAuth();
  const { t } = useTranslation();

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
    if (role === "ADMIN") return t("navigation.adminConsole");
    if (role === "ASHA") return t("navigation.ashaWorkspace");
    return t("navigation.citizenPortal");
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/sign-in");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-2xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded-lg p-1 -m-1"
          >
            <BrandLogo size="md" showText={true} subtitle="Healthcare Access" priority={true} />
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
              <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>{getPortalLabel()}</span>
            </Link>
          )}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSelector size="sm" />

          {!isLoading &&
            (isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                <Link href={getPortalLink()}>
                  <Button variant="primary" size="sm" className="font-semibold">
                    {getPortalLabel()}
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  {t("navigation.signOut")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/sign-in">
                  <Button variant="outline" size="sm">
                    {t("navigation.signIn")}
                  </Button>
                </Link>
                <Link href="/auth/sign-in">
                  <Button variant="primary" size="sm">
                    {t("common.next")}
                  </Button>
                </Link>
              </div>
            ))}
        </div>

        {/* Mobile Actions & Menu Trigger */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSelector size="sm" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open mobile navigation"
            className="p-2 min-h-[36px] min-w-[36px]"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </Button>
        </div>
      </div>

      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </header>
  );
}
