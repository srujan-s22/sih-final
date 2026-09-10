"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { caseService } from "@/services/case-service";
import { nfcService } from "@/services/nfc-service";
import {
  CaseDetailResponse,
  CaseStatus,
  CasePriority,
  CaseFollowUp,
} from "@shared/types/case";
import { HouseholdNfcStatusResponse } from "@shared/types/nfc";
import { AshaAssistanceRequest } from "@shared/types/assistance";
import { AshaNfcModal } from "@/components/nfc/asha-nfc-modal";
import { HealthcareAssistantDrawer } from "@/components/assistant/healthcare-assistant-drawer";
import { AshaCallModal } from "@/components/voice/asha-call-modal";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  HelpCircle,
  Radio,
} from "lucide-react";

import {
  CaseWorkspaceHeader,
} from "@/components/asha/case-workspace/case-workspace-header";
import {
  CaseWorkspaceNav,
  CaseWorkspaceSection,
} from "@/components/asha/case-workspace/case-workspace-nav";
import { CaseOverviewSection } from "@/components/asha/case-workspace/sections/case-overview-section";
import { CaseJourneySection } from "@/components/asha/case-workspace/sections/case-journey-section";
import { CaseHouseholdSection } from "@/components/asha/case-workspace/sections/case-household-section";
import { CaseAttentionSection } from "@/components/asha/case-workspace/sections/case-attention-section";
import { CaseBenefitsSection } from "@/components/asha/case-workspace/sections/case-benefits-section";
import { CaseTasksSection } from "@/components/asha/case-workspace/sections/case-tasks-section";
import { CaseNotesSection } from "@/components/asha/case-workspace/sections/case-notes-section";
import { CaseAuditSection } from "@/components/asha/case-workspace/sections/case-audit-section";

