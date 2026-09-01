"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n-context";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  closeText?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  closeText,
}: ModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={cn(
          "w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all relative z-[101] flex flex-col overflow-hidden",
          className
        )}
        style={{ backgroundColor: "#ffffff" }}
      >
        <div className="flex items-start justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 flex-shrink-0">
          <div className="space-y-0.5 pr-2">
            <h2 id="modal-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer flex-shrink-0 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 text-sm text-slate-700">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end space-x-3 border-t border-slate-100 p-3.5 sm:p-4 bg-slate-50/50 flex-shrink-0">
            {footer}
          </div>
        ) : (
          <div className="flex items-center justify-end border-t border-slate-100 p-3 sm:p-3.5 bg-slate-50/50 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={onClose} className="cursor-pointer">
              {closeText || t("common.close")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
