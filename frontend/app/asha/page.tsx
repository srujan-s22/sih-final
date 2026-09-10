"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Users,
  AlertCircle,
  Clock,
  Clock3,
  CheckCircle2,
  Plus,
  Bot,
  Search,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Activity,
  X,
  Send,
  Copy,
  Check,
  UserPlus,
  Inbox,
  Link2,
  MessageSquare,
  HelpCircle,
  FileText,
  History,
  CheckSquare,
  ArrowRight,
  UserCheck,
  User,
  ShieldAlert,
  AlertTriangle,
  CalendarDays,
  FileCheck,
  PhoneCall,
  Radio,
} from "lucide-react";
import { caseService } from "@/services/case-service";
import { nfcService } from "@/services/nfc-service";
import { connectionService } from "@/services/connection-service";
import { assistanceService } from "@/services/assistance-service";
import { voiceService } from "@/services/voice-service";
import { leaveService } from "@/services/leave-service";
import { AshaLeaveRequest } from "@shared/types/leave";
import {
  AshaCase,
  CaseSummaryResponse,
  CaseFollowUp,
  FollowUpSummaryResponse,
  CaseStatus,
  CasePriority,
  AshaAttentionSignal,
} from "@shared/types/case";
import { AshaConnectionRequest } from "@shared/types/connection";
import {
  AshaAssistanceRequest,
  AssistanceStatus,
} from "@shared/types/assistance";
import { IncomeCategory } from "@shared/types/household";
import { HealthcareAssistantDrawer } from "@/components/assistant/healthcare-assistant-drawer";
import { AshaCallModal } from "@/components/voice/asha-call-modal";

