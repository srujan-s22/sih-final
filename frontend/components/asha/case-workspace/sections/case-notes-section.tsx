"use client";

import React, { useState } from "react";
import { CaseDetailResponse } from "@shared/types/case";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { FileText, Plus, MessageSquare } from "lucide-react";

export interface CaseNotesSectionProps {
  caseDetail: CaseDetailResponse;
  onAddNote: (content: string) => Promise<void>;
}

export function CaseNotesSection({ caseDetail, onAddNote }: CaseNotesSectionProps) {
  const { t } = useTranslation();
  const { notes } = caseDetail;

  const [newNoteContent, setNewNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddNote(newNoteContent.trim());
      setNewNoteContent("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-700" />
              <span>{t("forms.notes")} ({notes.length})</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Field observations, household verification logs, and follow-up records.
            </p>
          </div>
        </div>

        {/* Add Note Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <textarea
            rows={3}
            required
            placeholder="Add a field note (e.g. Visited household today. Verified maternal ANC checkup card, informed about JSY institutional delivery benefit...)"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            className="w-full text-xs p-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-700 focus:outline-hidden"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !newNoteContent.trim()}
              className="text-xs bg-teal-800 hover:bg-teal-900 text-white cursor-pointer py-1.5 px-4"
            >
              {isSubmitting ? t("common.submitting") : t("common.confirm")}
            </Button>
          </div>
        </form>

        {/* Notes List */}
        <div className="space-y-3 pt-2">
          {notes.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400 space-y-1">
              <MessageSquare className="w-6 h-6 text-slate-300 mx-auto mb-1" />
              <p className="font-semibold text-slate-600">No field notes recorded yet.</p>
              <p>Add notes above to maintain a clinical audit record of field visits.</p>
            </div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="font-bold text-slate-700">{n.authorName}</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-800 leading-relaxed">{n.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
