"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
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
} from "lucide-react";
import { caseService } from "@/services/case-service";
import {
  AshaCase,
  CaseDetailResponse,
  CaseSummaryResponse,
  CaseStatus,
  CasePriority,
  FieldRegistrationInput,
} from "@shared/types/case";
import { IncomeCategory } from "@shared/types/household";
import { HealthcareAssistantDrawer } from "@/components/assistant/healthcare-assistant-drawer";

export default function AshaWorkspacePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Caseload Data
  const [cases, setCases] = useState<AshaCase[]>([]);
  const [summary, setSummary] = useState<CaseSummaryResponse | null>(null);

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

  useEffect(() => {
    loadCaseload();
  }, [loadCaseload]);

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

  const navTabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "cases", label: "Caseload", icon: Users },
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Cases</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{summary?.totalAssigned ?? 0}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Persisted households</p>
                  </div>
                  <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-2xs bg-amber-50/20">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Needs Attention</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">{summary?.needsAttentionCount ?? 0}</p>
                    <p className="text-xs text-amber-600 mt-0.5">Identified healthcare gaps</p>
                  </div>
                  <div className="bg-white rounded-xl border border-blue-200/80 p-4 shadow-2xs bg-blue-50/20">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Upcoming Follow-ups</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">{summary?.upcomingFollowUpsCount ?? 0}</p>
                    <p className="text-xs text-blue-600 mt-0.5">Scheduled visits/tasks</p>
                  </div>
                  <div className="bg-white rounded-xl border border-emerald-200/80 p-4 shadow-2xs bg-emerald-50/20">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Resolved / Closed</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">{summary?.resolvedCount ?? 0}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Completed enrollments</p>
                  </div>
                </div>

                {/* Urgent Queue / Action Needed Section */}
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-bold text-slate-900">Priority Cases Requiring Field Attention</h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {needsAttentionCases.length} case{needsAttentionCases.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {needsAttentionCases.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      <p className="text-sm font-semibold text-slate-700">No Urgent Cases</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                        All assigned households are in normal status with no critical healthcare gap escalations.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {needsAttentionCases.slice(0, 5).map((c) => (
                        <div
                          key={c.id}
                          onClick={() => openCaseDetail(c.id)}
                          className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-lg cursor-pointer transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">{c.headOfHouseholdName}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  c.priority === "URGENT"
                                    ? "bg-red-100 text-red-800"
                                    : c.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {c.priority}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {c.district}, {c.state}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {c.detectedGapsCount} gap{c.detectedGapsCount === 1 ? "" : "s"} identified • {c.memberCount} family member{c.memberCount === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" className="text-xs font-semibold">
                              Inspect Case <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 2. CASELOAD TAB */}
            {/* ============================================================ */}
            {activeTab === "cases" && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by family name, district, or case ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
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
                      className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Case Roster Table / List */}
                {filteredCases.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs p-8">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-800">No Households Assigned Yet</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                      Your field-registered or supervisor-assigned cases will appear here. You can register a family directly during field visits.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsRegisterModalOpen(true)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Register First Household
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                            <th className="py-3 px-4">Head of Household</th>
                            <th className="py-3 px-4">Location</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Priority</th>
                            <th className="py-3 px-4">Access Gaps</th>
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
            {/* 3. NEEDS ATTENTION TAB */}
            {/* ============================================================ */}
            {activeTab === "attention" && (
              <div className="space-y-4">
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Healthcare Gap Prioritization</p>
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
            {/* 4. FOLLOW-UPS TAB */}
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
                      {caseDetail.eligibilityResults.filter((r) => r.status === "ELIGIBLE").length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDetailTab("notes")}
                  className={`py-3 px-3 border-b-2 transition-colors ${
                    detailTab === "notes"
                      ? "border-emerald-600 text-emerald-800 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Case Notes ({caseDetail?.notes.length || 0})
                </button>
                <button
                  onClick={() => setDetailTab("followups")}
                  className={`py-3 px-3 border-b-2 transition-colors ${
                    detailTab === "followups"
                      ? "border-emerald-600 text-emerald-800 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Follow-ups ({caseDetail?.followUps.length || 0})
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

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isDetailLoading || !caseDetail ? (
                  <div className="py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent mb-2" />
                    <p className="text-xs text-slate-500">Loading case information...</p>
                  </div>
                ) : (
                  <>
                    {/* TAB: OVERVIEW */}
                    {detailTab === "overview" && (
                      <div className="space-y-5">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Household Profile</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400">Head:</span>
                              <p className="font-semibold text-slate-800">{caseDetail.household.headOfHouseholdName}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Income Category:</span>
                              <p className="font-semibold text-slate-800">{caseDetail.household.incomeCategory}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Ration Card:</span>
                              <p className="font-semibold text-slate-800">{caseDetail.household.rationCardNumber || "Not recorded"}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Village / Town:</span>
                              <p className="font-semibold text-slate-800">{caseDetail.household.village || "Rural Area"}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">District:</span>
                              <p className="font-semibold text-slate-800">{caseDetail.household.district}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Pincode:</span>
                              <p className="font-semibold text-slate-800">{caseDetail.household.pincode}</p>
                            </div>
                          </div>
                        </div>

                        {/* Family Members */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Family Members ({caseDetail.members.length})
                          </h4>
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                            {caseDetail.members.map((m) => (
                              <div key={m.id} className="p-3 text-xs flex items-center justify-between">
                                <div>
                                  <span className="font-bold text-slate-900">{m.fullName}</span>
                                  <p className="text-[11px] text-slate-500">
                                    {m.age} yrs • {m.gender} • Relationship: {m.relationship}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {m.maternalStatus && m.maternalStatus !== "none" && (
                                    <span className="px-2 py-0.5 bg-pink-100 text-pink-800 font-bold rounded text-[10px]">
                                      {m.maternalStatus}
                                    </span>
                                  )}
                                  {m.disabilityStatus && (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-[10px]">
                                      PWD
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB: HEALTHCARE GAPS */}
                    {detailTab === "gaps" && (
                      <div className="space-y-4">
                        <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-xs text-amber-900">
                          <strong>Deterministic Healthcare Gap Analysis</strong>: Results generated from verified household composition rules.
                        </div>

                        {caseDetail.guidance.gaps.length === 0 ? (
                          <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1 opacity-80" />
                            <p className="text-xs font-bold text-slate-800">No Identified Access Gaps</p>
                            <p className="text-[11px] text-slate-500">This household is covered under applicable programs.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {caseDetail.guidance.gaps.map((gap, i) => (
                              <div key={i} className="p-4 bg-white border border-amber-200 rounded-xl shadow-2xs space-y-2">
                                <div className="flex items-start justify-between">
                                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm">{gap.title}</h5>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      gap.priority === "REQUIRED"
                                        ? "bg-red-100 text-red-800"
                                        : gap.priority === "IMPORTANT"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {gap.priority}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600">{gap.description}</p>
                                <div className="text-[11px] font-medium text-amber-800 bg-amber-50/60 p-2 rounded">
                                  <strong>Reason / Context:</strong> {gap.reason}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: ELIGIBLE SCHEMES */}
                    {detailTab === "schemes" && (
                      <div className="space-y-3">
                        {caseDetail.eligibilityResults.map((res) => (
                          <div
                            key={res.schemeId}
                            className={`p-4 rounded-xl border ${
                              res.status === "ELIGIBLE"
                                ? "bg-emerald-50/20 border-emerald-200"
                                : "bg-slate-50/60 border-slate-200"
                            } space-y-2`}
                          >
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-slate-900 text-xs sm:text-sm">{res.schemeName}</h5>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  res.status === "ELIGIBLE"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {res.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">{res.benefitSummary}</p>
                            {res.status === "ELIGIBLE" && (
                              <div className="text-[11px] text-emerald-800 flex items-center gap-1 font-semibold">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Verified Government Guideline Met</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TAB: CASE NOTES */}
                    {detailTab === "notes" && (
                      <div className="space-y-5">
                        {/* Note Input */}
                        <form onSubmit={handleAddNote} className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">Add Field Observation / Note</label>
                          <textarea
                            rows={3}
                            value={newNoteContent}
                            onChange={(e) => setNewNoteContent(e.target.value)}
                            placeholder="Enter notes regarding family visit, scheme application, or document verification..."
                            className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={isNoteSubmitting || !newNoteContent.trim()}
                              className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                            >
                              <Send className="w-3 h-3 mr-1" /> Save Note
                            </Button>
                          </div>
                        </form>

                        {/* Notes History */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Note History</h4>
                          {caseDetail.notes.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No notes recorded yet for this case.</p>
                          ) : (
                            <div className="space-y-2.5">
                              {caseDetail.notes.map((n) => (
                                <div key={n.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span className="font-semibold text-slate-700">{n.authorName}</span>
                                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                                  </div>
                                  <p className="text-slate-800 whitespace-pre-wrap">{n.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB: FOLLOW-UPS */}
                    {detailTab === "followups" && (
                      <div className="space-y-5">
                        {/* Schedule Form */}
                        <form onSubmit={handleScheduleFollowUp} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                          <h4 className="text-xs font-bold text-slate-800">Schedule New Follow-up</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="text-slate-600 font-semibold mb-1 block">Scheduled Date</label>
                              <input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-slate-600 font-semibold mb-1 block">Reason / Task</label>
                              <input
                                type="text"
                                value={followUpReason}
                                onChange={(e) => setFollowUpReason(e.target.value)}
                                placeholder="e.g. Verify Ayushman card enrollment"
                                className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={isFollowUpSubmitting || !followUpDate || !followUpReason.trim()}
                              className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                            >
                              <Calendar className="w-3 h-3 mr-1" /> Schedule Task
                            </Button>
                          </div>
                        </form>

                        {/* Follow-up List */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Scheduled Tasks</h4>
                          {caseDetail.followUps.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No follow-ups recorded.</p>
                          ) : (
                            <div className="space-y-2">
                              {caseDetail.followUps.map((fu) => (
                                <div
                                  key={fu.id}
                                  className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                                    fu.status === "COMPLETED"
                                      ? "bg-slate-50 border-slate-200 opacity-60"
                                      : "bg-white border-blue-200 shadow-2xs"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">{fu.reason}</span>
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                          fu.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                                        }`}
                                      >
                                        {fu.status}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      Due: {new Date(fu.scheduledAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {fu.status === "PENDING" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCompleteFollowUp(fu.id)}
                                      className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Mark Done
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB: AUDIT HISTORY */}
                    {detailTab === "history" && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Immutable Case Activity Log</h4>
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden text-xs">
                          {caseDetail.activities.map((act) => (
                            <div key={act.id} className="p-3 flex items-start justify-between">
                              <div>
                                <span className="font-bold text-slate-800">{act.type.replace("_", " ")}</span>
                                <p className="text-[11px] text-slate-500">{act.description}</p>
                                <p className="text-[10px] text-slate-400">Actor: {act.actorName} ({act.actorRole})</p>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {new Date(act.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* FIELD REGISTRATION MODAL */}
        {/* ============================================================ */}
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assisted Household Field Registration</h3>
                  <p className="text-xs text-slate-500">Register a family directly into your ASHA jurisdiction.</p>
                </div>
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4 text-xs">
                {registerError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 font-medium">
                    {registerError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Head of Household Full Name *</label>
                  <input
                    type="text"
                    required
                    value={registerForm.headOfHouseholdName}
                    onChange={(e) => setRegisterForm({ ...registerForm, headOfHouseholdName: e.target.value })}
                    placeholder="e.g. Ramesh Gowda"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Head Age *</label>
                    <input
                      type="number"
                      required
                      min={18}
                      max={120}
                      value={registerForm.headAge || 35}
                      onChange={(e) => setRegisterForm({ ...registerForm, headAge: Number(e.target.value) })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Head Gender *</label>
                    <select
                      value={registerForm.headGender || "female"}
                      onChange={(e) => setRegisterForm({ ...registerForm, headGender: e.target.value as any })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Income Category *</label>
                    <select
                      value={registerForm.incomeCategory}
                      onChange={(e) => setRegisterForm({ ...registerForm, incomeCategory: e.target.value as IncomeCategory })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="BPL">BPL (Below Poverty Line)</option>
                      <option value="AAY">Antyodaya (AAY)</option>
                      <option value="APL">APL (Above Poverty Line)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Ration Card Number</label>
                    <input
                      type="text"
                      value={registerForm.rationCardNumber || ""}
                      onChange={(e) => setRegisterForm({ ...registerForm, rationCardNumber: e.target.value })}
                      placeholder="e.g. RC-KA-9901"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">District *</label>
                    <input
                      type="text"
                      required
                      value={registerForm.district}
                      onChange={(e) => setRegisterForm({ ...registerForm, district: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Village / Locality</label>
                    <input
                      type="text"
                      value={registerForm.village || ""}
                      onChange={(e) => setRegisterForm({ ...registerForm, village: e.target.value })}
                      placeholder="e.g. Hosahalli"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRegisterModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={registerSubmitting}
                    className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    {registerSubmitting ? "Registering..." : "Complete Registration"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Phase 8 Assistant Drawer (Pre-scoped to current case if selected) */}
        <HealthcareAssistantDrawer
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          userRole="ASHA"
          caseId={selectedCaseId || undefined}
        />
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
