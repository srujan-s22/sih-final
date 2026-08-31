"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { useAuth } from "@/lib/auth/auth-context";
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
} from "lucide-react";
import { caseService } from "@/services/case-service";
import { connectionService } from "@/services/connection-service";
import { assistanceService } from "@/services/assistance-service";
import { voiceService } from "@/services/voice-service";
import {
  AshaCase,
  CaseDetailResponse,
  CaseSummaryResponse,
  CaseFollowUp,
  FollowUpSummaryResponse,
  CaseStatus,
  CasePriority,
  CaseTask,
  CaseTaskStatus,
  SchemeJourneyStep,
  FieldRegistrationInput,
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
  const { userProfile } = useAuth();
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

  // Case Detail Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "journey" | "gaps" | "schemes" | "notes" | "followups" | "history">("overview");

  // Tasks & Journey State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);

  // New Note / Follow-up inputs
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [isFollowUpSubmitting, setIsFollowUpSubmitting] = useState(false);

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

  // Field Registration Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [registerForm, setRegisterForm] = useState<FieldRegistrationInput>({
    headOfHouseholdName: "",
    headAge: 35,
    headGender: "female",
    incomeCategory: "BPL",
    state: "Karnataka",
    district: "Bengaluru Rural",
    village: "",
    pincode: "560001",
    contactPhone: "",
    rationCardNumber: "",
  });

  // Phase 8 Assistant Integration
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

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
    loadCaseload();
    loadFollowUps();
    loadAttentionSignals();
    loadPendingRequests();
    loadAssistanceRequests();
  }, [loadCaseload, loadFollowUps, loadAttentionSignals, loadPendingRequests, loadAssistanceRequests]);

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
        await openCaseDetail(caseId);
        setDetailTab("journey");
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
        setRegisterSuccess("Household connection accepted and added to your caseload.");
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
        setRegisterSuccess("Connection request declined.");
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
        setRegisterSuccess(`Assistance request updated to '${newStatus}'.`);
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

  // Load Case Detail
  const openCaseDetail = async (caseId: string) => {
    setSelectedCaseId(caseId);
    setDetailTab("overview");
    setIsDetailLoading(true);
    try {
      const res = await caseService.getCaseDetail(caseId);
      if (res.success && res.data) {
        setCaseDetail(res.data);
      } else {
        setErrorMessage(res.success ? null : (res as any).error?.message || "Failed to load case details.");
      }
    } catch {
      setErrorMessage("Error retrieving case details.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Open Case Detail by Household ID
  const openCaseDetailByHousehold = (householdId: string) => {
    const matchingCase = cases.find((c) => c.householdId === householdId);
    if (matchingCase) {
      openCaseDetail(matchingCase.id);
    } else {
      setErrorMessage("Case for this household not found in your assigned caseload.");
    }
  };

  const closeCaseDetail = () => {
    setSelectedCaseId(null);
    setCaseDetail(null);
  };

  // Status / Priority Update
  const handleStatusChange = async (newStatus: CaseStatus) => {
    if (!selectedCaseId || !caseDetail) return;
    try {
      const res = await caseService.updateCase(selectedCaseId, { status: newStatus });
      if (res.success && res.data) {
        setCaseDetail((prev) => (prev ? { ...prev, case: res.data.case } : null));
        await loadCaseload();
      }
    } catch {
      // Error handled quietly
    }
  };

  const handlePriorityChange = async (newPriority: CasePriority) => {
    if (!selectedCaseId || !caseDetail) return;
    try {
      const res = await caseService.updateCase(selectedCaseId, { priority: newPriority });
      if (res.success && res.data) {
        setCaseDetail((prev) => (prev ? { ...prev, case: res.data.case } : null));
        await loadCaseload();
      }
    } catch {
      // Error handled quietly
    }
  };

  // Add Case Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !newNoteContent.trim()) return;
    setIsNoteSubmitting(true);
    try {
      const res = await caseService.addNote(selectedCaseId, newNoteContent.trim());
      if (res.success && res.data) {
        setNewNoteContent("");
        const freshDetail = await caseService.getCaseDetail(selectedCaseId);
        if (freshDetail.success && freshDetail.data) {
          setCaseDetail(freshDetail.data);
        }
      }
    } catch {
      // Error handled quietly
    } finally {
      setIsNoteSubmitting(false);
    }
  };

  // Schedule Follow-Up
  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !followUpDate || !followUpReason.trim()) return;
    setIsFollowUpSubmitting(true);
    try {
      const res = await caseService.createFollowUp(selectedCaseId, {
        dueAt: followUpDate,
        scheduledAt: followUpDate,
        reason: followUpReason.trim(),
      });
      if (res.success && res.data) {
        setFollowUpDate("");
        setFollowUpReason("");
        const freshDetail = await caseService.getCaseDetail(selectedCaseId);
        if (freshDetail.success && freshDetail.data) {
          setCaseDetail(freshDetail.data);
        }
        await Promise.all([loadFollowUps(), loadCaseload()]);
      }
    } catch {
      // Error handled quietly
    } finally {
      setIsFollowUpSubmitting(false);
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
        if (selectedCaseId === completingFollowUp.caseId) {
          const freshDetail = await caseService.getCaseDetail(selectedCaseId);
          if (freshDetail.success && freshDetail.data) {
            setCaseDetail(freshDetail.data);
          }
        }
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
        if (selectedCaseId === reschedulingFollowUp.caseId) {
          const freshDetail = await caseService.getCaseDetail(selectedCaseId);
          if (freshDetail.success && freshDetail.data) {
            setCaseDetail(freshDetail.data);
          }
        }
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
        if (selectedCaseId === cancellingFollowUp.caseId) {
          const freshDetail = await caseService.getCaseDetail(selectedCaseId);
          if (freshDetail.success && freshDetail.data) {
            setCaseDetail(freshDetail.data);
          }
        }
      }
    } catch {
      setErrorMessage("Failed to cancel follow-up.");
    } finally {
      setIsCancellingSubmitting(false);
    }
  };

  // Trigger Outbound Voice Reminder / Assistance Call (Phase 11)
  const handleOpenVoiceCallModal = (followUp?: CaseFollowUp, targetCase?: AshaCase) => {
    const targetCaseId = followUp?.caseId || targetCase?.id || selectedCaseId || "";
    const name = targetCase?.headOfHouseholdName || caseDetail?.household?.headOfHouseholdName || "Beneficiary";
    const phone = caseDetail?.household?.contactPhone
      ? `+91 ${caseDetail.household.contactPhone.replace(/\D/g, "").slice(-10).replace(/(\d{3})\d{4}(\d{3})/, "$1****$2")}`
      : "+91 98*** **210";

    setCallModalTarget({
      caseId: targetCaseId,
      citizenName: name,
      headOfHousehold: targetCase?.headOfHouseholdName || caseDetail?.household?.headOfHouseholdName,
      schemeName: targetCase?.schemeName || caseDetail?.case?.schemeName || "Government Health Scheme",
      contactPhoneMasked: phone,
      followUpId: followUp?.id,
      defaultReason: followUp
        ? `Doorstep visit reminder: ${followUp.title || followUp.reason}`
        : `Outreach for ${targetCase?.schemeName || caseDetail?.case?.schemeName || "health scheme"} follow-up`,
    });
    setIsAshaCallModalOpen(true);
  };

  const handleTriggerVoiceCall = async (followUp: CaseFollowUp) => {
    handleOpenVoiceCallModal(followUp);
  };

  // Quick Complete from Case Drawer
  const handleCompleteFollowUp = async (followUpId: string) => {
    if (!selectedCaseId) return;
    try {
      const res = await caseService.completeFollowUp(
        selectedCaseId,
        followUpId,
        "Completed during direct field check-in"
      );
      if (res.success) {
        const freshDetail = await caseService.getCaseDetail(selectedCaseId);
        if (freshDetail.success && freshDetail.data) {
          setCaseDetail(freshDetail.data);
        }
        await Promise.all([loadFollowUps(), loadCaseload()]);
      }
    } catch {
      // Error handled quietly
    }
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
          openCaseDetail(res.data.caseId);
          setDetailTab("journey");
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

  // Complete Task in Case Drawer
  const handleCompleteTask = async (taskId: string, notes?: string) => {
    if (!selectedCaseId) return;
    try {
      const res = await caseService.completeTask(selectedCaseId, taskId, notes);
      if (res.success) {
        const freshDetail = await caseService.getCaseDetail(selectedCaseId);
        if (freshDetail.success && freshDetail.data) {
          setCaseDetail(freshDetail.data);
        }
        await Promise.all([
          loadCaseload(),
          loadFollowUps(),
          loadAttentionSignals(),
          loadAssistanceRequests(),
        ]);
      } else {
        setErrorMessage((res as any).error?.message || "Failed to complete task.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to complete task.");
    }
  };

  // Update Task Status
  const handleUpdateTaskStatus = async (taskId: string, status: CaseTaskStatus) => {
    if (!selectedCaseId) return;
    try {
      const res = await caseService.updateTask(selectedCaseId, taskId, { status });
      if (res.success) {
        const freshDetail = await caseService.getCaseDetail(selectedCaseId);
        if (freshDetail.success && freshDetail.data) {
          setCaseDetail(freshDetail.data);
        }
        await Promise.all([
          loadCaseload(),
          loadFollowUps(),
          loadAttentionSignals(),
          loadAssistanceRequests(),
        ]);
      } else {
        setErrorMessage((res as any).error?.message || "Failed to update task status.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update task status.");
    }
  };

  // Add Custom Task to Case
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !newTaskTitle.trim()) return;
    setIsTaskSubmitting(true);
    try {
      const res = await caseService.createTask(selectedCaseId, {
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || newTaskTitle.trim(),
        type: "CUSTOM_FIELD_TASK",
      });
      if (res.success) {
        setNewTaskTitle("");
        setNewTaskDesc("");
        const freshDetail = await caseService.getCaseDetail(selectedCaseId);
        if (freshDetail.success && freshDetail.data) {
          setCaseDetail(freshDetail.data);
        }
      }
    } catch {
      // Quiet fail
    } finally {
      setIsTaskSubmitting(false);
    }
  };

  // Handle Field Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSubmitting(true);
    try {
      const res = await caseService.createFieldRegistration(registerForm);
      if (res.success && res.data) {
        setIsRegisterModalOpen(false);
        setRegisterSuccess(`Case registered for ${res.data.household.headOfHouseholdName}`);
        await loadCaseload();
        openCaseDetail(res.data.case.id);
      } else {
        setRegisterError(res.success ? null : (res as any).error?.message || "Failed to register household case in field.");
      }
    } catch {
      setRegisterError("Failed to register household case in field.");
    } finally {
      setRegisterSubmitting(false);
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

  const navTabs = [
    { id: "overview", label: "Dashboard", icon: Activity },
    { id: "cases", label: `My Households (${totalAssignedHouseholds})`, icon: Users },
    { id: "requests", label: `Requests (${totalActiveRequestsCount})`, icon: Inbox },
    { id: "attention", label: `Needs Attention (${totalAttentionSignalsCount})`, icon: AlertCircle },
    {
      id: "followups",
      label: `Follow-ups${actionableFollowUpBadge > 0 ? ` (${actionableFollowUpBadge})` : ""}`,
      icon: Clock,
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
            ? "My Assigned Households"
            : activeTab === "requests"
            ? "Incoming Citizen Requests"
            : activeTab === "attention"
            ? "Needs Attention Queue"
            : activeTab === "followups"
            ? "Follow-up & Visit Tasks"
            : `Welcome, ${userProfile?.displayName || "ASHA Worker"} 👋`
        }
        description={
          activeTab === "cases"
            ? "View assigned family profiles, monitor verified entitlements, and initiate doorstep assistance."
            : activeTab === "requests"
            ? "Respond to scheme enrollment, document verification, and household connection requests."
            : activeTab === "attention"
            ? "Proactive intelligence signals highlighting senior citizens, maternal care, and blocked tasks."
            : activeTab === "followups"
            ? "Scheduled home visits, documentation verification checks, and health outreach tasks."
            : "Here's what needs your attention today across your assigned households."
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
              className="text-xs font-semibold flex items-center gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 shadow-2xs"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-700" />
              <span>Field Assistant</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setRegisterError(null);
                setIsRegisterModalOpen(true);
              }}
              className="text-xs font-semibold flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Register Household</span>
            </Button>
          </div>
        }
      >
        {/* Success Alert */}
        {registerSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="font-semibold">{registerSuccess}</p>
            </div>
            <button
              onClick={() => setRegisterSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <p>{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900 font-bold text-xs ml-4"
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
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
            <p className="text-sm font-medium text-slate-500">Loading assigned caseload...</p>
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
                        Assigned Households
                      </span>
                      <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1.5">
                      {totalAssignedHouseholds}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Persisted family records</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("attention")}
                    className="bg-amber-50/40 rounded-xl border border-amber-200 p-4 shadow-2xs cursor-pointer hover:border-amber-400 hover:bg-amber-50/70 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                        Needs Attention
                      </span>
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-2xl font-black text-amber-950 mt-1.5">
                      {totalAttentionSignalsCount}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {totalAttentionSignalsCount === 1 ? "1 item requires action" : `${totalAttentionSignalsCount} items require action`}
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("followups")}
                    className="bg-rose-50/30 rounded-xl border border-rose-200 p-4 shadow-2xs cursor-pointer hover:border-rose-300 hover:bg-rose-50/60 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                        Follow-ups Due
                      </span>
                      <Clock className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-2xl font-black text-rose-950 mt-1.5">
                      {actionableFollowUpBadge}
                    </p>
                    <p className="text-xs text-rose-700 mt-0.5">
                      {overdueFollowUpsCount} overdue, {dueTodayFollowUpsCount} today
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("requests")}
                    className="bg-teal-50/30 rounded-xl border border-teal-200 p-4 shadow-2xs cursor-pointer hover:border-teal-300 hover:bg-teal-50/60 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                        Active Requests
                      </span>
                      <Inbox className="w-4 h-4 text-teal-600" />
                    </div>
                    <p className="text-2xl font-black text-teal-950 mt-1.5">
                      {totalActiveRequestsCount}
                    </p>
                    <p className="text-xs text-teal-700 mt-0.5">
                      {activeAssistanceCount} assistance, {pendingConnectionCount} connect
                    </p>
                  </div>
                </div>

                {/* Quick Action Navigation Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Quick Field Navigation:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("cases")}
                      className="text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100"
                    >
                      <Search className="w-3.5 h-3.5 mr-1 text-slate-500" /> Find Household
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("requests")}
                      className="text-xs font-semibold bg-white border-teal-200 text-teal-900 hover:bg-teal-50"
                    >
                      <Inbox className="w-3.5 h-3.5 mr-1 text-teal-700" /> Citizen Requests ({totalActiveRequestsCount})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("followups")}
                      className="text-xs font-semibold bg-white border-rose-200 text-rose-900 hover:bg-rose-50"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1 text-rose-700" /> Due Follow-ups ({actionableFollowUpBadge})
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setRegisterError(null);
                        setIsRegisterModalOpen(true);
                      }}
                      className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> + Register Household
                    </Button>
                  </div>
                </div>

                {/* TODAY'S PRIORITIES — HERO ACTION SECTION */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <span>Today&apos;s Field Priorities</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          Action Required
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        High-urgency citizen tasks, scheme enrollments, and scheduled doorstep visits needing attention today.
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
                            Entitlement Opportunities ({totalAttentionSignalsCount})
                          </h4>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("attention")}
                          className="text-xs font-semibold text-amber-900 border-amber-200 hover:bg-amber-50"
                        >
                          View All Queue
                        </Button>
                      </div>

                      {totalAttentionSignalsCount === 0 ? (
                        <div className="py-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                          <p className="font-semibold text-slate-700">All household entitlements up to date</p>
                          <p className="text-slate-500">No unaddressed senior or maternal schemes in your caseload.</p>
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
                                  {sig.priority}
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
                                      className="text-xs font-bold py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                                    >
                                      {initiatingSchemeId === `${sig.caseId}_${sig.schemeId}`
                                        ? "Starting..."
                                        : "Start Assistance"}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openCaseDetail(sig.caseId)}
                                    className="text-xs font-semibold py-1 px-2.5 text-slate-700 hover:bg-white"
                                  >
                                    Open Case
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
                            Citizen Requests & Due Visits
                          </h4>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("requests")}
                          className="text-xs font-semibold text-teal-900 border-teal-200 hover:bg-teal-50"
                        >
                          View Requests ({totalActiveRequestsCount})
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
                              <p className="font-semibold text-slate-700">No pending citizen requests or visits</p>
                              <p className="text-slate-500">All assistance inquiries and daily scheduled visits are clear.</p>
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
                                        className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-1 px-2.5"
                                      >
                                        Accept & Open
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setRequestsSubTab("assistance");
                                        setActiveTab("requests");
                                      }}
                                      className="text-xs font-semibold py-1 px-2.5"
                                    >
                                      View Details
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
                                    {f.isOverdue ? "Overdue Visit" : "Due Today"}
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
                                      className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-1 px-2.5"
                                    >
                                      Mark Done
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openCaseDetail(f.caseId)}
                                      className="text-xs font-semibold py-1 px-2.5"
                                    >
                                      Open Case
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
                      My Assigned Households ({cases.length})
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      View assigned family profiles, monitor verified entitlements, and initiate doorstep assistance.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setRegisterError(null);
                      setIsRegisterModalOpen(true);
                    }}
                    className="text-xs font-semibold flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white self-start sm:self-auto shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Register Household</span>
                  </Button>
                </div>

                {/* Search & Filter Controls */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search households by head name, district, village, or case ID..."
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
                      <option value="ALL">All Statuses</option>
                      <option value="NEW">New</option>
                      <option value="ACTIVE">Active Journey</option>
                      <option value="NEEDS_ATTENTION">Needs Attention</option>
                      <option value="FOLLOW_UP">Follow Up</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>

                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="text-xs py-2 px-3 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="URGENT">Urgent</option>
                      <option value="HIGH">High</option>
                      <option value="NORMAL">Normal</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                {/* Card-Based Household Roster */}
                {filteredCases.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-2">
                    <Users className="w-9 h-9 text-slate-300 mx-auto mb-1" />
                    <h3 className="text-sm font-bold text-slate-800">No Matching Households Found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      No assigned cases match your current search and filter criteria.
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
                                {c.priority}
                              </span>
                            </div>

                            {/* Ration Category & Status Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                                Ration: {c.incomeCategory}
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
                                  <span>{c.detectedGapsCount} Entitlement Gap Identified</span>
                                </div>
                              ) : (
                                <div className="text-slate-500 text-[11px] flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Entitlements up to date</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[10px] text-slate-400 font-mono">
                              Case: {c.id.slice(0, 10)}...
                            </span>
                            <span className="font-bold text-emerald-800 flex items-center gap-1 hover:text-emerald-950">
                              <span>Open Household</span>
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
                      Incoming Citizen Requests
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Respond to scheme enrollment, document verification, and household connection requests.
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
                    Citizen Assistance Requests ({activeAssistanceCount} Active / {assistanceRequests.length} Total)
                  </button>
                  <button
                    onClick={() => setRequestsSubTab("connections")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      requestsSubTab === "connections"
                        ? "bg-emerald-700 text-white shadow-2xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    Household Connection Requests ({pendingConnectionCount})
                  </button>
                </div>

                {/* SUBTAB A: CITIZEN ASSISTANCE REQUESTS */}
                {requestsSubTab === "assistance" && (
                  <div className="space-y-4">
                    {assistanceRequests.length === 0 ? (
                      <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-8 space-y-2">
                        <MessageSquare className="w-9 h-9 text-slate-300 mx-auto mb-1" />
                        <h3 className="text-base font-bold text-slate-800">No Assistance Requests</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          When connected citizens request help with schemes or documents, their requests will appear here for one-click case activation.
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
                                      <span>Target Beneficiary: {req.beneficiaryName}</span>
                                    </div>
                                    <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
                                      {req.beneficiaryRelationship || "Member"}{req.beneficiaryAge ? `, ${req.beneficiaryAge} yrs` : ""}
                                    </span>
                                  </div>
                                )}

                                {req.schemeName && (
                                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800">
                                    Associated Scheme: <strong>{req.schemeName}</strong>
                                  </div>
                                )}

                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800">
                                  <span className="font-semibold block text-[10px] text-slate-400 uppercase">
                                    Citizen Request Message:
                                  </span>
                                  <p className="mt-0.5 leading-relaxed">&ldquo;{req.message}&rdquo;</p>
                                </div>

                                {req.responseNote && (
                                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                                    <span className="font-semibold block text-[10px] uppercase">Your Response Note:</span>
                                    <p className="mt-0.5">{req.responseNote}</p>
                                  </div>
                                )}

                                {isDeclined && req.declineReason && (
                                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-900">
                                    <span className="font-semibold block text-[10px] uppercase">Decline Reason:</span>
                                    <p className="mt-0.5">{req.declineReason}</p>
                                  </div>
                                )}

                                {/* Decline reason input */}
                                {decliningRequestId === req.id && (
                                  <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 space-y-2">
                                    <label className="text-xs font-semibold text-rose-900 block">
                                      Reason for declining this request:
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
                                        className="text-xs"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeclineAssistance(req.id)}
                                        disabled={!declineReasonText.trim()}
                                        className="text-xs bg-rose-600 text-white hover:bg-rose-700 border-rose-600"
                                      >
                                        Confirm Decline
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {!isResolved && !isDeclined && (
                                  <div className="space-y-1.5 pt-1">
                                    <label className="text-[11px] font-semibold text-slate-600 block">
                                      Add ASHA Progress Note:
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
                                    openCaseDetailByHousehold(req.householdId);
                                    setDetailTab("journey");
                                  }}
                                  className="text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50"
                                >
                                  Open Case & Tasks
                                </Button>

                                {!isResolved && !isDeclined ? (
                                  <div className="flex items-center gap-2">
                                    {isPending && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setDecliningRequestId(req.id)}
                                          className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                                        >
                                          Decline
                                        </Button>
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          disabled={isUpdatingAssistance === req.id}
                                          onClick={() => handleAcceptAssistance(req.id)}
                                          className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1 shadow-2xs"
                                        >
                                          <Check className="w-3.5 h-3.5" /> Accept & Open Case
                                        </Button>
                                      </>
                                    )}
                                    {!isPending && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        disabled={isUpdatingAssistance === req.id}
                                        onClick={() => handleUpdateAssistance(req.id, "RESOLVED")}
                                        className="text-xs bg-teal-800 hover:bg-teal-900 text-white font-semibold shadow-2xs"
                                      >
                                        Resolve Request
                                      </Button>
                                    )}
                                  </div>
                                ) : isResolved ? (
                                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                                  </span>
                                ) : (
                                  <span className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                                    <X className="w-3.5 h-3.5" /> Declined
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
                          <span>Household Connection Requests ({connectionRequests.length})</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Citizens who entered your ASHA Service Code to link their households for doorstep healthcare guidance.
                        </p>
                      </div>

                      {userProfile?.ashaServiceCode && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                          <span className="text-[11px] font-semibold text-slate-500">Your Shareable ID:</span>
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
                        <h3 className="text-base font-bold text-slate-800">No Pending Requests</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          When families in your area enter your Service Code <span className="font-mono font-bold text-slate-700">{userProfile?.ashaServiceCode || "ASHA-KA-XXXX"}</span>, their requests will appear here for one-click verification and enrollment.
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
                                    {req.district}, {req.state} • {req.memberCount} member{req.memberCount === 1 ? "" : "s"}
                                  </p>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(req.requestedAt).toLocaleDateString()}
                                </span>
                              </div>

                              {req.responseNote && (
                                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                                  &ldquo;{req.responseNote}&rdquo;
                                </p>
                              )}
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRejectRequest(req.id)}
                                className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold"
                              >
                                Decline
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleAcceptRequest(req.id)}
                                className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Accept & Add to Caseload
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
                    <p className="font-bold">Proactive Healthcare Access Intelligence</p>
                    <p className="mt-0.5 text-amber-800">
                      These signals highlight senior citizens eligible for PM-JAY (70+), pregnant mothers needing maternal care (JSY), overdue home visits, and blocked tasks across your assigned households.
                    </p>
                  </div>
                </div>

                {isSignalsLoading ? (
                  <div className="py-12 text-center bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-amber-600 border-t-transparent mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Evaluating proactive household signals...</p>
                  </div>
                ) : attentionSignals.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1 opacity-80" />
                    <p className="text-sm font-bold text-slate-800">No households currently require attention</p>
                    <p className="text-xs text-slate-500">
                      All assigned households have active, addressed entitlements and up-to-date follow-ups.
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
                              {sig.priority}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">{sig.subtitle}</p>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block mb-0.5">
                              Recommended Field Action
                            </span>
                            <p className="text-slate-800 font-medium">{sig.recommendedAction}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <span className="text-[11px] text-slate-400 font-mono">Case: {sig.caseId.slice(0, 10)}...</span>
                          <div className="flex items-center gap-2">
                            {sig.actionType === "INITIATE_SCHEME" && sig.schemeId && (
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={initiatingSchemeId === `${sig.caseId}_${sig.schemeId}`}
                                onClick={() =>
                                  handleInitiateScheme(sig.caseId, sig.schemeId!, sig.beneficiaryMemberId)
                                }
                                className="text-xs font-bold py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-2xs"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>
                                  {initiatingSchemeId === `${sig.caseId}_${sig.schemeId}`
                                    ? "Initiating..."
                                    : "Start Assistance"}
                                </span>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCaseDetail(sig.caseId)}
                              className="text-xs font-semibold py-1.5 px-3"
                            >
                              Open Household
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
                      Follow-up &amp; Visit Tasks
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Scheduled home visits, documentation verification checks, and health outreach tasks.
                    </p>
                  </div>
                  <button
                    onClick={loadFollowUps}
                    disabled={isFollowUpsLoading}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer self-start sm:self-auto bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isFollowUpsLoading ? "animate-spin" : ""}`} />
                    <span>Refresh Roster</span>
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
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Due Today</span>
                      <Calendar className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-amber-950 mt-1">{dueTodayFollowUpsCount}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">Visits scheduled today</p>
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
                      <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Overdue</span>
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-rose-950 mt-1">{overdueFollowUpsCount}</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">Urgent pending action</p>
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
                      <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Upcoming</span>
                      <Clock className="w-4 h-4 text-sky-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-sky-950 mt-1">{upcomingFollowUpsCount}</p>
                    <p className="text-[11px] text-sky-700 mt-0.5">Scheduled in next 14 days</p>
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
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Completed</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-emerald-950 mt-1">{completedFollowUpsCount}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">Visits successfully done</p>
                  </div>
                </div>

                {/* Filter Pills Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { id: "ALL", label: `All Follow-ups (${totalFollowUpsCount})` },
                      { id: "OVERDUE", label: `Overdue (${overdueFollowUpsCount})` },
                      { id: "DUE_TODAY", label: `Due Today (${dueTodayFollowUpsCount})` },
                      { id: "UPCOMING", label: `Upcoming (${upcomingFollowUpsCount})` },
                      { id: "COMPLETED", label: `Completed (${completedFollowUpsCount})` },
                      { id: "CANCELLED", label: `Cancelled (${cancelledFollowUpsCount})` },
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
                        <h3 className="text-sm font-bold text-slate-800">No Follow-ups in this Category</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          {followUpFilter === "OVERDUE"
                            ? "Great job! There are no overdue household follow-ups."
                            : followUpFilter === "DUE_TODAY"
                            ? "No follow-up visits scheduled for today."
                            : followUpFilter === "CANCELLED"
                            ? "No cancelled follow-ups recorded."
                            : "You can schedule follow-ups from any active case or let automated workflow triggers schedule them on task completion."}
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
                                      <CheckCircle2 className="w-3 h-3" /> Completed
                                    </span>
                                  ) : f.status === "CANCELLED" ? (
                                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1">
                                      <X className="w-3 h-3" /> Cancelled
                                    </span>
                                  ) : f.isOverdue ? (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold flex items-center gap-1 animate-pulse">
                                      <AlertTriangle className="w-3 h-3" /> OVERDUE
                                    </span>
                                  ) : isToday ? (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center gap-1">
                                      <Calendar className="w-3 h-3" /> DUE TODAY
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-bold flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> UPCOMING
                                    </span>
                                  )}

                                  {f.schemeName && (
                                    <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 text-[11px] font-bold">
                                      {f.schemeName}
                                    </span>
                                  )}

                                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                    Due: {new Date(dueDateStr).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
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
                                    Household: <strong className="text-slate-700">{f.headOfHouseholdName || "Assigned Family"}</strong>
                                  </span>
                                  {f.beneficiaryName && (
                                    <span>
                                      Beneficiary: <strong className="text-slate-700">{f.beneficiaryName}</strong>
                                    </span>
                                  )}
                                  {f.sourceTaskId && (
                                    <span className="text-[11px] text-teal-700 font-medium">
                                      ⚡ Workflow Auto-Triggered
                                    </span>
                                  )}
                                </div>

                                {f.outcome && (
                                  <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
                                    <p className="font-bold flex items-center gap-1">
                                      <FileCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                      Outcome: {f.outcome}
                                    </p>
                                    {f.notes && <p className="text-emerald-800 text-[11px] pl-4">{f.notes}</p>}
                                    {f.completedAt && (
                                      <p className="text-[10px] text-emerald-600 pl-4">
                                        Completed on {new Date(f.completedAt).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {f.rescheduleReason && f.status !== "COMPLETED" && f.status !== "CANCELLED" && (
                                  <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                                    <p className="font-semibold text-[11px]">
                                      Rescheduled: {f.rescheduleReason} ({new Date(f.rescheduledAt || "").toLocaleDateString()})
                                    </p>
                                  </div>
                                )}

                                {f.cancelReason && (
                                  <div className="mt-2 p-2 rounded-lg bg-slate-200/80 border border-slate-300 text-xs text-slate-700">
                                    <p className="font-semibold text-[11px]">
                                      Cancelled ({f.cancelledBy || "ASHA"}): {f.cancelReason}
                                    </p>
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
                                      <span>Mark Done</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenRescheduleModal(f)}
                                      className="text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <span>Reschedule</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenCancelModal(f)}
                                      className="text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <span>Cancel</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleTriggerVoiceCall(f)}
                                      disabled={isVoiceCallingId === f.id}
                                      className="text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
                                    >
                                      <PhoneCall className={`w-3 h-3 text-emerald-700 ${isVoiceCallingId === f.id ? "animate-spin" : ""}`} />
                                      <span>{isVoiceCallingId === f.id ? "Calling..." : "Voice Reminder"}</span>
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openCaseDetail(f.caseId)}
                                  className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50 flex items-center gap-1 cursor-pointer"
                                >
                                  <span>View Case</span>
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
          </div>
        )}

        {/* ============================================================ */}
        {/* CASE DETAIL DRAWER / MODAL */}
        {/* ============================================================ */}
        {selectedCaseId && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs">
            <div className="w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {caseDetail ? caseDetail.household.headOfHouseholdName : "Loading Case..."}
                    </h2>
                    {caseDetail && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          caseDetail.case.priority === "URGENT"
                            ? "bg-red-100 text-red-800"
                            : caseDetail.case.priority === "HIGH"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {caseDetail.case.priority}
                      </span>
                    )}
                  </div>
                  {caseDetail && (
                    <p className="text-xs text-slate-500 mt-1">
                      Case ID: <span className="font-mono text-slate-700">{caseDetail.case.id}</span> • {caseDetail.household.district}, {caseDetail.household.state} • {caseDetail.household.incomeCategory}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssistantOpen(true)}
                    className="text-xs font-semibold flex items-center gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    <Bot className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Ask AI About Case</span>
                  </Button>
                  <button
                    onClick={closeCaseDetail}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Status & Priority Controls Bar */}
              {caseDetail && (
                <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600">Case Status:</span>
                    <select
                      value={caseDetail.case.status}
                      onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
                      className="py-1 px-2 rounded border border-slate-300 bg-white font-medium text-slate-800 text-xs"
                    >
                      <option value="NEW">New</option>
                      <option value="ACTIVE">Active</option>
                      <option value="NEEDS_ATTENTION">Needs Attention</option>
                      <option value="FOLLOW_UP">Follow Up</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600">Priority:</span>
                    <select
                      value={caseDetail.case.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as CasePriority)}
                      className="py-1 px-2 rounded border border-slate-300 bg-white font-medium text-slate-800 text-xs"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Sub-Tabs */}
              <div className="flex border-b border-slate-200 bg-white px-6 text-xs font-semibold overflow-x-auto">
                <button
                  onClick={() => setDetailTab("journey")}
                  className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    detailTab === "journey"
                      ? "border-teal-700 text-teal-900 font-bold bg-teal-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5 text-teal-700" />
                  <span>Scheme Journey & Tasks</span>
                  {caseDetail && caseDetail.tasks && caseDetail.tasks.length > 0 ? (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        caseDetail.tasks.filter((t) => t.status === "COMPLETED").length ===
                        caseDetail.tasks.length
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-teal-100 text-teal-900"
                      }`}
                    >
                      {caseDetail.tasks.filter((t) => t.status === "COMPLETED").length}/
                      {caseDetail.tasks.length}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                      Not Started
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDetailTab("overview")}
                  className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
                    detailTab === "overview"
                      ? "border-emerald-600 text-emerald-800 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Household Info
                </button>
                <button
                  onClick={() => setDetailTab("gaps")}
                  className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                    detailTab === "gaps"
                      ? "border-emerald-600 text-emerald-800 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>Healthcare Gaps</span>
                  {caseDetail && caseDetail.guidance.gaps.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                      {caseDetail.guidance.gaps.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDetailTab("schemes")}
                  className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                    detailTab === "schemes"
                      ? "border-emerald-600 text-emerald-800 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>Eligible Schemes</span>
                  {caseDetail && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                      {caseDetail.eligibilityResults?.filter((r) => r.status === "ELIGIBLE").length ||
                        0}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDetailTab("notes")}
                  className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                    detailTab === "notes"
                      ? "border-emerald-600 text-emerald-800 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>Case Notes</span>
                  {caseDetail && caseDetail.notes.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[10px]">
                      {caseDetail.notes.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDetailTab("followups")}
                  className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                    detailTab === "followups"
                      ? "border-emerald-600 text-emerald-800 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>Follow-ups</span>
                  {caseDetail &&
                    caseDetail.followUps.filter((f) => f.status === "PENDING").length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px]">
                        {caseDetail.followUps.filter((f) => f.status === "PENDING").length}
                      </span>
                    )}
                </button>
                <button
                  onClick={() => setDetailTab("history")}
                  className={`py-3 px-3 border-b-2 transition-colors ${
                    detailTab === "history"
                      ? "border-emerald-600 text-emerald-800 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Audit Trail
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isDetailLoading || !caseDetail ? (
                  <div className="py-16 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
                    <p className="text-sm text-slate-500">Loading household case details...</p>
                  </div>
                ) : (
                  <div>
                    {/* TAB 0: SCHEME JOURNEY & FIELD TASKS */}
                    {detailTab === "journey" && (
                      <div>
                        {/* 1. When Scheme Assistance is NOT Started */}
                        {!caseDetail.case.schemeId ||
                        caseDetail.case.status === "NEW" ||
                        !caseDetail.tasks ||
                        caseDetail.tasks.length === 0 ? (
                          <div className="space-y-6">
                            {/* Not Started Hero Banner */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-slate-200 text-slate-700 tracking-wider">
                                  Assistance Not Started
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                  Case ID: {caseDetail.case.id}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-slate-900">
                                Doorstep Healthcare Assistance Not Started
                              </h3>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                No active scheme facilitation journey is currently running for this
                                household. Select an identified entitlement opportunity below to begin
                                doorstep verification, field assistance, and milestone progress.
                              </p>
                            </div>

                            {/* Actionable Healthcare Opportunities */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-teal-700" />
                                <span>Identified Entitlement Opportunities</span>
                              </h4>

                              {(() => {
                                const actionableSchemes = (
                                  caseDetail.eligibilityResults || []
                                ).filter(
                                  (r) =>
                                    r.status === "ELIGIBLE" ||
                                    (r.schemeId === "jsy" &&
                                      caseDetail.members.some(
                                        (m) => m.maternalStatus === "pregnant"
                                      ))
                                );

                                if (actionableSchemes.length === 0) {
                                  return (
                                    <div className="p-6 rounded-xl border border-slate-200 bg-white text-center space-y-2 text-xs text-slate-500">
                                      <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                                      <p className="font-semibold text-slate-700">
                                        No immediate scheme opportunities identified
                                      </p>
                                      <p>
                                        Review Household Info and Healthcare Gaps tabs to check member
                                        demographic and health details.
                                      </p>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="space-y-3">
                                    {actionableSchemes.map((scheme) => {
                                      const targetMember =
                                        scheme.schemeId === "ab-pmjay"
                                          ? caseDetail.members.find((m) => m.age >= 70)
                                          : scheme.schemeId === "jsy"
                                          ? caseDetail.members.find(
                                              (m) => m.maternalStatus === "pregnant"
                                            ) ||
                                            caseDetail.members.find(
                                              (m) => m.gender === "female" && m.age >= 18
                                            )
                                          : undefined;

                                      const isInitiating =
                                        initiatingSchemeId ===
                                        `${caseDetail.case.id}_${scheme.schemeId}`;

                                      return (
                                        <div
                                          key={scheme.schemeId}
                                          className="p-4 rounded-xl border border-teal-200 bg-teal-50/30 space-y-3 text-xs"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <h5 className="font-bold text-slate-900 text-sm">
                                                  {scheme.schemeName}
                                                </h5>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                                  {scheme.status}
                                                </span>
                                              </div>
                                              <p className="text-slate-600 mt-1">
                                                {scheme.benefitSummary}
                                              </p>
                                            </div>
                                          </div>

                                          {targetMember && (
                                            <div className="p-2.5 rounded-lg bg-white border border-teal-100 flex items-center justify-between text-xs">
                                              <div>
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                                  Target Beneficiary
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                  {targetMember.fullName} (
                                                  {targetMember.relationship}, Age{" "}
                                                  {targetMember.age}
                                                  {targetMember.maternalStatus === "pregnant"
                                                    ? " • Pregnant"
                                                    : ""}
                                                  )
                                                </span>
                                              </div>
                                              <span className="text-[10px] font-mono text-teal-800 bg-teal-50 px-2 py-1 rounded">
                                                {scheme.schemeId === "ab-pmjay"
                                                  ? "5 Field Tasks"
                                                  : "6 Field Tasks"}
                                              </span>
                                            </div>
                                          )}

                                          <div className="pt-2 border-t border-teal-100/80 flex items-center justify-between">
                                            <span className="text-[11px] text-teal-800 font-medium">
                                              Ready to begin doorstep facilitation & card issuance
                                            </span>
                                            <Button
                                              variant="primary"
                                              size="sm"
                                              disabled={isInitiating}
                                              onClick={() =>
                                                handleInitiateScheme(
                                                  caseDetail.case.id,
                                                  scheme.schemeId,
                                                  targetMember?.id
                                                )
                                              }
                                              className="text-xs font-bold py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-2xs"
                                            >
                                              <Send className="w-3.5 h-3.5" />
                                              <span>
                                                {isInitiating ? "Starting..." : "Start Assistance"}
                                              </span>
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          /* 2. When Scheme Assistance IS Active or Completed */
                          <div className="space-y-6">
                            {/* Scheme & Beneficiary Summary Card */}
                            <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:p-5 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-100 pb-3">
                                <div>
                                  <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                                    Active Healthcare Scheme:
                                  </span>
                                  <h3 className="text-base font-bold text-teal-950">
                                    {caseDetail.case.schemeName ||
                                      (caseDetail.case.schemeId === "ab-pmjay"
                                        ? "Ayushman Bharat — PM-JAY (Senior 70+)"
                                        : caseDetail.case.schemeId === "jsy"
                                        ? "Janani Suraksha Yojana (JSY)"
                                        : caseDetail.case.schemeId)}
                                  </h3>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleOpenVoiceCallModal(undefined, caseDetail.case)}
                                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer py-1 px-3"
                                  >
                                    <PhoneCall className="w-3.5 h-3.5" />
                                    <span>Call Beneficiary</span>
                                  </Button>
                                  <span
                                    className={`text-xs font-bold px-3 py-1 rounded-full border self-start sm:self-auto flex items-center gap-1.5 ${
                                      ["RESOLVED", "CLOSED"].includes(caseDetail.case.status)
                                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                        : "bg-blue-100 text-blue-900 border-blue-300"
                                    }`}
                                  >
                                    {["RESOLVED", "CLOSED"].includes(caseDetail.case.status) ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                        <span>✓ Case Resolved & Assistance Completed</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                        <span>Case Status: {caseDetail.case.status}</span>
                                      </>
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="bg-white p-3 rounded-lg border border-teal-100">
                                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                                    Target Beneficiary
                                  </span>
                                  <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                                    <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                                    <span>
                                      {caseDetail.case.beneficiaryName ||
                                        caseDetail.household.headOfHouseholdName}
                                    </span>
                                  </span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-teal-100">
                                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                                    Household Head
                                  </span>
                                  <span className="font-semibold text-slate-800 mt-0.5 block">
                                    {caseDetail.household.headOfHouseholdName}
                                  </span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-teal-100">
                                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                                    Location
                                  </span>
                                  <span className="text-slate-800 mt-0.5 block">
                                    {caseDetail.household.district}, {caseDetail.household.state}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Scheme Journey Milestones */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-teal-700" />
                                <span>Entitlement Journey Milestones</span>
                              </h4>

                              {caseDetail.journeySteps && caseDetail.journeySteps.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                                  {caseDetail.journeySteps.map((step, sIdx) => {
                                    const isDone =
                                      step.status === "COMPLETED" ||
                                      ["RESOLVED", "CLOSED"].includes(caseDetail.case.status);
                                    const isCurrent =
                                      step.status === "CURRENT" &&
                                      !["RESOLVED", "CLOSED"].includes(caseDetail.case.status);

                                    return (
                                      <div
                                        key={step.stepId || sIdx}
                                        className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                                          isDone
                                            ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold"
                                            : isCurrent
                                            ? "bg-blue-50 border-blue-400 text-blue-950 font-bold ring-2 ring-blue-300/70"
                                            : "bg-slate-50 border-slate-200 text-slate-500"
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                                              Step {sIdx + 1}
                                            </span>
                                            {isDone ? (
                                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            ) : isCurrent ? (
                                              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                                            ) : (
                                              <span className="w-2.5 h-2.5 rounded-full border border-slate-300" />
                                            )}
                                          </div>
                                          <h5 className="font-bold text-xs">{step.title}</h5>
                                          <p className="text-[11px] font-normal text-slate-600 mt-1 line-clamp-2">
                                            {step.description}
                                          </p>
                                        </div>
                                        {isDone && (
                                          <span className="text-[10px] text-emerald-700 mt-2 font-mono">
                                            ✓ Completed
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                                  No predefined journey steps for this case. Custom tasks can be
                                  tracked below.
                                </div>
                              )}
                            </div>

                            {/* Interactive Field Tasks Checklist */}
                            <div className="space-y-4 pt-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                <div>
                                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <CheckSquare className="w-4 h-4 text-teal-700" />
                                    <span>Field Action Tasks</span>
                                    {caseDetail.tasks && (
                                      <span
                                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                          caseDetail.tasks.filter((t) => t.status === "COMPLETED")
                                            .length === caseDetail.tasks.length
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-teal-100 text-teal-800"
                                        }`}
                                      >
                                        {
                                          caseDetail.tasks.filter((t) => t.status === "COMPLETED")
                                            .length
                                        }{" "}
                                        of {caseDetail.tasks.length} Completed
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Complete tasks to advance the scheme journey and achieve official
                                    benefit resolution.
                                  </p>
                                </div>

                                {/* Progress bar */}
                                {caseDetail.tasks && caseDetail.tasks.length > 0 && (
                                  <div className="w-full sm:w-44 space-y-1">
                                    <div className="flex justify-between text-[11px] font-mono text-slate-600">
                                      <span>Progress</span>
                                      <span>
                                        {Math.round(
                                          (caseDetail.tasks.filter((t) => t.status === "COMPLETED")
                                            .length /
                                            caseDetail.tasks.length) *
                                            100
                                        )}
                                        %
                                      </span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                      <div
                                        className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                                        style={{
                                          width: `${
                                            (caseDetail.tasks.filter((t) => t.status === "COMPLETED")
                                              .length /
                                              caseDetail.tasks.length) *
                                            100
                                          }%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Task List */}
                              {caseDetail.tasks && caseDetail.tasks.length > 0 ? (
                                <div className="space-y-2.5">
                                  {caseDetail.tasks.map((task, tIdx) => {
                                    const isDone = task.status === "COMPLETED";
                                    const isBlocked = task.status === "BLOCKED";
                                    const isInProgress = task.status === "IN_PROGRESS";

                                    return (
                                      <div
                                        key={task.id}
                                        className={`p-4 rounded-xl border transition-all space-y-2 ${
                                          isDone
                                            ? "bg-emerald-50/40 border-emerald-200 text-slate-700"
                                            : isBlocked
                                            ? "bg-rose-50/40 border-rose-200"
                                            : isInProgress
                                            ? "bg-blue-50/40 border-blue-200 ring-1 ring-blue-300/50"
                                            : "bg-white border-slate-200 shadow-2xs"
                                        }`}
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div className="flex items-start gap-2.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                !isDone && handleCompleteTask(task.id)
                                              }
                                              disabled={isDone}
                                              className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                                isDone
                                                  ? "bg-emerald-600 border-emerald-600 text-white cursor-default"
                                                  : "border-slate-300 hover:border-emerald-600 hover:bg-emerald-50 text-transparent hover:text-emerald-700 cursor-pointer"
                                              }`}
                                              title={
                                                isDone ? "Task Completed" : "Click to mark done"
                                              }
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                            </button>

                                            <div className="space-y-0.5">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-xs sm:text-sm text-slate-900">
                                                  {tIdx + 1}. {task.title}
                                                </span>
                                                <span
                                                  className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase ${
                                                    isDone
                                                      ? "bg-emerald-100 text-emerald-800"
                                                      : isBlocked
                                                      ? "bg-rose-100 text-rose-800"
                                                      : isInProgress
                                                      ? "bg-blue-100 text-blue-800"
                                                      : "bg-slate-100 text-slate-700"
                                                  }`}
                                                >
                                                  {task.status.replace(/_/g, " ")}
                                                </span>
                                              </div>
                                              <p className="text-xs text-slate-600 leading-relaxed">
                                                {task.description}
                                              </p>
                                            </div>
                                          </div>

                                          {/* Quick Status Buttons */}
                                          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                            {!isDone ? (
                                              <>
                                                {!isInProgress && (
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                      handleUpdateTaskStatus(task.id, "IN_PROGRESS")
                                                    }
                                                    className="text-[11px] py-1 px-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                                                  >
                                                    Start
                                                  </Button>
                                                )}
                                                {!isBlocked && (
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                      handleUpdateTaskStatus(task.id, "BLOCKED")
                                                    }
                                                    className="text-[11px] py-1 px-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                                                  >
                                                    Block
                                                  </Button>
                                                )}
                                                <Button
                                                  variant="primary"
                                                  size="sm"
                                                  onClick={() => handleCompleteTask(task.id)}
                                                  className="text-[11px] py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1"
                                                >
                                                  <Check className="w-3 h-3" /> Mark Done
                                                </Button>
                                              </>
                                            ) : (
                                              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Done
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {task.notes && (
                                          <div className="pl-7 text-[11px] text-slate-500 italic">
                                            Notes: {task.notes}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                                  No tasks created for this case yet. Add custom tasks below.
                                </div>
                              )}

                              {/* Add Custom Field Task Form */}
                              <form
                                onSubmit={handleCreateTask}
                                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                              >
                                <span className="text-xs font-bold text-slate-800 block">
                                  + Add Custom Field Task for this Family
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    required
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="Task title (e.g. Collect Ration Card Copy)"
                                    className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                                  />
                                  <input
                                    type="text"
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    placeholder="Details or instructions..."
                                    className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                    disabled={isTaskSubmitting || !newTaskTitle.trim()}
                                    className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white border-teal-800"
                                  >
                                    {isTaskSubmitting ? "Adding..." : "+ Add Task"}
                                  </Button>
                                </div>
                              </form>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 1: HOUSEHOLD OVERVIEW */}
                    {detailTab === "overview" && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                              Ration Category
                            </span>
                            <span className="font-bold text-slate-900">
                              {caseDetail.household.incomeCategory}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                              Ration Card No.
                            </span>
                            <span className="font-mono text-slate-800">
                              {caseDetail.household.rationCardNumber || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                              Location
                            </span>
                            <span className="text-slate-900">
                              {caseDetail.household.district}, {caseDetail.household.state}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                              Contact Phone
                            </span>
                            <span className="text-slate-900">
                              {caseDetail.household.contactPhone || "Not Provided"}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-900 mb-2.5">
                            Family Members ({caseDetail.members.length})
                          </h4>
                          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                            {caseDetail.members.map((m) => (
                              <div
                                key={m.id}
                                className="p-3 bg-white flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-bold text-slate-900">{m.fullName}</span>
                                  <span className="text-slate-500 ml-2">
                                    {m.relationship} • {m.age} yrs • {m.gender}
                                  </span>
                                </div>
                                <div className="flex gap-1.5">
                                  {m.age >= 70 && (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded text-[10px]">
                                      Senior 70+
                                    </span>
                                  )}
                                  {m.maternalStatus === "pregnant" && (
                                    <span className="px-2 py-0.5 bg-purple-50 text-purple-800 font-bold rounded text-[10px]">
                                      Pregnant
                                    </span>
                                  )}
                                  {m.disabilityStatus && (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-bold rounded text-[10px]">
                                      Disability
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: HEALTHCARE GAPS */}
                    {detailTab === "gaps" && (
                      <div className="space-y-4">
                        {caseDetail.guidance.gaps.length === 0 ? (
                          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                            <span>
                              No access gaps detected for this household. All basic entitlements match
                              profile.
                            </span>
                          </div>
                        ) : (
                          caseDetail.guidance.gaps.map((g, idx) => {
                            const isAssistanceCompleted =
                              (g.schemeId &&
                                g.schemeId === caseDetail.case.schemeId &&
                                ["RESOLVED", "CLOSED"].includes(caseDetail.case.status)) ||
                              Boolean(
                                caseDetail.assistanceRequests?.some(
                                  (r) =>
                                    r.schemeId === g.schemeId &&
                                    ["RESOLVED", "CLOSED"].includes(r.status)
                                )
                              );

                            const isAssistanceInProgress =
                              !isAssistanceCompleted &&
                              ((g.schemeId &&
                                g.schemeId === caseDetail.case.schemeId &&
                                !["RESOLVED", "CLOSED", "CITIZEN_DECLINED"].includes(
                                  caseDetail.case.status
                                )) ||
                                Boolean(
                                  caseDetail.assistanceRequests?.some(
                                    (r) =>
                                      r.schemeId === g.schemeId &&
                                      !["RESOLVED", "CLOSED", "DECLINED"].includes(r.status)
                                  )
                                ));

                            const targetMember =
                              g.schemeId === "ab-pmjay"
                                ? caseDetail.members.find((m) => m.age >= 70)
                                : g.schemeId === "jsy"
                                ? caseDetail.members.find((m) => m.maternalStatus === "pregnant") ||
                                  caseDetail.members.find((m) => m.gender === "female" && m.age >= 18)
                                : undefined;

                            return (
                              <div
                                key={g.id || idx}
                                className={`p-4 rounded-xl border space-y-2 text-xs transition-all ${
                                  isAssistanceCompleted
                                    ? "bg-emerald-50/40 border-emerald-300 text-slate-800"
                                    : isAssistanceInProgress
                                    ? "bg-blue-50/40 border-blue-300 text-slate-800"
                                    : g.priority === "REQUIRED"
                                    ? "bg-rose-50/50 border-rose-200 text-rose-950"
                                    : g.priority === "IMPORTANT"
                                    ? "bg-amber-50/50 border-amber-200 text-amber-950"
                                    : "bg-slate-50 border-slate-200 text-slate-800"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 bg-white rounded border border-slate-200">
                                    {g.type.replace(/_/g, " ")}
                                  </span>
                                  {isAssistanceCompleted ? (
                                    <span className="font-bold text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>ASSISTANCE COMPLETED</span>
                                    </span>
                                  ) : isAssistanceInProgress ? (
                                    <span className="font-bold text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded border border-blue-200">
                                      ● IN PROGRESS
                                    </span>
                                  ) : (
                                    <span className="font-bold text-[10px]">{g.priority}</span>
                                  )}
                                </div>
                                <p className="font-bold text-sm text-slate-900">
                                  {g.title || g.description}
                                </p>
                                <p className="text-slate-600">{g.description}</p>
                                {g.reason && (
                                  <p className="text-[11px] text-teal-800 font-medium">
                                    Why: {g.reason}
                                  </p>
                                )}
                                {g.schemeId &&
                                  (g.schemeId === "ab-pmjay" || g.schemeId === "jsy") && (
                                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                                      {isAssistanceCompleted ? (
                                        <>
                                          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Assistance Completed for this Entitlement</span>
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDetailTab("journey");
                                            }}
                                            className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                                          >
                                            View Completed Journey
                                          </Button>
                                        </>
                                      ) : isAssistanceInProgress ? (
                                        <>
                                          <span className="text-[11px] font-bold text-blue-800 flex items-center gap-1">
                                            <Clock3 className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Doorstep Assistance In Progress</span>
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDetailTab("journey");
                                            }}
                                            className="text-xs font-semibold border-blue-300 text-blue-800 hover:bg-blue-50"
                                          >
                                            Continue Journey
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-[11px] font-medium text-emerald-800">
                                            Actionable entitlement gap identified
                                          </span>
                                          <Button
                                            variant="primary"
                                            size="sm"
                                            disabled={
                                              initiatingSchemeId ===
                                              `${caseDetail.case.id}_${g.schemeId}`
                                            }
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleInitiateScheme(
                                                caseDetail.case.id,
                                                g.schemeId!,
                                                targetMember?.id
                                              );
                                            }}
                                            className="text-xs font-bold py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1"
                                          >
                                            <Send className="w-3 h-3" />
                                            <span>
                                              {initiatingSchemeId ===
                                              `${caseDetail.case.id}_${g.schemeId}`
                                                ? "Starting..."
                                                : "Start Assistance"}
                                            </span>
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* TAB 3: ELIGIBLE SCHEMES */}
                    {detailTab === "schemes" && (
                      <div className="space-y-3">
                        {caseDetail.eligibilityResults?.map((r) => {
                          const isJourneyCompleted =
                            (caseDetail.case.schemeId === r.schemeId &&
                              ["RESOLVED", "CLOSED"].includes(caseDetail.case.status)) ||
                            Boolean(
                              caseDetail.assistanceRequests?.some(
                                (req) =>
                                  req.schemeId === r.schemeId &&
                                  ["RESOLVED", "CLOSED"].includes(req.status)
                              )
                            );

                          const isJourneyActive =
                            !isJourneyCompleted &&
                            ((caseDetail.case.schemeId === r.schemeId &&
                              !["RESOLVED", "CLOSED", "CITIZEN_DECLINED"].includes(
                                caseDetail.case.status
                              )) ||
                              Boolean(
                                caseDetail.assistanceRequests?.some(
                                  (req) =>
                                    req.schemeId === r.schemeId &&
                                    !["RESOLVED", "CLOSED", "DECLINED"].includes(req.status)
                                )
                              ));

                          const targetMember =
                            r.schemeId === "ab-pmjay"
                              ? caseDetail.members.find((m) => m.age >= 70)
                              : r.schemeId === "jsy"
                              ? caseDetail.members.find((m) => m.maternalStatus === "pregnant") ||
                                caseDetail.members.find((m) => m.gender === "female" && m.age >= 18)
                              : undefined;

                          return (
                            <div
                              key={r.schemeId}
                              className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                                isJourneyCompleted
                                  ? "bg-emerald-50/40 border-emerald-300"
                                  : isJourneyActive
                                  ? "bg-blue-50/30 border-blue-300"
                                  : r.status === "ELIGIBLE"
                                  ? "bg-emerald-50/30 border-emerald-200"
                                  : r.status === "NEEDS_INFORMATION"
                                  ? "bg-amber-50/30 border-amber-200"
                                  : "bg-slate-50 border-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <h5 className="font-bold text-slate-900 text-sm">{r.schemeName}</h5>
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                    isJourneyCompleted
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : isJourneyActive
                                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                                      : r.status === "ELIGIBLE"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : r.status === "NEEDS_INFORMATION"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {isJourneyCompleted
                                    ? "ASSISTANCE COMPLETED"
                                    : isJourneyActive
                                    ? "IN PROGRESS"
                                    : r.status}
                                </span>
                              </div>
                              <p className="text-slate-600">{r.benefitSummary}</p>
                              {r.matchedRules && r.matchedRules.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 text-[11px] text-emerald-900">
                                  <strong>Matched Rules:</strong>{" "}
                                  {r.matchedRules.map((m: any) => m.explanation).join(". ")}
                                </div>
                              )}

                              {(r.status === "ELIGIBLE" ||
                                (r.schemeId === "jsy" &&
                                  caseDetail.members.some(
                                    (m) => m.maternalStatus === "pregnant"
                                  ))) && (
                                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                  {isJourneyCompleted ? (
                                    <>
                                      <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>ASHA Assistance Journey Completed & Resolved</span>
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDetailTab("journey");
                                        }}
                                        className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                                      >
                                        View Completed Journey
                                      </Button>
                                    </>
                                  ) : isJourneyActive ? (
                                    <>
                                      <span className="text-[11px] text-blue-800 font-bold flex items-center gap-1">
                                        <Clock3 className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Active Doorstep Assistance Journey in Progress</span>
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDetailTab("journey");
                                        }}
                                        className="text-xs font-semibold border-blue-300 text-blue-800 hover:bg-blue-50"
                                      >
                                        Continue Journey
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-[11px] text-emerald-800 font-medium">
                                        Verified opportunity: Ready for doorstep assistance
                                      </span>
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        disabled={
                                          initiatingSchemeId ===
                                          `${caseDetail.case.id}_${r.schemeId}`
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleInitiateScheme(
                                            caseDetail.case.id,
                                            r.schemeId,
                                            targetMember?.id
                                          );
                                        }}
                                        className="text-xs font-bold py-1 px-3 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>
                                          {initiatingSchemeId ===
                                          `${caseDetail.case.id}_${r.schemeId}`
                                            ? "Starting..."
                                            : "Start Assistance"}
                                        </span>
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TAB 4: CASE NOTES */}
                    {detailTab === "notes" && (
                      <div className="space-y-4">
                        <form onSubmit={handleAddNote} className="space-y-2">
                          <textarea
                            rows={3}
                            placeholder="Add a field note (e.g. Visited household. Verified maternal card...)"
                            value={newNoteContent}
                            onChange={(e) => setNewNoteContent(e.target.value)}
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              variant="primary"
                              size="sm"
                              disabled={isNoteSubmitting || !newNoteContent.trim()}
                              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                            >
                              {isNoteSubmitting ? "Saving..." : "Add Note"}
                            </Button>
                          </div>
                        </form>

                        <div className="space-y-2.5 pt-2">
                          {caseDetail.notes.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No field notes recorded yet.</p>
                          ) : (
                            caseDetail.notes.map((n) => (
                              <div key={n.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                                  <span className="font-bold text-slate-700">{n.authorName}</span>
                                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-slate-800">{n.content}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 5: FOLLOW-UPS */}
                    {detailTab === "followups" && (
                      <div className="space-y-4">
                        <form onSubmit={handleScheduleFollowUp} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                          <h5 className="font-bold text-xs text-slate-900">Schedule New Follow-up</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Target Date</label>
                              <input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Task / Purpose</label>
                              <input
                                type="text"
                                placeholder="e.g. Check PM-JAY e-Card generation status"
                                value={followUpReason}
                                onChange={(e) => setFollowUpReason(e.target.value)}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              variant="primary"
                              size="sm"
                              disabled={isFollowUpSubmitting || !followUpDate || !followUpReason.trim()}
                              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                            >
                              {isFollowUpSubmitting ? "Scheduling..." : "Schedule Follow-up"}
                            </Button>
                          </div>
                        </form>

                        <div className="space-y-2.5 pt-2">
                          {caseDetail.followUps.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No scheduled follow-ups.</p>
                          ) : (
                            caseDetail.followUps.map((f) => (
                              <div
                                key={f.id}
                                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                                  f.status === "COMPLETED"
                                    ? "bg-slate-50 border-slate-200"
                                    : f.isOverdue
                                    ? "bg-rose-50/50 border-rose-200"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">{f.title || f.reason}</span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          f.status === "COMPLETED"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : f.status === "CANCELLED"
                                            ? "bg-slate-200 text-slate-700"
                                            : f.isOverdue
                                            ? "bg-rose-100 text-rose-800"
                                            : "bg-sky-100 text-sky-800"
                                        }`}
                                      >
                                        {f.status === "COMPLETED" ? "COMPLETED" : f.status === "CANCELLED" ? "CANCELLED" : f.isOverdue ? "OVERDUE" : "PENDING"}
                                      </span>
                                    </div>
                                    {f.title && f.title !== f.reason && (
                                      <p className="text-slate-600 text-[11px] mt-0.5">{f.reason}</p>
                                    )}
                                    <p className="text-slate-500 text-[11px] mt-0.5">
                                      Due: {new Date(f.dueAt || f.scheduledAt).toLocaleDateString()}
                                    </p>
                                  </div>

                                  {f.status !== "COMPLETED" && f.status !== "CANCELLED" && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleOpenCompleteModal(f)}
                                        className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                                      >
                                        Mark Done
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenRescheduleModal(f)}
                                        className="text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                                      >
                                        Reschedule
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenCancelModal(f)}
                                        className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleTriggerVoiceCall(f)}
                                        disabled={isVoiceCallingId === f.id}
                                        className="text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
                                      >
                                        <PhoneCall className={`w-3 h-3 text-emerald-700 ${isVoiceCallingId === f.id ? "animate-spin" : ""}`} />
                                        <span>{isVoiceCallingId === f.id ? "Calling..." : "Call"}</span>
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {f.outcome && (
                                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                                    <strong>Outcome:</strong> {f.outcome}
                                    {f.notes && <span className="block text-slate-600 mt-0.5">{f.notes}</span>}
                                  </div>
                                )}

                                {f.rescheduleReason && f.status !== "COMPLETED" && f.status !== "CANCELLED" && (
                                  <div className="p-1.5 rounded bg-amber-50 text-amber-800 text-[10px]">
                                    Rescheduled: {f.rescheduleReason}
                                  </div>
                                )}

                                {f.cancelReason && (
                                  <div className="p-1.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                                    Cancelled ({f.cancelledBy || "ASHA"}): {f.cancelReason}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 6: AUDIT TRAIL */}
                    {detailTab === "history" && (
                      <div className="space-y-2.5">
                        {caseDetail.activities.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6">No audit activities logged yet.</p>
                        ) : (
                          caseDetail.activities.map((a) => (
                            <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-bold text-slate-700">{a.actorName} ({a.actorRole})</span>
                                <span>{new Date(a.timestamp).toLocaleString()}</span>
                              </div>
                              <p className="text-slate-800">{a.description}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* FIELD REGISTRATION MODAL */}
        {/* ============================================================ */}
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-700" />
                  <span>Field Household Registration</span>
                </h3>
                <button onClick={() => setIsRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {registerError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-lg text-xs border border-red-200">{registerError}</div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Head of Household Name *</label>
                  <input
                    type="text"
                    required
                    value={registerForm.headOfHouseholdName}
                    onChange={(e) => setRegisterForm({ ...registerForm, headOfHouseholdName: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Ration Category *</label>
                    <select
                      value={registerForm.incomeCategory}
                      onChange={(e) => setRegisterForm({ ...registerForm, incomeCategory: e.target.value as IncomeCategory })}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="BPL">BPL (Below Poverty Line)</option>
                      <option value="AAY">AAY (Antyodaya)</option>
                      <option value="APL">APL (Above Poverty Line)</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Ration Card Number</label>
                    <input
                      type="text"
                      value={registerForm.rationCardNumber || ""}
                      onChange={(e) => setRegisterForm({ ...registerForm, rationCardNumber: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200"
                      placeholder="e.g. RC-KA-99128"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">District *</label>
                    <input
                      type="text"
                      required
                      value={registerForm.district}
                      onChange={(e) => setRegisterForm({ ...registerForm, district: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Village / Ward *</label>
                    <input
                      type="text"
                      required
                      value={registerForm.village}
                      onChange={(e) => setRegisterForm({ ...registerForm, village: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsRegisterModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={registerSubmitting}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                  >
                    {registerSubmitting ? "Registering..." : "Create Case"}
                  </Button>
                </div>
              </form>
            </div>
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
                  <span>Record Follow-up Outcome</span>
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
                  Household: <strong>{completingFollowUp.headOfHouseholdName || "Assigned Family"}</strong>
                </p>
                <p className="text-slate-500">
                  Target Due Date: {new Date(completingFollowUp.dueAt || completingFollowUp.scheduledAt).toLocaleDateString()}
                </p>
              </div>

              <form onSubmit={handleCompleteFollowUpSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Visit Outcome / Action Taken *
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
                    Field Notes & Observations (Optional)
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
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isCompletingSubmitting || !completeOutcome.trim()}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
                  >
                    {isCompletingSubmitting ? "Completing..." : "Save & Complete Visit"}
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
                  <span>Reschedule Follow-up Visit</span>
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
                  Household: <strong>{reschedulingFollowUp.headOfHouseholdName || "Assigned Family"}</strong>
                </p>
                <p className="text-slate-600">
                  Current Due Date: {new Date(reschedulingFollowUp.dueAt || reschedulingFollowUp.scheduledAt).toLocaleDateString()}
                </p>
              </div>

              <form onSubmit={handleRescheduleFollowUpSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    New Target Date *
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
                    Reason for Rescheduling *
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
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isReschedulingSubmitting || !rescheduleDate || !rescheduleReason.trim()}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
                  >
                    {isReschedulingSubmitting ? "Rescheduling..." : "Confirm New Schedule"}
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
                  <span>Cancel Scheduled Follow-up</span>
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
                  Household: <strong>{cancellingFollowUp.headOfHouseholdName || "Assigned Family"}</strong>
                </p>
                <p className="text-slate-600">
                  Target Due Date: {new Date(cancellingFollowUp.dueAt || cancellingFollowUp.scheduledAt).toLocaleDateString()}
                </p>
              </div>

              <form onSubmit={handleCancelFollowUpSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Reason for Cancellation *
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
                    Keep Follow-up
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isCancellingSubmitting || !cancelReason.trim()}
                    className="bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer"
                  >
                    {isCancellingSubmitting ? "Cancelling..." : "Confirm Cancellation"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Floating Field Assistant Trigger */}
        <button
          onClick={() => setIsAssistantOpen(true)}
          aria-label="Open SwasthyaSetu Field Assistant"
          className="fixed bottom-6 right-6 z-40 bg-emerald-800 hover:bg-emerald-900 text-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95 border border-emerald-700 cursor-pointer"
        >
          <Bot className="w-4 h-4 text-emerald-200" />
          <span>Field Assistant</span>
        </button>

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
              if (selectedCaseId) {
                caseService.getCaseDetail(selectedCaseId).then((res) => {
                  if (res.success && res.data) setCaseDetail(res.data);
                });
              }
              loadFollowUps();
              loadCaseload();
            }}
          />
        )}
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
