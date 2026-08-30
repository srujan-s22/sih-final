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
} from "lucide-react";
import { caseService } from "@/services/case-service";
import { connectionService } from "@/services/connection-service";
import { assistanceService } from "@/services/assistance-service";
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
  const [followUpFilter, setFollowUpFilter] = useState<"ALL" | "DUE_TODAY" | "OVERDUE" | "UPCOMING" | "COMPLETED">("ALL");

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
        if (selectedCaseId === caseId) {
          await openCaseDetail(caseId);
          setDetailTab("journey");
        }
      } else {
        setErrorMessage((res as any).error?.message || "Failed to initiate scheme assistance.");
      }
    } catch {
      setErrorMessage("Failed to initiate scheme assistance.");
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
        await loadCaseload();
      }
    } catch {
      // Quiet fail
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
        await loadCaseload();
      }
    } catch {
      // Quiet fail
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

  const pendingAssistanceCount = assistanceRequests.filter(
    (r) => r.status === "PENDING" || r.status === "IN_PROGRESS"
  ).length;

  const totalRequestsBadge = pendingAssistanceCount + connectionRequests.length;
  const totalFollowUpBadge = (followUpSummary?.overdue || 0) + (followUpSummary?.dueToday || 0);

  const navTabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "cases", label: "Caseload", icon: Users },
    { id: "requests", label: `Requests (${totalRequestsBadge})`, icon: Inbox },
    { id: "attention", label: `Needs Attention (${attentionSignals.length})`, icon: AlertCircle },
    {
      id: "followups",
      label: `Follow-ups${totalFollowUpBadge > 0 ? ` (${totalFollowUpBadge})` : ""}`,
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
        title="ASHA Operational Workspace"
        description="Manage assigned households, monitor healthcare access gaps, schedule follow-ups, and assist families with government health programs."
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
            {/* 1. OVERVIEW TAB */}
            {/* ============================================================ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  <div
                    onClick={() => setActiveTab("cases")}
                    className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs cursor-pointer hover:border-emerald-300 transition-colors"
                  >
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Cases</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{summary?.totalAssigned ?? cases.length}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Persisted households</p>
                  </div>
                  <div
                    onClick={() => setActiveTab("attention")}
                    className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-2xs bg-amber-50/20 cursor-pointer hover:border-amber-300 transition-colors"
                  >
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Needs Attention</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">{summary?.needsAttentionCount ?? needsAttentionCases.length}</p>
                    <p className="text-xs text-amber-600 mt-0.5">Identified healthcare gaps</p>
                  </div>
                  <div
                    onClick={() => setActiveTab("followups")}
                    className="bg-white rounded-xl border border-blue-200/80 p-4 shadow-2xs bg-blue-50/20 cursor-pointer hover:border-blue-300 transition-colors"
                  >
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Upcoming Tasks</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">{summary?.upcomingFollowUpsCount ?? upcomingFollowUpCases.length}</p>
                    <p className="text-xs text-blue-600 mt-0.5">Scheduled follow-ups</p>
                  </div>
                  <div
                    onClick={() => setActiveTab("requests")}
                    className="bg-white rounded-xl border border-teal-200/80 p-4 shadow-2xs bg-teal-50/20 cursor-pointer hover:border-teal-300 transition-colors"
                  >
                    <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Citizen Requests</p>
                    <p className="text-2xl font-bold text-teal-900 mt-1">{totalRequestsBadge}</p>
                    <p className="text-xs text-teal-600 mt-0.5">{pendingAssistanceCount} assistance, {connectionRequests.length} connect</p>
                  </div>
                  <div
                    onClick={() => setActiveTab("cases")}
                    className="bg-white rounded-xl border border-emerald-200/80 p-4 shadow-2xs bg-emerald-50/20 cursor-pointer hover:border-emerald-300 transition-colors"
                  >
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Resolved</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {summary?.resolvedCount ?? cases.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED").length}
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">Completed cases</p>
                  </div>
                </div>

                {/* Main Highlights Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Needs Immediate Attention */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Action Opportunities & Attention Queue</span>
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("attention")}
                        className="text-xs font-semibold text-amber-800 border-amber-200 hover:bg-amber-50"
                      >
                        View All ({attentionSignals.length})
                      </Button>
                    </div>

                    {attentionSignals.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                        <span>No households currently require attention.</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {attentionSignals.slice(0, 3).map((sig) => (
                          <div
                            key={sig.id}
                            className="p-3 bg-slate-50 hover:bg-amber-50/50 rounded-lg border border-slate-200/80 space-y-2 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  sig.priority === "URGENT"
                                    ? "bg-red-100 text-red-800"
                                    : sig.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {sig.priority}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {sig.category.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">{sig.title}</h4>
                              <p className="text-[11px] text-slate-600 mt-0.5">{sig.subtitle}</p>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                              <span className="text-[10px] text-emerald-800 font-medium">
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
                                    className="text-[11px] font-bold py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white"
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
                                  className="text-[11px] font-semibold py-1 px-2.5"
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

                  {/* Citizen Assistance Requests Quickview */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-teal-700" />
                        <span>Incoming Citizen Requests</span>
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("requests")}
                        className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
                      >
                        Requests Queue
                      </Button>
                    </div>

                    {assistanceRequests.length === 0 && connectionRequests.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500">
                        <Inbox className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                        <span>No incoming assistance or connection requests pending.</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {assistanceRequests.slice(0, 2).map((req) => (
                          <div
                            key={req.id}
                            onClick={() => {
                              setRequestsSubTab("assistance");
                              setActiveTab("requests");
                            }}
                            className="p-3 bg-teal-50/50 hover:bg-teal-50 rounded-lg border border-teal-100 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{req.headOfHouseholdName}</span>
                                <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded">
                                  {req.category.replace(/_/g, " ")}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 line-clamp-1">{req.message}</p>
                            </div>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full uppercase">
                              {req.status}
                            </span>
                          </div>
                        ))}

                        {connectionRequests.slice(0, 2).map((req) => (
                          <div
                            key={req.id}
                            onClick={() => {
                              setRequestsSubTab("connections");
                              setActiveTab("requests");
                            }}
                            className="p-3 bg-emerald-50/50 hover:bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div>
                              <span className="text-xs font-bold text-slate-900">{req.headOfHouseholdName}</span>
                              <p className="text-[11px] text-slate-500">Household Connection Request</p>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Pending Connect
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 2. CASELOAD TAB */}
            {/* ============================================================ */}
            {activeTab === "cases" && (
              <div className="space-y-4">
                {/* Search & Filter Controls */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search households by head name, district, or case ID..."
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
                      <option value="ACTIVE">Active</option>
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
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                {filteredCases.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-800">No Matching Cases Found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                      No assigned cases match your current search and filter criteria.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Head of Household</th>
                            <th className="py-3 px-4">District</th>
                            <th className="py-3 px-4">Ration Tier</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Priority</th>
                            <th className="py-3 px-4">Gaps Identified</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCases.map((c) => (
                            <tr
                              key={c.id}
                              className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                              onClick={() => openCaseDetail(c.id)}
                            >
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900">{c.headOfHouseholdName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{c.id}</div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                {c.district}, {c.state}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px]">
                                  {c.incomeCategory}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                    c.status === "NEEDS_ATTENTION"
                                      ? "bg-amber-100 text-amber-800"
                                      : c.status === "ACTIVE"
                                      ? "bg-blue-100 text-blue-800"
                                      : c.status === "RESOLVED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {c.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                    c.priority === "URGENT"
                                      ? "bg-red-100 text-red-800"
                                      : c.priority === "HIGH"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {c.priority}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">
                                {c.detectedGapsCount > 0 ? (
                                  <span className="text-amber-700 font-bold">
                                    {c.detectedGapsCount} gap{c.detectedGapsCount === 1 ? "" : "s"}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-medium">None</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <Button variant="outline" size="sm" className="text-xs font-semibold py-1 px-2.5">
                                  View Case
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* 3. REQUESTS TAB (ASSISTANCE & CONNECTIONS) */}
            {/* ============================================================ */}
            {activeTab === "requests" && (
              <div className="space-y-4">
                {/* Subtab Switcher */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    onClick={() => setRequestsSubTab("assistance")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      requestsSubTab === "assistance"
                        ? "bg-teal-800 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    Citizen Assistance Requests ({assistanceRequests.length})
                  </button>
                  <button
                    onClick={() => setRequestsSubTab("connections")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      requestsSubTab === "connections"
                        ? "bg-emerald-700 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    Household Connection Requests ({connectionRequests.length})
                  </button>
                </div>

                {/* SUBTAB A: CITIZEN ASSISTANCE REQUESTS */}
                {requestsSubTab === "assistance" && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-teal-700" />
                          <span>Citizen Assistance Queue</span>
                          <span className="text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full">
                            {pendingAssistanceCount} Active
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Requests from connected citizens requesting scheme enrollment, document help, or health facility guidance.
                        </p>
                      </div>
                    </div>

                    {assistanceRequests.length === 0 ? (
                      <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-8">
                        <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-800">No Assistance Requests</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                          When connected citizens request help with schemes or documents, their requests will appear here with one-click case access.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assistanceRequests.map((req) => {
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
                                  ? "border-teal-300 bg-teal-50/15 ring-2 ring-teal-200/50"
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
                                      {req.priority && req.priority !== "NORMAL" && (
                                        <span
                                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                            req.priority === "URGENT"
                                              ? "bg-rose-100 text-rose-800 border border-rose-300 animate-pulse"
                                              : "bg-amber-100 text-amber-800 border border-amber-300"
                                          }`}
                                        >
                                          {req.priority} PRIORITY
                                        </span>
                                      )}
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
                                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 flex items-center justify-between text-xs text-emerald-950">
                                    <div className="flex items-center gap-1.5 font-semibold">
                                      <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>Target Beneficiary: {req.beneficiaryName}</span>
                                    </div>
                                    <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                                      {req.beneficiaryRelationship || "Member"}{req.beneficiaryAge ? `, ${req.beneficiaryAge} yrs` : ""}
                                    </span>
                                  </div>
                                )}

                                {req.schemeName && (
                                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700 font-medium">
                                    Associated Scheme: <strong>{req.schemeName}</strong>
                                  </div>
                                )}

                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800">
                                  <span className="font-semibold block text-[10px] text-slate-400 uppercase">Citizen Request Message:</span>
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

                                {/* Decline reason input if active */}
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
                                          className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1"
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
                                        className="text-xs bg-teal-800 hover:bg-teal-900 text-white font-semibold"
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
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Inbox className="w-5 h-5 text-emerald-700" />
                          <span>Household Connection Requests</span>
                          <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                            {connectionRequests.length} Pending
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Citizens who entered your ASHA Service Code to link their households for doorstep healthcare guidance.
                        </p>
                      </div>

                      {userProfile?.ashaServiceCode && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
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
                      <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-8">
                        <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-800">No Pending Requests</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                          When families in your assigned area enter your Service Code <span className="font-mono font-bold text-slate-700">{userProfile?.ashaServiceCode || "ASHA-KA-XXXX"}</span>, their requests will appear here for one-click verification and enrollment.
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
                                  "{req.responseNote}"
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
                                className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
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
            {/* 4. NEEDS ATTENTION TAB */}
            {/* ============================================================ */}
            {activeTab === "attention" && (
              <div className="space-y-4">
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Proactive Healthcare Access Intelligence</p>
                    <p className="mt-0.5 text-amber-800">
                      These signals are deterministically calculated across your assigned households to highlight senior citizens eligible for PM-JAY, pregnant mothers needing maternal care (JSY), overdue home visits, and blocked tasks.
                    </p>
                  </div>
                </div>

                {isSignalsLoading ? (
                  <div className="py-12 text-center bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-amber-600 border-t-transparent mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Evaluating proactive household signals...</p>
                  </div>
                ) : attentionSignals.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-bold text-slate-800">No households currently require attention.</p>
                    <p className="text-xs text-slate-500 mt-0.5">
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
                          <span className="text-[11px] text-slate-400 font-mono">Case ID: {sig.caseId}</span>
                          <div className="flex items-center gap-2">
                            {sig.actionType === "INITIATE_SCHEME" && sig.schemeId && (
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={initiatingSchemeId === `${sig.caseId}_${sig.schemeId}`}
                                onClick={() =>
                                  handleInitiateScheme(sig.caseId, sig.schemeId!, sig.beneficiaryMemberId)
                                }
                                className="text-xs font-bold py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5"
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
            {/* 5. FOLLOW-UPS TAB (PHASE 10) */}
            {/* ============================================================ */}
            {activeTab === "followups" && (
              <div className="space-y-5">
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
                    <p className="text-2xl font-extrabold text-amber-950 mt-1">{followUpSummary?.dueToday || 0}</p>
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
                    <p className="text-2xl font-extrabold text-rose-950 mt-1">{followUpSummary?.overdue || 0}</p>
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
                    <p className="text-2xl font-extrabold text-sky-950 mt-1">{followUpSummary?.upcoming || 0}</p>
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
                    <p className="text-2xl font-extrabold text-emerald-950 mt-1">{followUpSummary?.completed || 0}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">Visits successfully done</p>
                  </div>
                </div>

                {/* Filter Pills Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { id: "ALL", label: `All Follow-ups (${followUpSummary?.total || 0})` },
                      { id: "OVERDUE", label: `Overdue (${followUpSummary?.overdue || 0})` },
                      { id: "DUE_TODAY", label: `Due Today (${followUpSummary?.dueToday || 0})` },
                      { id: "UPCOMING", label: `Upcoming (${followUpSummary?.upcoming || 0})` },
                      { id: "COMPLETED", label: `Completed (${followUpSummary?.completed || 0})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFollowUpFilter(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                          followUpFilter === tab.id
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={loadFollowUps}
                    disabled={isFollowUpsLoading}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isFollowUpsLoading ? "animate-spin" : ""}`} />
                    <span>Refresh Roster</span>
                  </button>
                </div>

                {/* Follow-up Cards List */}
                {(() => {
                  const allFollowUps = followUpSummary?.followUps || [];
                  const todayStr = new Date().toISOString().split("T")[0];

                  const filtered = allFollowUps.filter((f) => {
                    const dueDateStr = f.dueAt || f.scheduledAt;
                    const dateOnlyStr = dueDateStr ? dueDateStr.split("T")[0] : "";
                    const isToday = dateOnlyStr === todayStr;

                    if (followUpFilter === "ALL") return true;
                    if (followUpFilter === "DUE_TODAY") return f.status === "PENDING" && isToday;
                    if (followUpFilter === "OVERDUE") return f.isOverdue === true;
                    if (followUpFilter === "UPCOMING") return f.status === "PENDING" && !isToday && !f.isOverdue;
                    if (followUpFilter === "COMPLETED") return f.status === "COMPLETED";
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
                        <Clock className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
                        <h3 className="text-sm font-bold text-slate-800">No Follow-ups in this Category</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          {followUpFilter === "OVERDUE"
                            ? "Great job! There are no overdue household follow-ups."
                            : followUpFilter === "DUE_TODAY"
                            ? "No follow-up visits scheduled for today."
                            : "You can schedule follow-ups from any active case or let automated workflow triggers schedule them on task completion."}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {filtered.map((f) => {
                        const dueDateStr = f.dueAt || f.scheduledAt;
                        const dateOnlyStr = dueDateStr ? dueDateStr.split("T")[0] : "";
                        const isToday = dateOnlyStr === todayStr;

                        return (
                          <div
                            key={f.id}
                            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                              f.status === "COMPLETED"
                                ? "bg-slate-50/70 border-slate-200 opacity-90"
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

                                {f.rescheduleReason && f.status !== "COMPLETED" && (
                                  <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                                    <p className="font-semibold text-[11px]">
                                      Rescheduled: {f.rescheduleReason} ({new Date(f.rescheduledAt || "").toLocaleDateString()})
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                                {f.status !== "COMPLETED" && (
                                  <>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleOpenCompleteModal(f)}
                                      className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 cursor-pointer"
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
                  {caseDetail && caseDetail.tasks && caseDetail.tasks.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-900 text-[10px] font-bold">
                      {caseDetail.tasks.filter((t) => t.status === "COMPLETED").length}/{caseDetail.tasks.length}
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
                      {caseDetail.eligibilityResults?.filter((r) => r.status === "ELIGIBLE").length || 0}
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
                  {caseDetail && caseDetail.followUps.filter((f) => f.status === "PENDING").length > 0 && (
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
                      <div className="space-y-6">
                        {/* Scheme & Beneficiary Summary Card */}
                        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:p-5 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-100 pb-3">
                            <div>
                              <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                                Active Healthcare Scheme:
                              </span>
                              <h3 className="text-base font-bold text-teal-950">
                                {caseDetail.case.schemeName || caseDetail.case.schemeId || "Ayushman Bharat / National Health Scheme"}
                              </h3>
                            </div>
                            <span className="text-xs font-bold text-teal-900 bg-teal-100 px-3 py-1 rounded-full border border-teal-300 self-start sm:self-auto">
                              Case Status: {caseDetail.case.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="bg-white p-3 rounded-lg border border-teal-100">
                              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Target Beneficiary</span>
                              <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                                <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                                <span>{caseDetail.case.beneficiaryName || caseDetail.household.headOfHouseholdName}</span>
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-teal-100">
                              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Household Head</span>
                              <span className="font-semibold text-slate-800 mt-0.5 block">{caseDetail.household.headOfHouseholdName}</span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-teal-100">
                              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Location</span>
                              <span className="text-slate-800 mt-0.5 block">{caseDetail.household.district}, {caseDetail.household.state}</span>
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
                                const isDone = step.status === "COMPLETED";
                                const isCurrent = step.status === "CURRENT";

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
                              No predefined journey steps for this case. Custom tasks can be tracked below.
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
                                  <span className="text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full">
                                    {caseDetail.tasks.filter((t) => t.status === "COMPLETED").length} of {caseDetail.tasks.length} Completed
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Complete tasks to advance the scheme journey and achieve official benefit resolution.
                              </p>
                            </div>

                            {/* Progress bar */}
                            {caseDetail.tasks && caseDetail.tasks.length > 0 && (
                              <div className="w-full sm:w-44 space-y-1">
                                <div className="flex justify-between text-[11px] font-mono text-slate-600">
                                  <span>Progress</span>
                                  <span>
                                    {Math.round(
                                      (caseDetail.tasks.filter((t) => t.status === "COMPLETED").length /
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
                                      width: `${(caseDetail.tasks.filter((t) => t.status === "COMPLETED").length /
                                        caseDetail.tasks.length) *
                                        100}%`,
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
                                          onClick={() => !isDone && handleCompleteTask(task.id)}
                                          disabled={isDone}
                                          className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                            isDone
                                              ? "bg-emerald-600 border-emerald-600 text-white cursor-default"
                                              : "border-slate-300 hover:border-emerald-600 hover:bg-emerald-50 text-transparent hover:text-emerald-700 cursor-pointer"
                                          }`}
                                          title={isDone ? "Task Completed" : "Click to mark done"}
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
                                                onClick={() => handleUpdateTaskStatus(task.id, "IN_PROGRESS")}
                                                className="text-[11px] py-1 px-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                                              >
                                                Start
                                              </Button>
                                            )}
                                            {!isBlocked && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleUpdateTaskStatus(task.id, "BLOCKED")}
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
                          <form onSubmit={handleCreateTask} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
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

                    {/* TAB 1: HOUSEHOLD OVERVIEW */}
                    {detailTab === "overview" && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">Ration Category</span>
                            <span className="font-bold text-slate-900">{caseDetail.household.incomeCategory}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">Ration Card No.</span>
                            <span className="font-mono text-slate-800">{caseDetail.household.rationCardNumber || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">Location</span>
                            <span className="text-slate-900">{caseDetail.household.district}, {caseDetail.household.state}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">Contact Phone</span>
                            <span className="text-slate-900">{caseDetail.household.contactPhone || "Not Provided"}</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-900 mb-2.5">
                            Family Members ({caseDetail.members.length})
                          </h4>
                          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                            {caseDetail.members.map((m) => (
                              <div key={m.id} className="p-3 bg-white flex items-center justify-between">
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
                            <span>No access gaps detected for this household. All basic entitlements match profile.</span>
                          </div>
                        ) : (
                          caseDetail.guidance.gaps.map((g) => (
                            <div
                              key={g.id}
                              className={`p-4 rounded-xl border space-y-2 text-xs ${
                                g.priority === "REQUIRED"
                                  ? "bg-red-50/60 border-red-200 text-red-950"
                                  : g.priority === "IMPORTANT"
                                  ? "bg-amber-50/60 border-amber-200 text-amber-950"
                                  : "bg-slate-50 border-slate-200 text-slate-800"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 bg-white rounded border border-slate-200">
                                  {g.type.replace(/_/g, " ")}
                                </span>
                                <span className="font-bold text-[10px]">{g.priority}</span>
                              </div>
                              <p className="font-bold text-sm text-slate-900">{g.title || g.description}</p>
                              <p className="text-slate-600">{g.description}</p>
                              {g.reason && (
                                <p className="text-[11px] text-teal-800 font-medium">Why: {g.reason}</p>
                              )}
                              {g.schemeId &&
                                (g.schemeId === "ab-pmjay" || g.schemeId === "jsy") && (
                                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                                    {g.schemeId === caseDetail.case.schemeId &&
                                    ["RESOLVED", "CLOSED"].includes(caseDetail.case.status) ? (
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
                                          className="text-xs font-semibold"
                                        >
                                          View Completed Journey
                                        </Button>
                                      </>
                                    ) : g.schemeId === caseDetail.case.schemeId &&
                                      !["RESOLVED", "CLOSED", "CITIZEN_DECLINED"].includes(
                                        caseDetail.case.status
                                      ) ? (
                                      <>
                                        <span className="text-[11px] font-bold text-blue-800">
                                          ● Doorstep Assistance In Progress
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDetailTab("journey");
                                          }}
                                          className="text-xs font-semibold"
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
                                          disabled={initiatingSchemeId === `${caseDetail.case.id}_${g.schemeId}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleInitiateScheme(caseDetail.case.id, g.schemeId);
                                          }}
                                          className="text-xs font-bold py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1"
                                        >
                                          <Send className="w-3 h-3" />
                                          <span>
                                            {initiatingSchemeId === `${caseDetail.case.id}_${g.schemeId}`
                                              ? "Starting..."
                                              : "Start Assistance"}
                                          </span>
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* TAB 3: ELIGIBLE SCHEMES */}
                    {detailTab === "schemes" && (
                      <div className="space-y-3">
                        {caseDetail.eligibilityResults?.map((r) => {
                          const isSameScheme = caseDetail.case.schemeId === r.schemeId;
                          const isJourneyActive =
                            isSameScheme &&
                            !["RESOLVED", "CLOSED", "CITIZEN_DECLINED"].includes(
                              caseDetail.case.status
                            );
                          const isJourneyCompleted =
                            isSameScheme && ["RESOLVED", "CLOSED"].includes(caseDetail.case.status);

                          return (
                            <div
                              key={r.schemeId}
                              className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                                r.status === "ELIGIBLE"
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
                                    r.status === "ELIGIBLE"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : r.status === "NEEDS_INFORMATION"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </div>
                              <p className="text-slate-600">{r.benefitSummary}</p>
                              {r.matchedRules && r.matchedRules.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 text-[11px] text-emerald-900">
                                  <strong>Matched Rules:</strong> {r.matchedRules.map((m: any) => m.explanation).join(". ")}
                                </div>
                              )}

                              {(r.status === "ELIGIBLE" ||
                                (r.schemeId === "jsy" &&
                                  caseDetail.members.some((m) => m.maternalStatus === "pregnant"))) && (
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
                                        className="text-xs font-semibold"
                                      >
                                        View Completed Journey
                                      </Button>
                                    </>
                                  ) : isJourneyActive ? (
                                    <>
                                      <span className="text-[11px] text-blue-800 font-bold">
                                        ● Active Doorstep Assistance Journey in Progress
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDetailTab("journey");
                                        }}
                                        className="text-xs font-semibold"
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
                                        disabled={initiatingSchemeId === `${caseDetail.case.id}_${r.schemeId}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleInitiateScheme(caseDetail.case.id, r.schemeId);
                                        }}
                                        className="text-xs font-bold py-1 px-3 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>
                                          {initiatingSchemeId === `${caseDetail.case.id}_${r.schemeId}`
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
                                            : f.isOverdue
                                            ? "bg-rose-100 text-rose-800"
                                            : "bg-sky-100 text-sky-800"
                                        }`}
                                      >
                                        {f.status === "COMPLETED" ? "COMPLETED" : f.isOverdue ? "OVERDUE" : "PENDING"}
                                      </span>
                                    </div>
                                    {f.title && f.title !== f.reason && (
                                      <p className="text-slate-600 text-[11px] mt-0.5">{f.reason}</p>
                                    )}
                                    <p className="text-slate-500 text-[11px] mt-0.5">
                                      Due: {new Date(f.dueAt || f.scheduledAt).toLocaleDateString()}
                                    </p>
                                  </div>

                                  {f.status !== "COMPLETED" && (
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
                                    </div>
                                  )}
                                </div>

                                {f.outcome && (
                                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                                    <strong>Outcome:</strong> {f.outcome}
                                    {f.notes && <span className="block text-slate-600 mt-0.5">{f.notes}</span>}
                                  </div>
                                )}

                                {f.rescheduleReason && f.status !== "COMPLETED" && (
                                  <div className="p-1.5 rounded bg-amber-50 text-amber-800 text-[10px]">
                                    Rescheduled: {f.rescheduleReason}
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
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
