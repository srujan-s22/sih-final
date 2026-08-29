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
} from "lucide-react";
import { caseService } from "@/services/case-service";
import { connectionService } from "@/services/connection-service";
import { assistanceService } from "@/services/assistance-service";
import {
  AshaCase,
  CaseDetailResponse,
  CaseSummaryResponse,
  CaseStatus,
  CasePriority,
  FieldRegistrationInput,
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

  // Caseload Data
  const [cases, setCases] = useState<AshaCase[]>([]);
  const [summary, setSummary] = useState<CaseSummaryResponse | null>(null);

  // Connection Requests Data
  const [connectionRequests, setConnectionRequests] = useState<AshaConnectionRequest[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [copiedServiceCode, setCopiedServiceCode] = useState(false);

  // Citizen Assistance Requests Data
  const [assistanceRequests, setAssistanceRequests] = useState<AshaAssistanceRequest[]>([]);
  const [requestsSubTab, setRequestsSubTab] = useState<"assistance" | "connections">("assistance");
  const [assistanceResponseNotes, setAssistanceResponseNotes] = useState<Record<string, string>>({});
  const [isUpdatingAssistance, setIsUpdatingAssistance] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Case Detail Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "gaps" | "schemes" | "notes" | "followups" | "history">("overview");

  // New Note / Follow-up inputs
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [isFollowUpSubmitting, setIsFollowUpSubmitting] = useState(false);

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
    loadPendingRequests();
    loadAssistanceRequests();
  }, [loadCaseload, loadPendingRequests, loadAssistanceRequests]);

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
        await loadCaseload();
      }
    } catch {
      // Error handled quietly
    } finally {
      setIsFollowUpSubmitting(false);
    }
  };

  // Complete Follow-Up
  const handleCompleteFollowUp = async (followUpId: string) => {
    if (!selectedCaseId) return;
    try {
      const res = await caseService.updateFollowUp(selectedCaseId, followUpId, {
        status: "COMPLETED",
      });
      if (res.success) {
        const freshDetail = await caseService.getCaseDetail(selectedCaseId);
        if (freshDetail.success && freshDetail.data) {
          setCaseDetail(freshDetail.data);
        }
        await loadCaseload();
      }
    } catch {
      // Error handled quietly
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

  const navTabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "cases", label: "Caseload", icon: Users },
    { id: "requests", label: `Requests (${totalRequestsBadge})`, icon: Inbox },
    { id: "attention", label: "Needs Attention", icon: AlertCircle },
    { id: "followups", label: "Follow-ups", icon: Clock },
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
                        <span>High-Priority Cases</span>
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("attention")}
                        className="text-xs font-semibold text-amber-800 border-amber-200 hover:bg-amber-50"
                      >
                        View All
                      </Button>
                    </div>

                    {needsAttentionCases.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                        <span>No cases currently flagged with high-severity access gaps.</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {needsAttentionCases.slice(0, 3).map((c) => (
                          <div
                            key={c.id}
                            onClick={() => openCaseDetail(c.id)}
                            className="p-3 bg-slate-50 hover:bg-amber-50/50 rounded-lg border border-slate-200/80 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-slate-900">{c.headOfHouseholdName}</h4>
                                <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                                  {c.priority}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {c.district} • {c.detectedGapsCount} Gap(s) Identified
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
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
                          return (
                            <div
                              key={req.id}
                              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between"
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
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
                                        : req.status === "IN_PROGRESS"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {req.status}
                                  </span>
                                </div>

                                {req.schemeName && (
                                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700 font-medium">
                                    Associated Scheme: <strong>{req.schemeName}</strong>
                                  </div>
                                )}

                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800">
                                  <span className="font-semibold block text-[10px] text-slate-400 uppercase">Citizen Message:</span>
                                  <p className="mt-0.5 leading-relaxed">&ldquo;{req.message}&rdquo;</p>
                                </div>

                                {req.responseNote && (
                                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                                    <span className="font-semibold block text-[10px] uppercase">Your Response Note:</span>
                                    <p className="mt-0.5">{req.responseNote}</p>
                                  </div>
                                )}

                                {!isResolved && (
                                  <div className="space-y-1.5 pt-1">
                                    <label className="text-[11px] font-semibold text-slate-600 block">
                                      Add ASHA Update / Note:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Visited family. Document submitted to PHC."
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

                              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openCaseDetailByHousehold(req.householdId)}
                                  className="text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50"
                                >
                                  Open Case
                                </Button>

                                {!isResolved ? (
                                  <div className="flex items-center gap-2">
                                    {req.status === "PENDING" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isUpdatingAssistance === req.id}
                                        onClick={() => handleUpdateAssistance(req.id, "IN_PROGRESS")}
                                        className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
                                      >
                                        Mark In Progress
                                      </Button>
                                    )}
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      disabled={isUpdatingAssistance === req.id}
                                      onClick={() => handleUpdateAssistance(req.id, "RESOLVED")}
                                      className="text-xs bg-teal-800 hover:bg-teal-900 text-white font-semibold"
                                    >
                                      Resolve Request
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
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
                    <p className="font-bold">Healthcare Access Gap Prioritization</p>
                    <p className="mt-0.5 text-amber-800">
                      These households have deterministically identified healthcare access gaps (e.g. missing maternal coverage, elder health support, or unverified documents).
                    </p>
                  </div>
                </div>

                {needsAttentionCases.length === 0 ? (
                  <div className="py-12 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-bold text-slate-800">No Families Currently Require Escalation</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      All assigned households have addressed current healthcare access gaps.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {needsAttentionCases.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => openCaseDetail(c.id)}
                        className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-amber-400 cursor-pointer transition-colors space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{c.headOfHouseholdName}</h4>
                            <p className="text-xs text-slate-400 font-mono">{c.district}, {c.state}</p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              c.priority === "URGENT" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {c.priority}
                          </span>
                        </div>
                        <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-100 text-xs text-amber-900">
                          <strong>{c.detectedGapsCount} Access Gap{c.detectedGapsCount === 1 ? "" : "s"}</strong> requiring field assistance
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-400">Status: {c.status}</span>
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            Inspect Case <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* 5. FOLLOW-UPS TAB */}
            {/* ============================================================ */}
            {activeTab === "followups" && (
              <div className="space-y-4">
                {upcomingFollowUpCases.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-800">No Scheduled Follow-ups</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                      You can schedule reminder tasks, document verifications, and family check-ins directly inside any case.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100">
                    {upcomingFollowUpCases.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => openCaseDetail(c.id)}
                        className="p-4 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-xs font-bold text-blue-900">
                              {c.nextFollowUpAt ? new Date(c.nextFollowUpAt).toLocaleDateString() : "Scheduled"}
                            </span>
                            <span className="text-sm font-bold text-slate-900 ml-2">{c.headOfHouseholdName}</span>
                          </div>
                          <p className="text-xs text-slate-500 pl-6">
                            Location: {c.district}, {c.state} • Status: {c.status}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="text-xs font-semibold">
                          View Case <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
                  onClick={() => setDetailTab("overview")}
                  className={`py-3 px-3 border-b-2 transition-colors ${
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
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* TAB 3: ELIGIBLE SCHEMES */}
                    {detailTab === "schemes" && (
                      <div className="space-y-3">
                        {caseDetail.eligibilityResults?.map((r) => (
                          <div
                            key={r.schemeId}
                            className={`p-4 rounded-xl border space-y-2 text-xs ${
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
                          </div>
                        ))}
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

                        <div className="space-y-2 pt-2">
                          {caseDetail.followUps.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">No scheduled follow-ups.</p>
                          ) : (
                            caseDetail.followUps.map((f) => (
                              <div
                                key={f.id}
                                className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900">{f.reason}</span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                        f.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                                      }`}
                                    >
                                      {f.status}
                                    </span>
                                  </div>
                                  <p className="text-slate-500 text-[11px] mt-0.5">Due: {new Date(f.scheduledAt).toLocaleDateString()}</p>
                                </div>
                                {f.status !== "COMPLETED" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCompleteFollowUp(f.id)}
                                    className="text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                  >
                                    Mark Done
                                  </Button>
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
