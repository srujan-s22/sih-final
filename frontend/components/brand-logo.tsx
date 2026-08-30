"use client";

import React from "react";
import Image from "next/image";
import { siteConfig } from "@/config/site";

export interface BrandLogoProps {
  /** Size preset for the logo emblem */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Optional custom pixel dimension (square) */
  dimension?: number;
  /** Whether to render the brand text beside the logo emblem */
  showText?: boolean;
  /** Custom subtitle text below the brand name */
  subtitle?: string;
  /** Optional custom portal badge or role label */
  badge?: React.ReactNode;
  /** Whether to prioritize image loading (e.g. for header/hero) */
  priority?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Custom className for the image emblem */
  imageClassName?: string;
}

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 36,
  lg: 48,
  xl: 64,
};

export function BrandLogo({
  size = "md",
  dimension,
  showText = false,
  subtitle,
  badge,
  priority = true,
  className = "",
  imageClassName = "",
}: BrandLogoProps) {
  const pixelSize = dimension || SIZE_MAP[size] || 36;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className="relative flex-shrink-0 flex items-center justify-center overflow-hidden rounded-lg bg-white/90 shadow-2xs border border-emerald-900/10"
        style={{ width: pixelSize, height: pixelSize }}
      >
        <Image
          src="/logo.png"
          alt={showText ? "" : siteConfig.name}
          width={pixelSize}
          height={pixelSize}
          priority={priority}
          className={`object-contain p-0.5 ${imageClassName}`}
          aria-hidden={showText ? "true" : undefined}
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              {siteConfig.name}
            </span>
            {badge}
          </div>
          {subtitle && (
            <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