export default function AshaWorkspacePage() {
  const { userProfile, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Caseload Data
  const [cases, setCases] = useState<AshaCase[]>([]);
  const [summary, setSummary] = useState<CaseSummaryResponse | null>(null);

  // Proactive Attention Signals Data
  const [attentionSignals, setAttentionSignals] = useState<AshaAttentionSignal[]>([]);
  const [isSignalsLoading, setIsSignalsLoading] = useState(false);
  const [initiatingSchemeId, setInitiatingSchemeId] = useState<string | null>(null);

  // Connection Requests Data
  const [connectionRequests, setConnectionRequests] = useState<AshaConnectionRequest[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [copiedServiceCode, setCopiedServiceCode] = useState(false);

  // Citizen Assistance Requests Data
  const [assistanceRequests, setAssistanceRequests] = useState<AshaAssistanceRequest[]>([]);
  const [requestsSubTab, setRequestsSubTab] = useState<"assistance" | "connections">("assistance");
  const [assistanceResponseNotes, setAssistanceResponseNotes] = useState<Record<string, string>>({});
  const [isUpdatingAssistance, setIsUpdatingAssistance] = useState<string | null>(null);
  const [decliningRequestId, setDecliningRequestId] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  const router = useRouter();
  const [nfcStatusMap, setNfcStatusMap] = useState<Record<string, boolean>>({});

  // Phase 10 Follow-ups State
  const [followUpSummary, setFollowUpSummary] = useState<FollowUpSummaryResponse | null>(null);
  const [isFollowUpsLoading, setIsFollowUpsLoading] = useState(false);
  const [followUpFilter, setFollowUpFilter] = useState<"ALL" | "DUE_TODAY" | "OVERDUE" | "UPCOMING" | "COMPLETED" | "CANCELLED">("ALL");

  // Complete Follow-up Modal State
  const [completingFollowUp, setCompletingFollowUp] = useState<CaseFollowUp | null>(null);
  const [completeOutcome, setCompleteOutcome] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const [isCompletingSubmitting, setIsCompletingSubmitting] = useState(false);

  // Reschedule Follow-up Modal State
  const [reschedulingFollowUp, setReschedulingFollowUp] = useState<CaseFollowUp | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [isReschedulingSubmitting, setIsReschedulingSubmitting] = useState(false);

  // Cancel Follow-up Modal State (Phase 10)
  const [cancellingFollowUp, setCancellingFollowUp] = useState<CaseFollowUp | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancellingSubmitting, setIsCancellingSubmitting] = useState(false);

  // Voice Reminder Call State (Phase 11)
  const [isVoiceCallingId, setIsVoiceCallingId] = useState<string | null>(null);
  const [isAshaCallModalOpen, setIsAshaCallModalOpen] = useState(false);
  const [callModalTarget, setCallModalTarget] = useState<{
    caseId: string;
    citizenName?: string;
    headOfHousehold?: string;
    schemeName?: string;
    contactPhoneMasked?: string;
    followUpId?: string;
    defaultReason?: string;
  } | null>(null);



  // Phase 8 Assistant Integration
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Leave Request State (ASHA Leave & Reassignment)
  const [leaveRequests, setLeaveRequests] = useState<AshaLeaveRequest[]>([]);
  const [isLeaveLoading, setIsLeaveLoading] = useState(false);
  const [isLeaveSubmitting, setIsLeaveSubmitting] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null);
  const [cancellingLeaveId, setCancellingLeaveId] = useState<string | null>(null);

  const loadLeaveRequests = useCallback(async () => {
    setIsLeaveLoading(true);
    try {
      const res = await leaveService.getMyLeaveRequests();
      if (res.success && res.data?.leaveRequests) {
        setLeaveRequests(res.data.leaveRequests);
      }
    } catch {
      // ignore
    } finally {
      setIsLeaveLoading(false);
    }
  }, []);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveError(null);
    setLeaveSuccess(null);
    if (!leaveStartDate || !leaveEndDate) {
      setLeaveError("Please select both start and end dates.");
      return;
    }
    if (new Date(leaveStartDate) > new Date(leaveEndDate)) {
      setLeaveError("Start date cannot be after end date.");
      return;
    }
    if (leaveReason.trim().length < 5) {
      setLeaveError("Please provide a reason of at least 5 characters.");
      return;
    }
    setIsLeaveSubmitting(true);
    try {
      const res = await leaveService.submitLeaveRequest({
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason.trim(),
      });
      if (res.success) {
        setLeaveSuccess("Leave request submitted successfully and is pending administrator review.");
        setLeaveStartDate("");
        setLeaveEndDate("");
        setLeaveReason("");
        await loadLeaveRequests();
      } else {
        setLeaveError(res.error?.message || "Failed to submit leave request.");
      }
    } catch (err: any) {
      setLeaveError(err.message || "Error submitting leave request.");
    } finally {
      setIsLeaveSubmitting(false);
    }
  };

  const handleCancelLeave = async (id: string) => {
    setCancellingLeaveId(id);
    try {
      const res = await leaveService.cancelLeaveRequest(id);
      if (res.success) {
        await loadLeaveRequests();
      }
    } catch {
      // ignore
    } finally {
      setCancellingLeaveId(null);
    }
  };

  // Load ASHA Caseload & Summary
  const loadCaseload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [casesRes, summaryRes] = await Promise.all([
        caseService.listCases(),
        caseService.getSummary(),
      ]);

      if (casesRes.success && casesRes.data) {
        setCases(casesRes.data.cases);
        // Non-blocking background fetch of NFC status for households in caseload
        const uniqueHouseholdIds = Array.from(new Set(casesRes.data.cases.map((c) => c.householdId)));
        uniqueHouseholdIds.forEach(async (hhId) => {
          try {
            const nfcRes = await nfcService.getHouseholdNfcStatus(hhId);
            if (nfcRes.success && nfcRes.data) {
              setNfcStatusMap((prev) => ({
                ...prev,
                [hhId]: nfcRes.data.hasActiveNfc,
              }));
            }
          } catch {
            // Non-blocking
          }
        });
      }
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
    } catch {
      setErrorMessage("Could not load assigned caseload data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load Phase 10 Follow-ups Roster
  const loadFollowUps = useCallback(async () => {
    setIsFollowUpsLoading(true);
    try {
      const res = await caseService.listAshaFollowUps();
      if (res.success && res.data) {
        setFollowUpSummary(res.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsFollowUpsLoading(false);
    }
  }, []);

  // Load Proactive Attention Signals
  const loadAttentionSignals = useCallback(async () => {
    setIsSignalsLoading(true);
    try {
      const res = await caseService.getAttentionSignals();
      if (res.success && res.data) {
        setAttentionSignals(res.data.signals);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsSignalsLoading(false);
    }
  }, []);

  // Load Pending Connection Requests
  const loadPendingRequests = useCallback(async () => {
    setIsRequestsLoading(true);
    try {
      const res = await connectionService.listPendingRequestsForAsha();
      if (res.success && res.data) {
        setConnectionRequests(res.data.requests);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsRequestsLoading(false);
    }
  }, []);

  // Load Citizen Assistance Requests
  const loadAssistanceRequests = useCallback(async () => {
    try {
      const res = await assistanceService.listAshaAssistanceRequests();
      if (res.success && res.data) {
        setAssistanceRequests(res.data.requests);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated || (userProfile?.role !== "ASHA" && userProfile?.role !== "ADMIN")) {
      return;
    }
    loadCaseload();
    loadFollowUps();
    loadAttentionSignals();
    loadPendingRequests();
    loadAssistanceRequests();
    loadLeaveRequests();
  }, [authLoading, isAuthenticated, userProfile?.role, loadCaseload, loadFollowUps, loadAttentionSignals, loadPendingRequests, loadAssistanceRequests, loadLeaveRequests]);

  // Handle Proactive Scheme Initiation
  const handleInitiateScheme = async (
    caseId: string,
    schemeId: string,
    beneficiaryMemberId?: string | null
  ) => {
    setInitiatingSchemeId(`${caseId}_${schemeId}`);
    setErrorMessage(null);
    try {
      const res = await caseService.initiateScheme(caseId, {
        schemeId,
        beneficiaryMemberId,
        priority: "HIGH",
        notes: `ASHA worker initiated doorstep facilitation for ${
          schemeId === "ab-pmjay" ? "PM-JAY Senior 70+" : "JSY Maternal Care"
        }.`,
      });

      if (res.success && res.data) {
        setSuccessBanner(
          `Successfully initiated ${
            schemeId === "ab-pmjay" ? "PM-JAY Senior 70+" : "JSY Maternal Care"
          } doorstep assistance journey.`
        );
        await Promise.all([loadCaseload(), loadAttentionSignals(), loadAssistanceRequests()]);
        openCaseDetail(caseId, "journey");
      } else {
        const errMsg = (res as any).error?.message || (res as any).message || "Failed to initiate scheme assistance.";
        setErrorMessage(errMsg);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to initiate scheme assistance.");
    } finally {
      setInitiatingSchemeId(null);
    }
  };

  // Handle Accept Connection Request
  const handleAcceptRequest = async (requestId: string) => {
    try {
      const res = await connectionService.acceptConnectionRequest(requestId);
      if (res.success) {
        setSuccessBanner("Household connection accepted and added to your caseload.");
        await Promise.all([loadCaseload(), loadPendingRequests()]);
      } else {
        setErrorMessage((res as any).error?.message || "Failed to accept connection request.");
      }
    } catch {
      setErrorMessage("Failed to accept connection request.");
    }
  };

  // Handle Reject Connection Request
  const handleRejectRequest = async (requestId: string) => {
    try {
      const res = await connectionService.rejectConnectionRequest(requestId);
      if (res.success) {
        setSuccessBanner("Connection request declined.");
        await loadPendingRequests();
      } else {
        setErrorMessage((res as any).error?.message || "Failed to reject connection request.");
      }
    } catch {
      setErrorMessage("Failed to reject connection request.");
    }
  };

  // Handle Update Assistance Request Status
  const handleUpdateAssistance = async (
    requestId: string,
    newStatus: AssistanceStatus,
    note?: string
  ) => {
    setIsUpdatingAssistance(requestId);
    try {
      const res = await assistanceService.updateAssistanceRequest(requestId, {
        status: newStatus,
        responseNote: note || assistanceResponseNotes[requestId] || undefined,
      });

      if (res.success) {
        setSuccessBanner(`Assistance request updated to '${newStatus}'.`);
        await Promise.all([loadAssistanceRequests(), loadCaseload()]);
      } else {
        setErrorMessage(res.error?.message || "Failed to update assistance request.");
      }
    } catch {
      setErrorMessage("Failed to update assistance request.");
    } finally {
      setIsUpdatingAssistance(null);
    }
  };

  const copyServiceCode = () => {
    if (userProfile?.ashaServiceCode) {
      navigator.clipboard.writeText(userProfile.ashaServiceCode);
      setCopiedServiceCode(true);
      setTimeout(() => setCopiedServiceCode(false), 2000);
    }
  };

  // Navigate to Dedicated Case Details Page
  const openCaseDetail = (
    caseId: string,
    initialTab: string = "overview",
    requestContext: AshaAssistanceRequest | null = null
  ) => {
    let url = `/asha/cases/${encodeURIComponent(caseId)}`;
    const params = new URLSearchParams();
    if (initialTab && initialTab !== "overview") {
      params.append("tab", initialTab);
    }
    if (requestContext?.id) {
      params.append("requestId", requestContext.id);
    }
    const qs = params.toString();
    if (qs) {
      url += `?${qs}`;
    }
    router.push(url);
  };

  // Open Case Detail by Household ID
  const openCaseDetailByHousehold = (
    householdId: string,
    initialTab: string = "overview",
    requestContext: AshaAssistanceRequest | null = null
  ) => {
    const matchingCase = cases.find((c) => c.householdId === householdId);
    if (matchingCase) {
      openCaseDetail(matchingCase.id, initialTab, requestContext);
    } else {
      setErrorMessage("Case for this household not found in your assigned caseload.");
    }
  };

  // Open Complete Follow-Up Modal
  const handleOpenCompleteModal = (followUp: CaseFollowUp) => {
    setCompletingFollowUp(followUp);
    setCompleteOutcome("");
    setCompleteNotes("");
  };

  // Submit Complete Follow-Up
  const handleCompleteFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingFollowUp || !completeOutcome.trim()) return;
    setIsCompletingSubmitting(true);
    try {
      const res = await caseService.completeFollowUp(
        completingFollowUp.caseId,
        completingFollowUp.id,
        completeOutcome.trim(),
        completeNotes.trim() || null
      );
      if (res.success) {
        setCompletingFollowUp(null);
        setCompleteOutcome("");
        setCompleteNotes("");
        setSuccessBanner(`Follow-up marked completed: "${completingFollowUp.reason}"`);
        await Promise.all([loadFollowUps(), loadCaseload(), loadAttentionSignals()]);
      }
    } catch {
      setErrorMessage("Failed to complete follow-up.");
    } finally {
      setIsCompletingSubmitting(false);
    }
  };

  // Open Reschedule Follow-Up Modal
  const handleOpenRescheduleModal = (followUp: CaseFollowUp) => {
    setReschedulingFollowUp(followUp);
    setRescheduleDate(followUp.dueAt ? followUp.dueAt.split("T")[0] : "");
    setRescheduleReason("");
  };

  // Submit Reschedule Follow-Up
  const handleRescheduleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingFollowUp || !rescheduleDate || !rescheduleReason.trim()) return;
    setIsReschedulingSubmitting(true);
    try {
      const res = await caseService.rescheduleFollowUp(
        reschedulingFollowUp.caseId,
        reschedulingFollowUp.id,
        new Date(rescheduleDate).toISOString(),
        rescheduleReason.trim()
      );
      if (res.success) {
        setReschedulingFollowUp(null);
        setRescheduleDate("");
        setRescheduleReason("");
        setSuccessBanner(`Follow-up rescheduled to ${new Date(rescheduleDate).toLocaleDateString()}`);
        await Promise.all([loadFollowUps(), loadCaseload()]);
      }
    } catch {
      setErrorMessage("Failed to reschedule follow-up.");
    } finally {
      setIsReschedulingSubmitting(false);
    }
  };

  // Open Cancel Follow-Up Modal (Phase 10)
  const handleOpenCancelModal = (followUp: CaseFollowUp) => {
    setCancellingFollowUp(followUp);
    setCancelReason("");
  };

  // Submit Cancel Follow-Up (Phase 10)
  const handleCancelFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingFollowUp || !cancelReason.trim()) return;
    setIsCancellingSubmitting(true);
    try {
      const res = await caseService.cancelFollowUp(
        cancellingFollowUp.caseId,
        cancellingFollowUp.id,
        cancelReason.trim()
      );
      if (res.success) {
        setCancellingFollowUp(null);
        setCancelReason("");
        setSuccessBanner(`Follow-up cancelled: "${cancellingFollowUp.title || cancellingFollowUp.reason}"`);
        await Promise.all([loadFollowUps(), loadCaseload(), loadAttentionSignals()]);
      }
    } catch {
      setErrorMessage("Failed to cancel follow-up.");
    } finally {
      setIsCancellingSubmitting(false);
    }
  };

  // Trigger Outbound Voice Reminder / Assistance Call (Phase 11)
  const handleOpenVoiceCallModal = (followUp?: CaseFollowUp, targetCase?: AshaCase) => {
    const targetCaseId = followUp?.caseId || targetCase?.id || "";
    const name = targetCase?.headOfHouseholdName || "Beneficiary";
    const phone = "+91 98*** **210";

    setCallModalTarget({
      caseId: targetCaseId,
      citizenName: name,
      headOfHousehold: targetCase?.headOfHouseholdName,
      schemeName: targetCase?.schemeName || "Government Health Scheme",
      contactPhoneMasked: phone,
      followUpId: followUp?.id,
      defaultReason: followUp
        ? `Doorstep visit reminder: ${followUp.title || followUp.reason}`
        : `Outreach for ${targetCase?.schemeName || "health scheme"} follow-up`,
    });
    setIsAshaCallModalOpen(true);
  };

  const handleTriggerVoiceCall = async (followUp: CaseFollowUp) => {
    handleOpenVoiceCallModal(followUp);
  };

  // Accept Assistance Request -> Opens & Initializes Scheme Case Workflow
  const handleAcceptAssistance = async (requestId: string) => {
    setIsUpdatingAssistance(requestId);
    try {
      const res = await assistanceService.acceptAssistanceRequest(requestId);
      if (res.success && res.data) {
        setSuccessBanner("Assistance request accepted! Scheme journey & tasks have been initialized.");
        await loadAssistanceRequests();
        await loadCaseload();
        if (res.data.caseId) {
          openCaseDetail(res.data.caseId, "journey");
        }
      }
    } catch {
      // Quiet fail
    } finally {
      setIsUpdatingAssistance(null);
    }
  };

  // Decline Assistance Request
  const handleDeclineAssistance = async (requestId: string) => {
    if (!declineReasonText.trim()) return;
    setIsUpdatingAssistance(requestId);
    try {
      const res = await assistanceService.declineAssistanceRequest(requestId, declineReasonText.trim());
      if (res.success) {
        setDecliningRequestId(null);
        setDeclineReasonText("");
        await loadAssistanceRequests();
      }
    } catch {
      // Quiet fail
    } finally {
      setIsUpdatingAssistance(null);
    }
  };



  // --- Single Source of Truth: Unified Selectors & State Derivations ---
  const totalAssignedHouseholds = cases.length;

  // Active (Actionable) Assistance Requests (excluding terminal statuses: RESOLVED, CLOSED, DECLINED)
  const activeAssistanceRequests = assistanceRequests.filter(
    (r) => !["RESOLVED", "CLOSED", "DECLINED"].includes(r.status)
  );
  const activeAssistanceCount = activeAssistanceRequests.length;
  const pendingConnectionCount = connectionRequests.length;
  const totalActiveRequestsCount = activeAssistanceCount + pendingConnectionCount;
  const totalAllRequestsCount = assistanceRequests.length + connectionRequests.length;

  // Proactive Attention Signals (Single source of truth for Needs Attention & Entitlement Opportunities)
  const totalAttentionSignalsCount = attentionSignals.length;

  // Follow-up Counts & Actionable Badges
  const overdueFollowUpsCount = followUpSummary?.overdue ?? 0;
  const dueTodayFollowUpsCount = followUpSummary?.dueToday ?? 0;
  const upcomingFollowUpsCount = followUpSummary?.upcoming ?? 0;
  const completedFollowUpsCount = followUpSummary?.completed ?? 0;
  const cancelledFollowUpsCount =
    followUpSummary?.cancelled ??
    (followUpSummary?.followUps?.filter((f) => f.status === "CANCELLED").length ?? 0);
  const totalFollowUpsCount =
    followUpSummary?.total ?? (followUpSummary?.followUps?.length ?? 0);

  const actionableFollowUpBadge = overdueFollowUpsCount + dueTodayFollowUpsCount;

  const activeLeaveBadge = leaveRequests.filter((r) => r.status === "PENDING" || r.status === "APPROVED").length;

  const navTabs = [
    { id: "overview", label: t("navigation.dashboard"), icon: Activity },
    { id: "cases", label: t("navigation.caseload"), badge: totalAssignedHouseholds, icon: Users },
    {
      id: "requests",
      label: t("navigation.assistance"),
      badge: totalActiveRequestsCount > 0 ? totalActiveRequestsCount : undefined,
      badgeVariant: "warning" as const,
      icon: Inbox,
    },
    {
      id: "attention",
      label: t("navigation.attentionSignals"),
      badge: totalAttentionSignalsCount > 0 ? totalAttentionSignalsCount : undefined,
      badgeVariant: "danger" as const,
      icon: AlertCircle,
    },
    {
      id: "followups",
      label: t("navigation.followUps"),
      badge: actionableFollowUpBadge > 0 ? actionableFollowUpBadge : undefined,
      icon: Clock,
    },
    {
      id: "leave",
      label: "Leave & Coverage",
      badge: activeLeaveBadge > 0 ? activeLeaveBadge : undefined,
      badgeVariant: "primary" as const,
      icon: Calendar,
    },
  ];

  // Filtered Cases
  const filteredCases = cases.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && c.priority !== priorityFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.headOfHouseholdName.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  const needsAttentionCases = cases.filter(
    (c) => c.status === "NEEDS_ATTENTION" || c.detectedGapsCount > 0 || c.priority === "URGENT" || c.priority === "HIGH"
  );

  const upcomingFollowUpCases = cases.filter((c) => c.nextFollowUpAt);

  return (
    <ProtectedRoute allowedRoles={["ASHA", "ADMIN"]}>
      <AuthenticatedShell
        role="ASHA"
        title={
          activeTab === "cases"
            ? t("navigation.caseload")
            : activeTab === "requests"
            ? t("navigation.assistance")
            : activeTab === "attention"
            ? t("navigation.attentionSignals")
            : activeTab === "followups"
            ? t("navigation.followUps")
            : activeTab === "leave"
            ? t("leave.title")
            : t("navigation.dashboard")
        }
        description={
          activeTab === "cases"
            ? t("asha.workspaceDesc")
            : activeTab === "requests"
            ? t("asha.fieldPrioritiesTitle")
            : activeTab === "attention"
            ? t("asha.attentionRequired")
            : activeTab === "followups"
            ? t("asha.dueFollowUps")
            : activeTab === "leave"
            ? t("leave.desc")
            : t("asha.workspaceDesc")
        }
        navTabs={navTabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        actions={
          <div className="flex items-center gap-2">
            {userProfile?.ashaServiceCode && (
              <button
                onClick={copyServiceCode}
                title="Click to copy your unique ASHA Service Code"
                className="hidden sm:flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer font-mono"
              >
                <span className="text-[10px] font-semibold text-slate-400 font-sans uppercase">Code:</span>
                <span className="font-bold text-slate-900">{userProfile.ashaServiceCode}</span>
                {copiedServiceCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                )}
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssistantOpen(true)}
              className="text-xs font-semibold flex items-center gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 shadow-2xs cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t("citizen.healthcareAssistantBtn")}</span>
            </Button>
          </div>
        }
      >


        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <p>{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900 font-bold text-xs ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success Banner */}
        {successBanner && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p>{successBanner}</p>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
            <p className="text-sm font-medium text-slate-500">{t("common.loading")}</p>
          </div>
        ) : (
          <div>
            {/* ============================================================ */}
            {/* 1. DASHBOARD TAB (B1) */}
            {/* ============================================================ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Compact Operational Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div
                    onClick={() => setActiveTab("cases")}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs cursor-pointer hover:border-emerald-300 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {t("asha.totalAssignedHouseholds")}
                      </span>
                      <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1.5">
                      {totalAssignedHouseholds}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{t("citizen.portalSubtitle")}</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("attention")}
                    className="bg-amber-50/40 rounded-xl border border-amber-200 p-4 shadow-2xs cursor-pointer hover:border-amber-400 hover:bg-amber-50/70 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                        {t("asha.attentionRequired")}
                      </span>
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-2xl font-black text-amber-950 mt-1.5">
                      {totalAttentionSignalsCount}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {totalAttentionSignalsCount === 1 ? `1 ${t("status.action_required")}` : `${totalAttentionSignalsCount} ${t("status.action_required")}`}
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("followups")}
                    className="bg-rose-50/30 rounded-xl border border-rose-200 p-4 shadow-2xs cursor-pointer hover:border-rose-300 hover:bg-rose-50/60 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                        {t("asha.dueFollowUps")}
                      </span>
                      <Clock className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-2xl font-black text-rose-950 mt-1.5">
                      {actionableFollowUpBadge}
                    </p>
                    <p className="text-xs text-rose-700 mt-0.5">
                      {overdueFollowUpsCount} {t("status.urgent")}, {dueTodayFollowUpsCount} {t("status.pending")}
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("requests")}
                    className="bg-teal-50/30 rounded-xl border border-teal-200 p-4 shadow-2xs cursor-pointer hover:border-teal-300 hover:bg-teal-50/60 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                        {t("asha.activeAssistanceRequests")}
                      </span>
                      <Inbox className="w-4 h-4 text-teal-600" />
                    </div>
                    <p className="text-2xl font-black text-teal-950 mt-1.5">
                      {totalActiveRequestsCount}
                    </p>
                    <p className="text-xs text-teal-700 mt-0.5">
                      {activeAssistanceCount} {t("navigation.assistance")}
                    </p>
                  </div>
                </div>

                {/* Quick Action Navigation Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    {t("asha.fieldPrioritiesTitle")}:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("cases")}
                      className="text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 mr-1 text-slate-500" /> {t("common.search")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("requests")}
                      className="text-xs font-semibold bg-white border-teal-200 text-teal-900 hover:bg-teal-50 cursor-pointer"
                    >
                      <Inbox className="w-3.5 h-3.5 mr-1 text-teal-700" /> {t("navigation.assistance")} ({totalActiveRequestsCount})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("followups")}
                      className="text-xs font-semibold bg-white border-rose-200 text-rose-900 hover:bg-rose-50 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1 text-rose-700" /> {t("asha.dueFollowUps")} ({actionableFollowUpBadge})
                    </Button>
                  </div>
                </div>

                {/* TODAY'S PRIORITIES — HERO ACTION SECTION */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <span>{t("asha.fieldPrioritiesTitle")}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          {t("status.action_required")}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t("asha.workspaceDesc")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Column 1: Action Opportunities & Gaps */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <h4 className="text-sm font-bold text-slate-900">
                            {t("asha.entitlementOpportunities")} ({totalAttentionSignalsCount})
                          </h4>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("attention")}
                          className="text-xs font-semibold text-amber-900 border-amber-200 hover:bg-amber-50 cursor-pointer"
                        >
                          {t("common.viewDetails")}
                        </Button>
                      </div>

                      {totalAttentionSignalsCount === 0 ? (
                        <div className="py-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                          <p className="font-semibold text-slate-700">{t("status.completed")}</p>
                          <p className="text-slate-500">{t("citizen.portalSubtitle")}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {attentionSignals.slice(0, 3).map((sig) => (
                            <div
                              key={sig.id}
                              className="p-3.5 bg-slate-50/70 hover:bg-amber-50/40 rounded-xl border border-slate-200 space-y-2.5 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    sig.priority === "URGENT"
                                      ? "bg-rose-100 text-rose-800"
                                      : sig.priority === "HIGH"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {sig.priority === "URGENT" ? t("forms.priorityUrgent") : sig.priority === "HIGH" ? t("forms.priorityHigh") : t("forms.priorityNormal")}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase">
                                  {sig.category.replace(/_/g, " ")}
                                </span>
                              </div>

                              <div>
                                <h5 className="text-xs font-bold text-slate-900">{sig.title}</h5>
                                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{sig.subtitle}</p>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                <span className="text-[11px] font-semibold text-slate-700">
                                  {sig.headOfHouseholdName} • {sig.district}
                                </span>
                                <div className="flex items-center gap-2">
                                  {sig.actionType === "INITIATE_SCHEME" && sig.schemeId && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      disabled={initiatingSchemeId === `${sig.caseId}_${sig.schemeId}`}
                                      onClick={() =>
                                        handleInitiateScheme(sig.caseId, sig.schemeId!, sig.beneficiaryMemberId)
                                      }
                                      className="text-xs font-bold py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                                    >
                                      {initiatingSchemeId === `${sig.caseId}_${sig.schemeId}`
                                        ? t("common.submitting")
                                        : t("asha.assistHousehold")}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openCaseDetail(sig.caseId)}
                                    className="text-xs font-semibold py-1 px-2.5 text-slate-700 hover:bg-white cursor-pointer"
                                  >
                                    {t("asha.openCaseDrawer")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Incoming Requests & Due Visits */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Inbox className="w-4 h-4 text-teal-700" />
                          <h4 className="text-sm font-bold text-slate-900">
                            {t("navigation.assistance")} & {t("asha.dueFollowUps")}
                          </h4>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("requests")}
                          className="text-xs font-semibold text-teal-900 border-teal-200 hover:bg-teal-50 cursor-pointer"
                        >
                          {t("common.viewDetails")} ({totalActiveRequestsCount})
                        </Button>
                      </div>

                      {(() => {
                        const todayIsoStr = new Date().toISOString().split("T")[0];
                        const dueTodayFollowUpsList = (followUpSummary?.followUps || []).filter(
                          (f) =>
                            f.status === "PENDING" &&
                            (f.isOverdue ||
                              (f.dueAt && f.dueAt.startsWith(todayIsoStr)) ||
                              (f.scheduledAt && f.scheduledAt.startsWith(todayIsoStr)))
                        );

                        if (activeAssistanceRequests.length === 0 && dueTodayFollowUpsList.length === 0) {
                          return (
                            <div className="py-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
                              <Inbox className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                              <p className="font-semibold text-slate-700">{t("citizen.noAssistanceRequests")}</p>
                              <p className="text-slate-500">{t("citizen.portalSubtitle")}</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {/* Active Assistance Requests snippet */}
                            {activeAssistanceRequests.slice(0, 2).map((req) => (
                              <div
                                key={req.id}
                                className="p-3.5 bg-teal-50/30 rounded-xl border border-teal-200 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">{req.headOfHouseholdName}</span>
                                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.2 rounded">
                                      {req.category.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                                    {req.status}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 line-clamp-2 italic bg-white p-2 rounded border border-teal-100">
                                  &ldquo;{req.message}&rdquo;
                                </p>

                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[11px] text-slate-500">
                                    {req.schemeName || "General Doorstep Assistance"}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {req.status === "PENDING" && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleAcceptAssistance(req.id)}
                                        className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-1 px-2.5 cursor-pointer"
                                      >
                                        {t("common.confirm")}
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setRequestsSubTab("assistance");
                                        setActiveTab("requests");
                                      }}
                                      className="text-xs font-semibold py-1 px-2.5 cursor-pointer"
                                    >
                                      {t("common.viewDetails")}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {/* Due Today Follow-up snippet */}
                            {dueTodayFollowUpsList.slice(0, 2).map((f) => (
                              <div
                                key={f.id}
                                className="p-3.5 bg-amber-50/30 rounded-xl border border-amber-200 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-900">
                                    {f.headOfHouseholdName || "Assigned Family"}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                      f.isOverdue ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {f.isOverdue ? t("status.urgent") : t("status.pending")}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 font-medium">{f.title || f.reason}</p>
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[11px] text-slate-500">
                                    Due: {new Date(f.dueAt || f.scheduledAt).toLocaleDateString()}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleOpenCompleteModal(f)}
                                      className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-1 px-2.5 cursor-pointer"
                                    >
                                      {t("status.completed")}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openCaseDetail(f.caseId)}
                                      className="text-xs font-semibold py-1 px-2.5 cursor-pointer"
                                    >
                                      {t("asha.openCaseDrawer")}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 2. MY ASSIGNED HOUSEHOLDS TAB (B2) */}
            {/* ============================================================ */}
            {activeTab === "cases" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {t("asha.caseloadTitle")} ({cases.length})
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {t("asha.workspaceDesc")}
                    </p>
                  </div>
                </div>

                {/* Search & Filter Controls */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder={t("asha.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="text-xs py-2 px-3 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
                    >
                      <option value="ALL">{t("common.all")}</option>
                      <option value="NEW">{t("status.new")}</option>
                      <option value="ACTIVE">{t("common.active")}</option>
                      <option value="NEEDS_ATTENTION">{t("status.action_required")}</option>
                      <option value="FOLLOW_UP">{t("navigation.followUps")}</option>
                      <option value="RESOLVED">{t("status.resolved")}</option>
                      <option value="CLOSED">{t("status.completed")}</option>
                    </select>

                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="text-xs py-2 px-3 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
                    >
                      <option value="ALL">{t("common.all")}</option>
                      <option value="URGENT">{t("forms.priorityUrgent")}</option>
                      <option value="HIGH">{t("forms.priorityHigh")}</option>
                      <option value="NORMAL">{t("forms.priorityNormal")}</option>
                      <option value="LOW">{t("forms.priorityLow")}</option>
                    </select>
                  </div>
                </div>

                {/* Card-Based Household Roster */}
                {filteredCases.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-2">
                    <Users className="w-9 h-9 text-slate-300 mx-auto mb-1" />
                    <h3 className="text-sm font-bold text-slate-800">{t("asha.noCasesFound")}</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {t("asha.myCaseloadDesc")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCases.map((c) => {
                      const isResolved = c.status === "RESOLVED" || c.status === "CLOSED";
                      const isNeedsAttention = c.status === "NEEDS_ATTENTION" || c.detectedGapsCount > 0;

                      return (
                        <div
                          key={c.id}
                          onClick={() => openCaseDetail(c.id)}
                          className={`rounded-xl border p-5 shadow-2xs space-y-4 flex flex-col justify-between cursor-pointer hover:border-emerald-400 hover:shadow-xs transition-all ${
                            isResolved
                              ? "bg-slate-50/60 border-slate-200"
                              : isNeedsAttention
                              ? "bg-amber-50/20 border-amber-200"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0">
                                  {c.headOfHouseholdName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                    {c.headOfHouseholdName}
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {c.district}, {c.state}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  c.priority === "URGENT"
                                    ? "bg-rose-100 text-rose-800"
                                    : c.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {c.priority === "URGENT" ? t("forms.priorityUrgent") : c.priority === "HIGH" ? t("forms.priorityHigh") : t("forms.priorityNormal")}
                              </span>
                            </div>

                            {/* Ration Category & Status Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                                {t("citizen.incomeCategory")}: {c.incomeCategory}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  isResolved
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : c.status === "ACTIVE"
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : isNeedsAttention
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                                }`}
                              >
                                {c.status.replace(/_/g, " ")}
                              </span>
                              {nfcStatusMap[c.householdId] !== undefined && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                                    nfcStatusMap[c.householdId]
                                      ? "bg-teal-50 text-teal-800 border-teal-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  <Radio className="w-2.5 h-2.5" />
                                  <span>{nfcStatusMap[c.householdId] ? "NFC: Registered" : "NFC: None"}</span>
                                </span>
                              )}
                            </div>

                            {/* Active Scheme or Gap detail */}
                            <div className="pt-2 border-t border-slate-100 text-xs">
                              {c.schemeName ? (
                                <div className="p-2 bg-teal-50/50 rounded-lg border border-teal-100 text-teal-950 font-semibold text-[11px] flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                  <span className="truncate">{c.schemeName}</span>
                                </div>
                              ) : c.detectedGapsCount > 0 ? (
                                <div className="p-2 bg-amber-50/50 rounded-lg border border-amber-100 text-amber-900 font-semibold text-[11px] flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>{c.detectedGapsCount} {t("asha.attentionRequired")}</span>
                                </div>
                              ) : (
                                <div className="text-slate-500 text-[11px] flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{t("status.completed")}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {t("common.code")}: {c.id.slice(0, 10)}...
                            </span>
                            <span className="font-bold text-emerald-800 flex items-center gap-1 hover:text-emerald-950">
                              <span>{t("asha.openCaseDrawer")}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* 3. ASSISTANCE REQUESTS TAB (B3) */}
            {/* ============================================================ */}
            {activeTab === "requests" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {t("navigation.assistance")}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {t("asha.fieldPrioritiesTitle")}
                    </p>
                  </div>
                </div>

                {/* Subtab Switcher */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    onClick={() => setRequestsSubTab("assistance")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      requestsSubTab === "assistance"
                        ? "bg-teal-800 text-white shadow-2xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {t("navigation.assistance")} ({activeAssistanceCount} {t("common.active")} / {assistanceRequests.length} {t("common.all")})
                  </button>
                  <button
                    onClick={() => setRequestsSubTab("connections")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      requestsSubTab === "connections"
                        ? "bg-emerald-700 text-white shadow-2xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {t("citizen.ashaSectionTitle")} ({pendingConnectionCount})
                  </button>
                </div>

                {/* SUBTAB A: CITIZEN ASSISTANCE REQUESTS */}
                {requestsSubTab === "assistance" && (
                  <div className="space-y-4">
                    {assistanceRequests.length === 0 ? (
                      <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-8 space-y-2">
                        <MessageSquare className="w-9 h-9 text-slate-300 mx-auto mb-1" />
                        <h3 className="text-base font-bold text-slate-800">{t("citizen.noAssistanceRequests")}</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {t("citizen.ashaCardDesc")}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...assistanceRequests].sort((a, b) => {
                          const aActive = !["RESOLVED", "CLOSED", "DECLINED"].includes(a.status);
                          const bActive = !["RESOLVED", "CLOSED", "DECLINED"].includes(b.status);
                          if (aActive && !bActive) return -1;
                          if (!aActive && bActive) return 1;
                          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        }).map((req) => {
                          const isResolved = req.status === "RESOLVED" || req.status === "CLOSED";
                          const isDeclined = req.status === "DECLINED";
                          const isPending = req.status === "PENDING" || req.status === "REQUESTED";

                          return (
                            <div
                              key={req.id}
                              className={`rounded-xl border p-5 shadow-2xs space-y-4 flex flex-col justify-between transition-all ${
                                isResolved
                                  ? "border-emerald-200 bg-emerald-50/15"
                                  : isDeclined
                                  ? "border-rose-200 bg-rose-50/20"
                                  : isPending
                                  ? "border-teal-300 bg-teal-50/20 ring-2 ring-teal-200/50"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-bold text-slate-900">{req.headOfHouseholdName}</h4>
                                      <span className="text-[10px] font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                        {req.category.replace(/_/g, " ")}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {req.district}, {req.state} • {new Date(req.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                      isResolved
                                        ? "bg-emerald-100 text-emerald-800"
                                        : isDeclined
                                        ? "bg-rose-100 text-rose-800"
                                        : req.status === "IN_PROGRESS" || req.status === "ACCEPTED"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {req.status}
                                  </span>
                                </div>

                                {/* Beneficiary Member Tag */}
                                {req.beneficiaryName && (
                                  <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-2.5 flex items-center justify-between text-xs text-emerald-950">
                                    <div className="flex items-center gap-1.5 font-semibold">
                                      <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>{t("citizen.headOfHousehold")}: {req.beneficiaryName}</span>
                                    </div>
                                    <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
                                      {req.beneficiaryRelationship || t("common.member")}{req.beneficiaryAge ? `, ${req.beneficiaryAge} yrs` : ""}
                                    </span>
                                  </div>
                                )}

                                {req.schemeName && (
                                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800">
                                    {t("citizen.healthBenefits")}: <strong>{req.schemeName}</strong>
                                  </div>
                                )}

                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800">
                                  <span className="font-semibold block text-[10px] text-slate-400 uppercase">
                                    {t("forms.notes")}:
                                  </span>
                                  <p className="mt-0.5 leading-relaxed">&ldquo;{req.message}&rdquo;</p>
                                </div>

                                {req.responseNote && (
                                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                                    <span className="font-semibold block text-[10px] uppercase">{t("forms.notes")}:</span>
                                    <p className="mt-0.5">{req.responseNote}</p>
                                  </div>
                                )}

                                {/* Decline reason input */}
                                {decliningRequestId === req.id && (
                                  <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 space-y-2">
                                    <label className="text-xs font-semibold text-rose-900 block">
                                      {t("dialogs.declineReasonPrompt")}:
                                    </label>
                                    <input
                                      type="text"
                                      value={declineReasonText}
                                      onChange={(e) => setDeclineReasonText(e.target.value)}
                                      placeholder="e.g. Beneficiary outside jurisdiction / Invalid documents"
                                      className="w-full text-xs p-2 rounded border border-rose-300 bg-white"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setDecliningRequestId(null);
                                          setDeclineReasonText("");
                                        }}
                                        className="text-xs cursor-pointer"
                                      >
                                        {t("common.cancel")}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeclineAssistance(req.id)}
                                        disabled={!declineReasonText.trim()}
                                        className="text-xs bg-rose-600 text-white hover:bg-rose-700 border-rose-600 cursor-pointer"
                                      >
                                        {t("common.confirm")}
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {!isResolved && !isDeclined && (
                                  <div className="space-y-1.5 pt-1">
                                    <label className="text-[11px] font-semibold text-slate-600 block">
                                      {t("forms.notes")}:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Visited family. Aadhaar e-KYC in progress."
                                      value={assistanceResponseNotes[req.id] || ""}
                                      onChange={(e) =>
                                        setAssistanceResponseNotes({
                                          ...assistanceResponseNotes,
                                          [req.id]: e.target.value,
                                        })
                                      }
                                      className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-700"
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // 1. Resolve master case ID safely (Priority A: req.caseId, Priority B: household case lookup)
                                    const targetCase =
                                      (req.caseId ? cases.find((c) => c.id === req.caseId) : null) ||
                                      cases.find((c) => c.householdId === req.householdId);
                                    const targetCaseId = req.caseId || targetCase?.id;

                                    if (targetCaseId) {
                                      // 2. Select initial tab based on category and scheme matching
                                      let targetTab = "overview";
                                      if (
                                        req.category === "SCHEME_ENROLLMENT" &&
                                        req.schemeId &&
                                        targetCase?.schemeId === req.schemeId
                                      ) {
                                        targetTab = "journey";
                                      } else if (req.category === "FOLLOW_UP") {
                                        targetTab = "tasks";
                                      } else if (req.category === "DOCUMENT_HELP") {
                                        targetTab = "overview";
                                      }

                                      openCaseDetail(targetCaseId, targetTab, req);
                                    } else {
                                      setErrorMessage("Case for this household not found in your assigned caseload.");
                                    }
                                  }}
                                  className="text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
                                >
                                  {t("asha.openCaseDrawer")}
                                </Button>

                                {!isResolved && !isDeclined ? (
                                  <div className="flex items-center gap-2">
                                    {isPending && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setDecliningRequestId(req.id)}
                                          className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                                        >
                                          {t("common.delete")}
                                        </Button>
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          disabled={isUpdatingAssistance === req.id}
                                          onClick={() => handleAcceptAssistance(req.id)}
                                          className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1 shadow-2xs cursor-pointer"
                                        >
                                          <Check className="w-3.5 h-3.5" /> {t("common.confirm")}
                                        </Button>
                                      </>
                                    )}
                                    {!isPending && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        disabled={isUpdatingAssistance === req.id}
                                        onClick={() => handleUpdateAssistance(req.id, "RESOLVED")}
                                        className="text-xs bg-teal-800 hover:bg-teal-900 text-white font-semibold shadow-2xs cursor-pointer"
                                      >
                                        {t("status.resolved")}
                                      </Button>
                                    )}
                                  </div>
                                ) : isResolved ? (
                                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {t("status.resolved")}
                                  </span>
                                ) : (
                                  <span className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                                    <X className="w-3.5 h-3.5" /> {t("status.declined")}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB B: HOUSEHOLD CONNECTION REQUESTS */}
                {requestsSubTab === "connections" && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <Inbox className="w-4 h-4 text-emerald-700" />
                          <span>{t("citizen.ashaSectionTitle")} ({connectionRequests.length})</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t("citizen.ashaCardDesc")}
                        </p>
                      </div>

                      {userProfile?.ashaServiceCode && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                          <span className="text-[11px] font-semibold text-slate-500">{t("common.code")}:</span>
                          <span className="text-xs font-mono font-bold text-slate-900">{userProfile.ashaServiceCode}</span>
                          <button
                            onClick={copyServiceCode}
                            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 ml-1 cursor-pointer"
                          >
                            {copiedServiceCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>

                    {connectionRequests.length === 0 ? (
                      <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-8 space-y-2">
                        <Inbox className="w-9 h-9 text-slate-300 mx-auto mb-1" />
                        <h3 className="text-base font-bold text-slate-800">{t("citizen.noAssistanceRequests")}</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {t("citizen.ashaCardDesc")}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {connectionRequests.map((req) => (
                          <div
                            key={req.id}
                            className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3.5 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900">{req.headOfHouseholdName}</h4>
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                      {req.incomeCategory}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    {req.district}, {req.state} • {t("citizen.memberCount", { count: req.memberCount })}
                                  </p>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(req.requestedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRejectRequest(req.id)}
                                className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold cursor-pointer"
                              >
                                {t("common.delete")}
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleAcceptRequest(req.id)}
                                className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-2xs cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> {t("common.confirm")}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* 4. NEEDS ATTENTION QUEUE */}
            {/* ============================================================ */}
            {activeTab === "attention" && (
              <div className="space-y-4">
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">{t("asha.attentionRequired")}</p>
                    <p className="mt-0.5 text-amber-800">
                      {t("asha.workspaceDesc")}
                    </p>
                  </div>
                </div>

                {isSignalsLoading ? (
                  <div className="py-12 text-center bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-amber-600 border-t-transparent mb-2" />
                    <p className="text-xs text-slate-500 font-medium">{t("common.loading")}</p>
                  </div>
                ) : attentionSignals.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1 opacity-80" />
                    <p className="text-sm font-bold text-slate-800">{t("asha.noAttentionSignals")}</p>
                    <p className="text-xs text-slate-500">
                      {t("asha.noAttentionSignalsDesc")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attentionSignals.map((sig) => (
                      <div
                        key={sig.id}
                        className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-amber-400 transition-colors space-y-3.5 flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {sig.headOfHouseholdName} • {sig.district}, {sig.state}
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm mt-0.5">{sig.title}</h4>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                sig.priority === "URGENT"
                                  ? "bg-red-100 text-red-800"
                                  : sig.priority === "HIGH"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {sig.priority === "URGENT" ? t("forms.priorityUrgent") : sig.priority === "HIGH" ? t("forms.priorityHigh") : t("forms.priorityNormal")}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">{sig.subtitle}</p>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block mb-0.5">
                              {t("citizen.stepGuideTitle")}
                            </span>
                            <p className="text-slate-800 font-medium">{sig.recommendedAction}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <span className="text-[11px] text-slate-400 font-mono">{t("common.code")}: {sig.caseId.slice(0, 10)}...</span>
                          <div className="flex items-center gap-2">
                            {sig.actionType === "INITIATE_SCHEME" && sig.schemeId && (
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={initiatingSchemeId === `${sig.caseId}_${sig.schemeId}`}
                                onClick={() =>
                                  handleInitiateScheme(sig.caseId, sig.schemeId!, sig.beneficiaryMemberId)
                                }
                                className="text-xs font-bold py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>
                                  {initiatingSchemeId === `${sig.caseId}_${sig.schemeId}`
                                    ? t("common.submitting")
                                    : t("asha.assistHousehold")}
                                </span>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCaseDetail(sig.caseId)}
                              className="text-xs font-semibold py-1.5 px-3 cursor-pointer"
                            >
                              {t("asha.openCaseDrawer")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* 5. FOLLOW-UPS TAB (B5) */}
            {/* ============================================================ */}
            {activeTab === "followups" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {t("asha.dueFollowUps")}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {t("asha.workspaceDesc")}
                    </p>
                  </div>
                  <button
                    onClick={loadFollowUps}
                    disabled={isFollowUpsLoading}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer self-start sm:self-auto bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isFollowUpsLoading ? "animate-spin" : ""}`} />
                    <span>{t("common.tryAgain")}</span>
                  </button>
                </div>

                {/* Top Metrics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div
                    onClick={() => setFollowUpFilter("DUE_TODAY")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      followUpFilter === "DUE_TODAY"
                        ? "bg-amber-100/80 border-amber-400 shadow-xs"
                        : "bg-amber-50/60 border-amber-200/80 hover:bg-amber-100/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">{t("status.due_today")}</span>
                      <Calendar className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-amber-950 mt-1">{dueTodayFollowUpsCount}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">{t("status.due_today")}</p>
                  </div>

                  <div
                    onClick={() => setFollowUpFilter("OVERDUE")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      followUpFilter === "OVERDUE"
                        ? "bg-rose-100/80 border-rose-400 shadow-xs"
                        : "bg-rose-50/60 border-rose-200/80 hover:bg-rose-100/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">{t("status.overdue")}</span>
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-rose-950 mt-1">{overdueFollowUpsCount}</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">{t("status.overdue")}</p>
                  </div>

                  <div
                    onClick={() => setFollowUpFilter("UPCOMING")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      followUpFilter === "UPCOMING"
                        ? "bg-sky-100/80 border-sky-400 shadow-xs"
                        : "bg-sky-50/60 border-sky-200/80 hover:bg-sky-100/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">{t("common.upcoming")}</span>
                      <Clock className="w-4 h-4 text-sky-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-sky-950 mt-1">{upcomingFollowUpsCount}</p>
                    <p className="text-[11px] text-sky-700 mt-0.5">{t("common.upcoming")}</p>
                  </div>

                  <div
                    onClick={() => setFollowUpFilter("COMPLETED")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      followUpFilter === "COMPLETED"
                        ? "bg-emerald-100/80 border-emerald-400 shadow-xs"
                        : "bg-emerald-50/60 border-emerald-200/80 hover:bg-emerald-100/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">{t("status.completed")}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-emerald-950 mt-1">{completedFollowUpsCount}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">{t("status.completed")}</p>
                  </div>
                </div>

                {/* Filter Pills Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { id: "ALL", label: `${t("asha.dueFollowUps")} (${totalFollowUpsCount})` },
                      { id: "OVERDUE", label: `${t("status.urgent")} (${overdueFollowUpsCount})` },
                      { id: "DUE_TODAY", label: `${t("status.pending")} (${dueTodayFollowUpsCount})` },
                      { id: "UPCOMING", label: `${t("common.pending")} (${upcomingFollowUpsCount})` },
                      { id: "COMPLETED", label: `${t("status.completed")} (${completedFollowUpsCount})` },
                      { id: "CANCELLED", label: `${t("status.declined")} (${cancelledFollowUpsCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFollowUpFilter(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                          followUpFilter === tab.id
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Follow-up Cards List */}
                {(() => {
                  const allFollowUps = followUpSummary?.followUps || [];
                  const todayIsoStr = new Date().toISOString().split("T")[0];

                  const filtered = allFollowUps.filter((f) => {
                    const dueDateStr = f.dueAt || f.scheduledAt;
                    const dateOnlyStr = dueDateStr ? new Date(dueDateStr).toISOString().split("T")[0] : "";
                    const isToday = dateOnlyStr === todayIsoStr;

                    if (followUpFilter === "ALL") return true;
                    if (followUpFilter === "DUE_TODAY") return f.status === "PENDING" && isToday;
                    if (followUpFilter === "OVERDUE") return f.status === "PENDING" && f.isOverdue === true && !isToday;
                    if (followUpFilter === "UPCOMING") return f.status === "PENDING" && !isToday && !f.isOverdue;
                    if (followUpFilter === "COMPLETED") return f.status === "COMPLETED";
                    if (followUpFilter === "CANCELLED") return f.status === "CANCELLED";
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-1">
                        <Clock className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
                        <h3 className="text-sm font-bold text-slate-800">{t("status.completed")}</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          {t("citizen.portalSubtitle")}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {filtered.map((f) => {
                        const dueDateStr = f.dueAt || f.scheduledAt;
                        const dateOnlyStr = dueDateStr ? new Date(dueDateStr).toISOString().split("T")[0] : "";
                        const isToday = dateOnlyStr === todayIsoStr;

                        return (
                          <div
                            key={f.id}
                            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                              f.status === "COMPLETED"
                                ? "bg-slate-50/70 border-slate-200 opacity-90"
                                : f.status === "CANCELLED"
                                ? "bg-slate-100/60 border-slate-300 opacity-75"
                                : f.isOverdue
                                ? "bg-rose-50/40 border-rose-300 shadow-2xs hover:border-rose-400"
                                : isToday
                                ? "bg-amber-50/40 border-amber-300 shadow-2xs hover:border-amber-400"
                                : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-2 max-w-2xl">
                                <div className="flex flex-wrap items-center gap-2">
                                  {f.status === "COMPLETED" ? (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> {t("status.completed")}
                                    </span>
                                  ) : f.status === "CANCELLED" ? (
                                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1">
                                      <X className="w-3 h-3" /> {t("status.declined")}
                                    </span>
                                  ) : f.isOverdue ? (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold flex items-center gap-1 animate-pulse">
                                      <AlertTriangle className="w-3 h-3" /> {t("status.urgent")}
                                    </span>
                                  ) : isToday ? (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center gap-1">
                                      <Calendar className="w-3 h-3" /> {t("status.pending")}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-bold flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {t("common.pending")}
                                    </span>
                                  )}

                                  {f.schemeName && (
                                    <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 text-[11px] font-bold">
                                      {f.schemeName}
                                    </span>
                                  )}

                                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                    {new Date(dueDateStr).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                </div>

                                <div>
                                  <h4 className="text-sm font-bold text-slate-900">
                                    {f.title || f.reason}
                                  </h4>
                                  {f.title && f.title !== f.reason && (
                                    <p className="text-xs text-slate-600 mt-0.5">{f.reason}</p>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                                  <span>
                                    {t("navigation.household")}: <strong className="text-slate-700">{f.headOfHouseholdName || "Assigned Family"}</strong>
                                  </span>
                                  {f.beneficiaryName && (
                                    <span>
                                      {t("citizen.headOfHousehold")}: <strong className="text-slate-700">{f.beneficiaryName}</strong>
                                    </span>
                                  )}
                                </div>

                                {f.outcome && (
                                  <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
                                    <p className="font-bold flex items-center gap-1">
                                      <FileCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                      {t("status.verified")}: {f.outcome}
                                    </p>
                                    {f.notes && <p className="text-emerald-800 text-[11px] pl-4">{f.notes}</p>}
                                  </div>
                                )}
                              </div>

                              <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                                {f.status !== "COMPLETED" && f.status !== "CANCELLED" && (
                                  <>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleOpenCompleteModal(f)}
                                      className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{t("status.completed")}</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenRescheduleModal(f)}
                                      className="text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <span>{t("common.track")}</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenCancelModal(f)}
                                      className="text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <span>{t("common.cancel")}</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleTriggerVoiceCall(f)}
                                      disabled={isVoiceCallingId === f.id}
                                      className="text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
                                    >
                                      <PhoneCall className={`w-3 h-3 text-emerald-700 ${isVoiceCallingId === f.id ? "animate-spin" : ""}`} />
                                      <span>{isVoiceCallingId === f.id ? t("common.submitting") : t("citizen.voiceCallBtn")}</span>
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openCaseDetail(f.caseId)}
                                  className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50 flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{t("asha.openCaseDrawer")}</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB: LEAVE & REASSIGNMENT MANAGEMENT */}
            {/* ============================================================ */}
            {activeTab === "leave" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Information Header Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-blue-500/10 border border-teal-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {t("leave.title")}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {t("leave.desc")}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-2.5 rounded-xl bg-white/80 backdrop-blur-xs border border-teal-200/80 shadow-xs flex items-center gap-3 shrink-0">
                    <Users className="w-4 h-4 text-teal-700" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{t("leave.currentlyAssigned")}</p>
                      <p className="text-base font-extrabold text-teal-900">{t("leave.householdsCount", { count: totalAssignedHouseholds })}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Request Leave Form */}
                  <div className="lg:col-span-1 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs h-fit">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-slate-900">{t("leave.submitNewRequest")}</h3>
                    </div>

                    {leaveError && (
                      <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>{leaveError}</div>
                      </div>
                    )}

                    {leaveSuccess && (
                      <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>{leaveSuccess}</div>
                      </div>
                    )}

                    <form onSubmit={handleLeaveSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {t("leave.startDate")} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={leaveStartDate}
                          onChange={(e) => setLeaveStartDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {t("leave.endDate")} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={leaveEndDate}
                          onChange={(e) => setLeaveEndDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            {t("leave.reasonForAbsence")} <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400">{leaveReason.length}/1000</span>
                        </div>
                        <textarea
                          rows={3}
                          value={leaveReason}
                          onChange={(e) => setLeaveReason(e.target.value)}
                          placeholder={t("leave.reasonPlaceholder")}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          maxLength={1000}
                          required
                        />
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-700">{t("leave.authoritativeProcess")}</p>
                        <p>• {t("leave.processRule1")}</p>
                        <p>• {t("leave.processRule2", { count: totalAssignedHouseholds })}</p>
                        <p>• {t("leave.processRule3")}</p>
                      </div>

                      <Button
                        type="submit"
                        disabled={isLeaveSubmitting}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        {isLeaveSubmitting ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>{t("common.submitting")}</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{t("leave.submitRequest")}</span>
                          </>
                        )}
                      </Button>
                    </form>
                  </div>

                  {/* Right Column: Leave History & Status Table */}
                  <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-600" />
                        <h3 className="text-sm font-bold text-slate-900">{t("leave.historyTitle")}</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadLeaveRequests}
                        disabled={isLeaveLoading}
                        className="text-xs font-medium cursor-pointer"
                      >
                        {t("common.refresh")}
                      </Button>
                    </div>

                    {isLeaveLoading ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        {t("leave.loadingRequests")}
                      </div>
                    ) : leaveRequests.length === 0 ? (
                      <div className="py-12 text-center rounded-xl bg-slate-50 border border-slate-200/60 p-6">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-700">{t("leave.noRequestsFound")}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{t("leave.noRequestsDesc")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leaveRequests.map((req) => {
                          const isPending = req.status === "PENDING";
                          const isApproved = req.status === "APPROVED";
                          const isRejected = req.status === "REJECTED";
                          const isCompleted = req.status === "COMPLETED";

                          return (
                            <div
                              key={req.id}
                              className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-all"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 ${
                                      isPending
                                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                                        : isApproved
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : isRejected
                                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                                        : "bg-blue-100 text-blue-800 border border-blue-300"
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    {isPending
                                      ? t("leave.pendingApproval")
                                      : isApproved
                                      ? t("leave.approvedActive")
                                      : isRejected
                                      ? t("leave.rejected")
                                      : t("leave.completed")}
                                  </span>

                                  {req.restorationStatus === "RESTORED" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                                      {t("leave.restored")}
                                    </span>
                                  )}
                                  {req.restorationStatus === "REQUIRES_REVIEW" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                      {t("leave.reviewRequired")}
                                    </span>
                                  )}
                                </div>

                                {isPending && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={cancellingLeaveId === req.id}
                                    onClick={() => handleCancelLeave(req.id)}
                                    className="text-[11px] text-rose-700 border-rose-200 hover:bg-rose-50 h-7 px-2.5 cursor-pointer"
                                  >
                                    {cancellingLeaveId === req.id ? t("leave.cancelling") : t("leave.cancelRequest")}
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 mb-2">
                                <div>
                                  <span className="font-semibold text-slate-700">{t("leave.leavePeriod")}: </span>
                                  <span className="font-medium text-slate-900">{req.startDate} → {req.endDate}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-700">{t("leave.affectedHouseholds")}: </span>
                                  <span className="font-medium text-slate-900">{req.affectedHouseholdCount}</span>
                                </div>
                              </div>

                              <div className="text-xs text-slate-700 mb-2 bg-white p-2.5 rounded-lg border border-slate-200/60">
                                <span className="font-semibold text-slate-800">{t("leave.reasonLabel")}: </span>
                                <span>{req.reason}</span>
                              </div>

                              {/* Replacement Worker info if approved */}
                              {isApproved && req.replacementAshaName && (
                                <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-900 flex items-center justify-between">
                                  <div>
                                    <span className="font-semibold">{t("leave.designatedReplacement")}: </span>
                                    <span>{req.replacementAshaName}</span>
                                  </div>
                                  <span className="text-[10px] text-emerald-700 font-mono">
                                    {t("leave.until")} {req.endDate}
                                  </span>
                                </div>
                              )}

                              {/* Rejection Note */}
                              {isRejected && req.reviewNotes && (
                                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                                  <span className="font-semibold">{t("leave.reviewNote")}: </span>
                                  <span>{req.reviewNotes}</span>
                                </div>
                              )}

                              {/* Completed restoration notes */}
                              {isCompleted && req.restorationNotes && (
                                <div className="p-2 rounded-lg bg-slate-100 text-[11px] text-slate-600 mt-1">
                                  {req.restorationNotes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* COMPLETE FOLLOW-UP MODAL (PHASE 10) */}
        {/* ============================================================ */}
        {completingFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  <span>{t("status.completed")}</span>
                </h3>
                <button
                  onClick={() => setCompletingFollowUp(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-800">{completingFollowUp.title || completingFollowUp.reason}</p>
                <p className="text-slate-500">
                  {t("navigation.household")}: <strong>{completingFollowUp.headOfHouseholdName || "Assigned Family"}</strong>
                </p>
                <p className="text-slate-500">
                  {new Date(completingFollowUp.dueAt || completingFollowUp.scheduledAt).toLocaleDateString()}
                </p>
              </div>

              <form onSubmit={handleCompleteFollowUpSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t("status.verified")} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Verified PM-JAY registration & assisted with e-KYC photo"
                    value={completeOutcome}
                    onChange={(e) => setCompleteOutcome(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t("forms.notes")}
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Household informed about empaneled district hospital and emergency contact numbers."
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletingFollowUp(null)}
                    className="cursor-pointer"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isCompletingSubmitting || !completeOutcome.trim()}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
                  >
                    {isCompletingSubmitting ? t("common.submitting") : t("common.confirm")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* RESCHEDULE FOLLOW-UP MODAL (PHASE 10) */}
        {/* ============================================================ */}
        {reschedulingFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-700" />
                  <span>{t("common.track")}</span>
                </h3>
                <button
                  onClick={() => setReschedulingFollowUp(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl text-xs space-y-1 border border-amber-200/60">
                <p className="font-bold text-slate-800">{reschedulingFollowUp.title || reschedulingFollowUp.reason}</p>
                <p className="text-slate-600">
                  {t("navigation.household")}: <strong>{reschedulingFollowUp.headOfHouseholdName || "Assigned Family"}</strong>
                </p>
                <p className="text-slate-600">
                  {new Date(reschedulingFollowUp.dueAt || reschedulingFollowUp.scheduledAt).toLocaleDateString()}
                </p>
              </div>

              <form onSubmit={handleRescheduleFollowUpSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t("forms.dateOfBirth")} *
                  </label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t("forms.notes")} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Beneficiary was traveling; requested visit next week"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReschedulingFollowUp(null)}
                    className="cursor-pointer"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isReschedulingSubmitting || !rescheduleDate || !rescheduleReason.trim()}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
                  >
                    {isReschedulingSubmitting ? t("common.submitting") : t("common.confirm")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CANCEL FOLLOW-UP MODAL (PHASE 10) */}
        {/* ============================================================ */}
        {cancellingFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-700" />
                  <span>{t("common.cancel")}</span>
                </h3>
                <button
                  onClick={() => setCancellingFollowUp(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl text-xs space-y-1 border border-rose-200/60">
                <p className="font-bold text-slate-800">{cancellingFollowUp.title || cancellingFollowUp.reason}</p>
                <p className="text-slate-600">
                  {t("navigation.household")}: <strong>{cancellingFollowUp.headOfHouseholdName || "Assigned Family"}</strong>
                </p>
                <p className="text-slate-600">
                  {new Date(cancellingFollowUp.dueAt || cancellingFollowUp.scheduledAt).toLocaleDateString()}
                </p>
              </div>

              <form onSubmit={handleCancelFollowUpSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {t("forms.notes")} *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Beneficiary completed Aadhaar linking at CSC independently, or scheme application no longer required."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rose-600 focus:outline-hidden text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCancellingFollowUp(null)}
                    className="cursor-pointer"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isCancellingSubmitting || !cancelReason.trim()}
                    className="bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer"
                  >
                    {isCancellingSubmitting ? t("common.submitting") : t("common.confirm")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SwasthyaSetu Healthcare Assistant Drawer */}
        <HealthcareAssistantDrawer
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          userRole="ASHA"
        />

        {/* Phase 11 Real ASHA Telephony Call Modal */}
        {callModalTarget && (
          <AshaCallModal
            isOpen={isAshaCallModalOpen}
            onClose={() => {
              setIsAshaCallModalOpen(false);
              setCallModalTarget(null);
            }}
            caseId={callModalTarget.caseId}
            citizenName={callModalTarget.citizenName}
            headOfHousehold={callModalTarget.headOfHousehold}
            schemeName={callModalTarget.schemeName}
            contactPhoneMasked={callModalTarget.contactPhoneMasked}
            followUpId={callModalTarget.followUpId}
            defaultReason={callModalTarget.defaultReason}
            onCallComplete={() => {
              loadFollowUps();
              loadCaseload();
            }}
          />
        )}


      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