export default function AshaCaseWorkspacePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.caseId;

  const searchParams = useSearchParams();
  const router = useRouter();
  const { userProfile, role, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();

  // Dynamic role and exit path preserving the existing authorization model
  const effectiveRole = role || userProfile?.role;
  const currentRole: "ASHA" | "ADMIN" = effectiveRole === "ADMIN" ? "ADMIN" : "ASHA";
  const exitHref = currentRole === "ADMIN" ? "/admin" : "/asha";

  // Navigation tab state from search params (defaults to overview)
  const initialTab = (searchParams.get("tab") as CaseWorkspaceSection) || "overview";
  const [activeSection, setActiveSection] = useState<CaseWorkspaceSection>(initialTab);
  const requestIdParam = searchParams.get("requestId");

  // Core case state
  const [caseDetail, setCaseDetail] = useState<CaseDetailResponse | null>(null);
  const [caseNfcStatus, setCaseNfcStatus] = useState<HouseholdNfcStatusResponse | null>(null);
  const [selectedRequestContext, setSelectedRequestContext] = useState<AshaAssistanceRequest | null>(null);

  // Status indicators
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initiatingSchemeId, setInitiatingSchemeId] = useState<string | null>(null);

  // Modals state
  const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isVoiceCallModalOpen, setIsVoiceCallModalOpen] = useState(false);
  const [voiceCallTarget, setVoiceCallTarget] = useState<{
    caseId: string;
    citizenName: string;
    headOfHousehold?: string;
    schemeName?: string;
    contactPhoneMasked?: string;
    followUpId?: string;
    defaultReason?: string;
  } | null>(null);

  // Fetch NFC status for the household
  const fetchNfcStatus = useCallback(async (householdId: string) => {
    try {
      const res = await nfcService.getHouseholdNfcStatus(householdId);
      if (res.success && res.data) {
        setCaseNfcStatus(res.data);
      } else {
        setCaseNfcStatus(null);
      }
    } catch {
      setCaseNfcStatus(null);
    }
  }, []);

  // Main data loader
  const loadCaseDetail = useCallback(async () => {
    if (!caseId || caseId.trim().length === 0) {
      setErrorCode("INVALID_CASE_ID");
      setErrorMessage("A valid case ID is required.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setErrorCode(null);

    try {
      const res = await caseService.getCaseDetail(caseId);
      if (res.success && res.data) {
        setCaseDetail(res.data);

        // Fetch NFC card status
        if (res.data.household?.id) {
          fetchNfcStatus(res.data.household.id);
        }

        // Check if there is an associated assistance request context
        if (requestIdParam && res.data.assistanceRequests) {
          const match = res.data.assistanceRequests.find((r) => r.id === requestIdParam);
          if (match) setSelectedRequestContext(match);
        }
      } else {
        const err = (res as any).error;
        setErrorCode(err?.code || "LOAD_FAILED");
        setErrorMessage(err?.message || "Failed to load case details.");
      }
    } catch (err: any) {
      setErrorCode("NETWORK_ERROR");
      setErrorMessage(err?.message || "Network error while connecting to healthcare services.");
    } finally {
      setIsLoading(false);
    }
  }, [caseId, requestIdParam, fetchNfcStatus]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadCaseDetail();
  }, [authLoading, isAuthenticated, loadCaseDetail]);

  // Section switcher updating URL query param shallowly
  const handleSelectSection = (section: CaseWorkspaceSection) => {
    setActiveSection(section);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", section);
    window.history.replaceState({}, "", url.toString());
  };

  // Status & Priority Mutations
  const handleStatusChange = async (newStatus: CaseStatus) => {
    if (!caseDetail) return;
    setIsUpdating(true);
    try {
      const res = await caseService.updateCase(caseId, { status: newStatus });
      if (res.success && res.data) {
        setCaseDetail((prev) => (prev ? { ...prev, case: res.data.case } : prev));
        await loadCaseDetail();
      }
    } catch {
      // Quiet fail
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePriorityChange = async (newPriority: CasePriority) => {
    if (!caseDetail) return;
    setIsUpdating(true);
    try {
      const res = await caseService.updateCase(caseId, { priority: newPriority });
      if (res.success && res.data) {
        setCaseDetail((prev) => (prev ? { ...prev, case: res.data.case } : prev));
        await loadCaseDetail();
      }
    } catch {
      // Quiet fail
    } finally {
      setIsUpdating(false);
    }
  };

  // Complete Field Task
  const handleCompleteTask = async (taskId: string, notes?: string) => {
    try {
      const res = await caseService.completeTask(caseId, taskId, notes);
      if (res.success) {
        await loadCaseDetail();
      }
    } catch {
      // Quiet fail
    }
  };

  // Create Custom Task
  const handleCreateTask = async (title: string, description: string) => {
    try {
      const res = await caseService.createTask(caseId, {
        title,
        description: description || title,
        type: "CUSTOM_FIELD_TASK",
      });
      if (res.success) {
        await loadCaseDetail();
      }
    } catch {
      // Quiet fail
    }
  };

  // Add Note
  const handleAddNote = async (content: string) => {
    try {
      const res = await caseService.addNote(caseId, content);
      if (res.success) {
        await loadCaseDetail();
      }
    } catch {
      // Quiet fail
    }
  };

  // Schedule Follow-up
  const handleScheduleFollowUp = async (dueAt: string, reason: string) => {
    try {
      const res = await caseService.createFollowUp(caseId, { dueAt, reason });
      if (res.success) {
        await loadCaseDetail();
      }
    } catch {
      // Quiet fail
    }
  };

  // Complete Follow-up
  const handleCompleteFollowUp = async (
    followUpId: string,
    outcome?: string,
    notes?: string
  ) => {
    try {
      const res = await caseService.completeFollowUp(
        caseId,
        followUpId,
        outcome || "Completed during direct field check-in",
        notes
      );
      if (res.success) {
        await loadCaseDetail();
      }
    } catch {
      // Quiet fail
    }
  };

  // Initiate Scheme Assistance
  const handleInitiateScheme = async (
    targetCaseId: string,
    schemeId: string,
    beneficiaryMemberId?: string | null
  ) => {
    setInitiatingSchemeId(`${targetCaseId}_${schemeId}`);
    try {
      const res = await caseService.initiateScheme(targetCaseId, {
        schemeId,
        beneficiaryMemberId,
        priority: "HIGH",
        notes: `ASHA worker initiated doorstep facilitation for ${
          schemeId === "ab-pmjay" ? "PM-JAY Senior 70+" : "JSY Maternal Care"
        }.`,
      });

      if (res.success) {
        await loadCaseDetail();
        handleSelectSection("journey");
      }
    } catch {
      // Quiet fail
    } finally {
      setInitiatingSchemeId(null);
    }
  };

  // Open Outbound Telephony Modal
  const handleOpenVoiceCallModal = (followUp?: CaseFollowUp) => {
    const name =
      caseDetail?.case?.beneficiaryName ||
      caseDetail?.household?.headOfHouseholdName ||
      "Beneficiary";
    const phone = caseDetail?.household?.contactPhone
      ? `+91 ${caseDetail.household.contactPhone
          .replace(/\D/g, "")
          .slice(-10)
          .replace(/(\d{3})\d{4}(\d{3})/, "$1****$2")}`
      : "+91 98*** **210";

    setVoiceCallTarget({
      caseId,
      citizenName: name,
      headOfHousehold: caseDetail?.household?.headOfHouseholdName,
      schemeName: caseDetail?.case?.schemeName || "Government Health Scheme",
      contactPhoneMasked: phone,
      followUpId: followUp?.id,
      defaultReason: followUp
        ? `Doorstep visit reminder: ${followUp.title || followUp.reason}`
        : `Outreach for ${caseDetail?.case?.schemeName || "health scheme"} follow-up`,
    });
    setIsVoiceCallModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={["ASHA", "ADMIN"]}>
      <AuthenticatedShell role={currentRole}>
        <div className="space-y-6">
          {/* ============================================================ */}
          {/* 1. LOADING SKELETON                                          */}
          {/* ============================================================ */}
          {isLoading && (
            <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading case workspace">
              {/* Header Skeleton */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="h-6 bg-slate-200 rounded-md w-40" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-8 bg-slate-200 rounded-lg w-64" />
                    <div className="h-4 bg-slate-200 rounded-md w-80" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 bg-slate-200 rounded-lg w-28" />
                    <div className="h-9 bg-slate-200 rounded-lg w-28" />
                  </div>
                </div>
              </div>

              {/* Layout Skeleton */}
              <div className="flex flex-col lg:flex-row items-start gap-6">
                <div className="w-full lg:w-60 bg-white border border-slate-200 rounded-2xl p-4 space-y-3 h-80 shrink-0">
                  <div className="h-4 bg-slate-200 rounded-md w-24" />
                  <div className="h-8 bg-slate-200 rounded-lg w-full" />
                  <div className="h-8 bg-slate-200 rounded-lg w-full" />
                  <div className="h-8 bg-slate-200 rounded-lg w-full" />
                </div>
                <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-4 min-h-[400px]">
                  <div className="h-6 bg-slate-200 rounded-md w-48" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-32 bg-slate-100 rounded-xl" />
                    <div className="h-32 bg-slate-100 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. ERROR STATES                                              */}
          {/* ============================================================ */}
          {!isLoading && (errorMessage || !caseDetail) && (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto shadow-2xs">
                  {errorCode === "FORBIDDEN_ROLE" || errorCode === "CASE_NOT_FOUND" ? (
                    <ShieldAlert className="w-7 h-7" />
                  ) : (
                    <AlertCircle className="w-7 h-7" />
                  )}
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {errorCode === "FORBIDDEN_ROLE"
                      ? t("asha.caseUnauthorized")
                      : errorCode === "CASE_NOT_FOUND"
                      ? t("asha.caseNotFound")
                      : "Case Information Unavailable"}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    {errorCode === "FORBIDDEN_ROLE"
                      ? t("asha.caseUnauthorizedDesc")
                      : errorCode === "CASE_NOT_FOUND"
                      ? t("asha.caseNotFoundDesc")
                      : errorMessage || "An unexpected error occurred while retrieving case details."}
                  </p>
                </div>

                <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => router.push(exitHref)}
                    className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t("asha.returnToCaseload")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadCaseDetail}
                    className="text-xs font-semibold flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Again</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. DEDICATED CASE WORKSPACE (When loaded)                   */}
          {/* ============================================================ */}
          {!isLoading && caseDetail && (
            <div className="space-y-6">
              {/* Zone A: Case Header */}
              <CaseWorkspaceHeader
                caseDetail={caseDetail}
                caseNfcStatus={caseNfcStatus}
                selectedRequestContext={selectedRequestContext}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onOpenNfc={() => setIsNfcModalOpen(true)}
                onOpenAssistant={() => setIsAssistantOpen(true)}
                onOpenVoiceCall={() => handleOpenVoiceCallModal()}
                exitHref={exitHref}
                isUpdating={isUpdating}
              />

              {/* Zone B & C: Responsive Navigation & Main Workspace */}
              <div className="flex flex-col lg:flex-row items-start gap-6">
                {/* Zone B: Case Navigation (Sidebar on desktop / selector on mobile) */}
                <div className="w-full lg:w-60 shrink-0">
                  <CaseWorkspaceNav
                    activeSection={activeSection}
                    onSelectSection={handleSelectSection}
                    badgeCounts={{
                      gapsCount: caseDetail.guidance.gaps.length,
                      schemesCount: caseDetail.eligibilityResults?.length,
                      tasksCount: caseDetail.tasks?.filter((t) => t.status !== "COMPLETED").length,
                      notesCount: caseDetail.notes?.length,
                      activitiesCount: caseDetail.activities?.length,
                      isUrgent: caseDetail.case.priority === "URGENT",
                    }}
                  />
                </div>

                {/* Zone C: Main Workspace Content */}
                <main className="flex-1 w-full min-w-0">
                  {activeSection === "overview" && (
                    <CaseOverviewSection
                      caseDetail={caseDetail}
                      onNavigateSection={handleSelectSection}
                      onInitiateScheme={(schemeId, beneficiaryId) =>
                        handleInitiateScheme(caseId, schemeId, beneficiaryId)
                      }
                    />
                  )}

                  {activeSection === "journey" && (
                    <CaseJourneySection
                      caseDetail={caseDetail}
                      selectedRequestContext={selectedRequestContext}
                      onInitiateScheme={handleInitiateScheme}
                      onCompleteTask={handleCompleteTask}
                      onCreateTask={handleCreateTask}
                      onOpenVoiceCall={() => handleOpenVoiceCallModal()}
                      initiatingSchemeId={initiatingSchemeId}
                    />
                  )}

                  {activeSection === "household" && (
                    <CaseHouseholdSection
                      caseDetail={caseDetail}
                      caseNfcStatus={caseNfcStatus}
                      onOpenNfc={() => setIsNfcModalOpen(true)}
                    />
                  )}

                  {activeSection === "attention" && (
                    <CaseAttentionSection caseDetail={caseDetail} />
                  )}

                  {activeSection === "benefits" && (
                    <CaseBenefitsSection caseDetail={caseDetail} />
                  )}

                  {activeSection === "tasks" && (
                    <CaseTasksSection
                      caseDetail={caseDetail}
                      onScheduleFollowUp={handleScheduleFollowUp}
                      onCompleteFollowUp={handleCompleteFollowUp}
                      onOpenVoiceCall={handleOpenVoiceCallModal}
                    />
                  )}

                  {activeSection === "notes" && (
                    <CaseNotesSection
                      caseDetail={caseDetail}
                      onAddNote={handleAddNote}
                    />
                  )}

                  {activeSection === "audit" && (
                    <CaseAuditSection caseDetail={caseDetail} />
                  )}
                </main>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODALS & OVERLAYS (Accessible from Dedicated Workspace)      */}
          {/* ============================================================ */}
          {/* 1. Household NFC Card Modal */}
          {isNfcModalOpen && caseDetail && (
            <AshaNfcModal
              isOpen={isNfcModalOpen}
              onClose={() => setIsNfcModalOpen(false)}
              householdId={caseDetail.household.id}
              headOfHouseholdName={caseDetail.household.headOfHouseholdName}
              village={caseDetail.household.village}
              district={caseDetail.household.district}
              state={caseDetail.household.state}
              onNfcStatusChanged={() => {
                if (caseDetail.household.id) {
                  fetchNfcStatus(caseDetail.household.id);
                }
              }}
            />
          )}

          {/* 2. SwasthyaSetu Healthcare Assistant Drawer */}
          <HealthcareAssistantDrawer
            isOpen={isAssistantOpen}
            onClose={() => setIsAssistantOpen(false)}
            userRole="ASHA"
          />

          {/* 3. Real ASHA Telephony Call Modal */}
          {voiceCallTarget && (
            <AshaCallModal
              isOpen={isVoiceCallModalOpen}
              onClose={() => {
                setIsVoiceCallModalOpen(false);
                setVoiceCallTarget(null);
              }}
              caseId={voiceCallTarget.caseId}
              citizenName={voiceCallTarget.citizenName}
              headOfHousehold={voiceCallTarget.headOfHousehold}
              schemeName={voiceCallTarget.schemeName}
              contactPhoneMasked={voiceCallTarget.contactPhoneMasked}
              followUpId={voiceCallTarget.followUpId}
              defaultReason={voiceCallTarget.defaultReason}
              onCallComplete={() => {
                loadCaseDetail();
              }}
            />
          )}
        </div>
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
