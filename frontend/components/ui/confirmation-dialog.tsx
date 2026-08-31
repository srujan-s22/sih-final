"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/i18n-context";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary" | "warning";
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "destructive",
  isLoading = false,
}: ConfirmationDialogProps) {
  const { t } = useTranslation();
  const isDestructive = variant === "destructive";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs"
          >
            {cancelLabel || t("common.cancel")}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "primary"}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={isLoading}
            className="text-xs font-bold"
          >
            {confirmLabel || t("common.confirm")}
          </Button>
        </div>
      }
    >
      <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
        {description}
      </div>
    </Modal>
  );
}
