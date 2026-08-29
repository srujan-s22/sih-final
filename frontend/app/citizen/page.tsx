"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Household,
  Member,
  CreateHouseholdInput,
  IncomeCategory,
  Gender,
  CreateMemberInput,
} from "@shared/types/household";
import { EligibilityResult } from "@shared/types/eligibility";
import { GuidanceResponse } from "@shared/types/guidance";
import { householdService } from "@/services/household-service";
import { eligibilityService } from "@/services/eligibility-service";
import { guidanceService } from "@/services/guidance-service";
import { connectionService } from "@/services/connection-service";
import { assistanceService } from "@/services/assistance-service";
import {
  AshaPublicDirectoryInfo,
  CitizenConnectionStatusResponse,
} from "@shared/types/connection";
import {
  AshaAssistanceRequest,
  AssistanceCategory,
} from "@shared/types/assistance";
import {
  Users,
  ShieldCheck,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  CreditCard,
  Phone,
  User,
  HeartPulse,
  ChevronDown,
  ChevronUp,
  FileCheck,
  ArrowRight,
  Info,
  Layers,
  Sparkles,
  Bot,
  QrCode,
  Link2,
  UserCheck,
  Clock3,
  Send,
  MessageSquare,
  HelpCircle,
  Calendar,
} from "lucide-react";
import { HealthcareAssistantDrawer } from "@/components/assistant/healthcare-assistant-drawer";

const INCOME_OPTIONS: Array<{ value: IncomeCategory; label: string }> = [
  { value: "BPL", label: "Below Poverty Line (BPL)" },
  { value: "AAY", label: "Antyodaya Anna Yojana (AAY)" },
  { value: "APL", label: "Above Poverty Line (APL)" },
  { value: "OTHER", label: "Other" },
];

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const RELATIONSHIP_OPTIONS = [
  { value: "Head", label: "Head of Household" },
  { value: "Spouse", label: "Spouse" },
  { value: "Son", label: "Son" },
  { value: "Daughter", label: "Daughter" },
  { value: "Father", label: "Father" },
  { value: "Mother", label: "Mother" },
  { value: "Brother", label: "Brother" },
  { value: "Sister", label: "Sister" },
  { value: "Other", label: "Other" },
];

const ASSISTANCE_CATEGORIES: Array<{ value: AssistanceCategory; label: string }> = [
  { value: "SCHEME_ENROLLMENT", label: "Scheme Enrollment & Card Generation" },
  { value: "DOCUMENT_HELP", label: "Document Collection & Verification Help" },
  { value: "FACILITY_ACCESS", label: "Healthcare Facility / Hospital Access" },
  { value: "ELIGIBILITY_CLARIFICATION", label: "Eligibility Criteria Clarification" },
  { value: "FOLLOW_UP", label: "Field Visit / Doorstep Follow-up" },
  { value: "OTHER", label: "Other General Healthcare Query" },
];

export default function CitizenPage() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Data states
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [eligibilityResults, setEligibilityResults] = useState<EligibilityResult[]>([]);
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Household Modal / Form State
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [householdForm, setHouseholdForm] = useState<CreateHouseholdInput>({
    headOfHouseholdName: "",
    rationCardNumber: "",
    incomeCategory: "BPL",
    state: "",
    district: "",
    village: "",
    pincode: "",
    contactPhone: "",
  });
  const [householdSubmitting, setHouseholdSubmitting] = useState(false);
  const [householdFormError, setHouseholdFormError] = useState<string | null>(null);

  // ASHA Connection State
  const [connectionStatus, setConnectionStatus] = useState<CitizenConnectionStatusResponse | null>(null);
  const [serviceCodeInput, setServiceCodeInput] = useState("");
  const [resolvedAsha, setResolvedAsha] = useState<AshaPublicDirectoryInfo | null>(null);
  const [isResolvingAsha, setIsResolvingAsha] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

  // ASHA Assistance Requests State
  const [assistanceRequests, setAssistanceRequests] = useState<AshaAssistanceRequest[]>([]);
  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false);
  const [assistanceForm, setAssistanceForm] = useState<{
    category: AssistanceCategory;
    schemeId: string;
    schemeName: string;
    message: string;
  }>({
    category: "SCHEME_ENROLLMENT",
    schemeId: "",
    schemeName: "",
    message: "",
  });
  const [assistanceSubmitting, setAssistanceSubmitting] = useState(false);
  const [assistanceError, setAssistanceError] = useState<string | null>(null);

  // Member Modal State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<CreateMemberInput>({
    fullName: "",
    age: 18,
    gender: "female",
    relationship: "Spouse",
    disabilityStatus: false,
    maternalStatus: "none",
    chronicConditions: [],
  });
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);

  // Remove Member State
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  // Expanded Accordion State
  const [expandedSchemeId, setExpandedSchemeId] = useState<string | null>(null);

  // Phase 8 Assistant Integration
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Load Eligibility Evaluation & Guidance Plan
  const loadEligibility = useCallback(async () => {
    setIsEvaluating(true);
    try {
      const [eligRes, guideRes] = await Promise.all([
        eligibilityService.evaluateMyHousehold(),
        guidanceService.getMyGuidance(),
      ]);

      if (eligRes.success && eligRes.data) {
        setEligibilityResults(eligRes.data.results || []);
      }
      if (guideRes.success && guideRes.data) {
        setGuidance(guideRes.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsEvaluating(false);
    }
  }, []);

  // Load Household Data
  const loadHouseholdData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await householdService.getHousehold();
      if (res.success) {
        if (res.data) {
          setHousehold(res.data.household);
          setMembers(res.data.members || []);
          setHouseholdForm({
            headOfHouseholdName: res.data.household.headOfHouseholdName,
            rationCardNumber: res.data.household.rationCardNumber,
            incomeCategory: res.data.household.incomeCategory,
            state: res.data.household.state,
            district: res.data.household.district,
            village: res.data.household.village,
            pincode: res.data.household.pincode,
            contactPhone: res.data.household.contactPhone || "",
          });

          await loadEligibility();
        } else {
          setHousehold(null);
          setMembers([]);
          setEligibilityResults([]);
          setGuidance(null);
        }
      } else {
        setError(res.error.message);
      }
    } catch {
      setError("We couldn't load your household details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [loadEligibility]);

  // Load ASHA Connection Status
  const loadConnectionStatus = useCallback(async () => {
    try {
      const res = await connectionService.getCitizenConnectionStatus();
      if (res.success && res.data) {
        setConnectionStatus(res.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // Load Assistance Requests
  const loadAssistanceRequests = useCallback(async () => {
    try {
      const res = await assistanceService.listMyAssistanceRequests();
      if (res.success && res.data) {
        setAssistanceRequests(res.data.requests);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    loadHouseholdData();
    loadConnectionStatus();
    loadAssistanceRequests();
  }, [loadHouseholdData, loadConnectionStatus, loadAssistanceRequests]);

  // Handle Household Form Submit
  const handleHouseholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHouseholdFormError(null);
    setHouseholdSubmitting(true);

    try {
      if (household) {
        const res = await householdService.updateHousehold(householdForm);
        if (res.success) {
          setHousehold(res.data.household);
          setIsHouseholdModalOpen(false);
          setSuccessMessage("Household details updated successfully.");
          await loadEligibility();
        } else {
          setHouseholdFormError(res.error.message);
        }
      } else {
        const res = await householdService.createHousehold(householdForm);
        if (res.success) {
          setHousehold(res.data.household);
          setIsHouseholdModalOpen(false);
          setSuccessMessage("Household profile created successfully.");
          await loadEligibility();
        } else {
          setHouseholdFormError(res.error.message);
        }
      }
    } catch {
      setHouseholdFormError("Failed to save household details. Please try again.");
    } finally {
      setHouseholdSubmitting(false);
    }
  };

  // Open Member Modal for Add
  const handleOpenAddMember = () => {
    setEditingMemberId(null);
    setMemberForm({
      fullName: "",
      age: 25,
      gender: "female",
      relationship: "Spouse",
      disabilityStatus: false,
      maternalStatus: "none",
      chronicConditions: [],
    });
    setMemberFormError(null);
    setIsMemberModalOpen(true);
  };

  // Open Member Modal for Edit
  const handleOpenEditMember = (m: Member) => {
    setEditingMemberId(m.id);
    setMemberForm({
      fullName: m.fullName,
      age: m.age,
      gender: m.gender,
      relationship: m.relationship,
      disabilityStatus: m.disabilityStatus,
      maternalStatus: m.maternalStatus || "none",
      chronicConditions: m.chronicConditions || [],
    });
    setMemberFormError(null);
    setIsMemberModalOpen(true);
  };

  // Handle Member Submit
  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberFormError(null);
    setMemberSubmitting(true);

    try {
      if (editingMemberId) {
        const res = await householdService.updateMember(editingMemberId, memberForm);
        if (res.success) {
          setMembers((prev) =>
            prev.map((item) => (item.id === editingMemberId ? res.data.member : item))
          );
          setIsMemberModalOpen(false);
          setSuccessMessage("Family member details updated.");
          await loadEligibility();
        } else {
          setMemberFormError(res.error.message);
        }
      } else {
        const res = await householdService.addMember(memberForm);
        if (res.success) {
          setMembers((prev) => [...prev, res.data.member]);
          setIsMemberModalOpen(false);
          setSuccessMessage("Family member added successfully.");
          await loadEligibility();
        } else {
          setMemberFormError(res.error.message);
        }
      }
    } catch {
      setMemberFormError("Failed to save family member. Please check fields.");
    } finally {
      setMemberSubmitting(false);
    }
  };

  // Handle Remove Member
  const handleConfirmRemoveMember = async () => {
    if (!removingMember) return;
    setRemoveSubmitting(true);
    try {
      const res = await householdService.deleteMember(removingMember.id);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== removingMember.id));
        setRemovingMember(null);
        setSuccessMessage("Family member removed.");
        await loadEligibility();
      } else {
        setError(res.error.message);
      }
    } catch {
      setError("Failed to delete member.");
    } finally {
      setRemoveSubmitting(false);
    }
  };

  // Handle ASHA Lookup by Service Code
  const handleLookupAsha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceCodeInput.trim()) return;
    setConnectionError(null);
    setIsResolvingAsha(true);

    try {
      const res = await connectionService.resolveAshaServiceCode(serviceCodeInput);
      if (res.success) {
        setResolvedAsha(res.data);
        setIsConnectionModalOpen(true);
      } else {
        setConnectionError(res.error.message || "ASHA worker not found. Please verify the service code.");
      }
    } catch {
      setConnectionError("Failed to lookup ASHA service code. Please try again.");
    } finally {
      setIsResolvingAsha(false);
    }
  };

  // Handle Confirm Connection Request
  const handleConfirmConnection = async () => {
    if (!resolvedAsha) return;
    setConnectionError(null);
    setIsConnecting(true);

    try {
      const res = await connectionService.requestConnection(resolvedAsha.serviceCode);
      if (res.success) {
        setSuccessMessage(`Connection request sent to ${resolvedAsha.displayName}. Awaiting worker confirmation.`);
        setIsConnectionModalOpen(false);
        setServiceCodeInput("");
        setResolvedAsha(null);
        await loadConnectionStatus();
      } else {
        setConnectionError(res.error.message || "Failed to submit connection request.");
      }
    } catch {
      setConnectionError("Failed to submit connection request. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Open Assistance Modal with Context
  const handleOpenAssistanceModal = (
    category: AssistanceCategory = "SCHEME_ENROLLMENT",
    schemeId?: string,
    schemeName?: string
  ) => {
    setAssistanceForm({
      category,
      schemeId: schemeId || "",
      schemeName: schemeName || "",
      message: "",
    });
    setAssistanceError(null);
    setIsAssistanceModalOpen(true);
  };

  // Handle Submit Assistance Request
  const handleAssistanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistanceForm.message.trim()) return;
    setAssistanceError(null);
    setAssistanceSubmitting(true);

    try {
      const res = await assistanceService.createAssistanceRequest({
        category: assistanceForm.category,
        schemeId: assistanceForm.schemeId || undefined,
        schemeName: assistanceForm.schemeName || undefined,
        message: assistanceForm.message.trim(),
      });

      if (res.success) {
        setSuccessMessage("Assistance request sent to your ASHA worker successfully.");
        setIsAssistanceModalOpen(false);
        await loadAssistanceRequests();
      } else {
        setAssistanceError(res.error.message || "Failed to submit assistance request.");
      }
    } catch {
      setAssistanceError("Failed to submit assistance request. Please try again.");
    } finally {
      setAssistanceSubmitting(false);
    }
  };

  const navTabs = [
    { id: "overview", label: "Overview", icon: Users },
    { id: "household", label: "My Household", icon: MapPin },
    { id: "family", label: "Family Members", icon: Users },
    { id: "asha-connection", label: "My ASHA Worker", icon: UserCheck },
    { id: "support", label: "Healthcare Support", icon: ShieldCheck },
    { id: "actions", label: "Next Steps", icon: FileCheck },
  ];

  const eligibleCount = eligibilityResults.filter((r) => r.status === "ELIGIBLE").length;
  const gapsCount = guidance?.gaps?.length || 0;
  const pendingAssistanceCount = assistanceRequests.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS").length;

  return (
    <ProtectedRoute allowedRoles={["CITIZEN"]}>
      <AuthenticatedShell
        role="CITIZEN"
        title={`Welcome, ${userProfile?.displayName || "Citizen"}`}
        description="Official Government Healthcare Entitlements, Household Records, and Direct ASHA Worker Support."
        navTabs={navTabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssistantOpen(true)}
              className="text-xs flex items-center gap-1.5 border-teal-300 text-teal-800 hover:bg-teal-50 shadow-2xs font-semibold"
            >
              <Bot className="w-3.5 h-3.5 text-teal-700" />
              <span>Ask Assistant</span>
            </Button>
            {household && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadEligibility}
                disabled={isEvaluating}
                className="text-xs"
              >
                {isEvaluating ? "Evaluating..." : "Re-check Eligibility"}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (!household) {
                  setHouseholdFormError(null);
                  setIsHouseholdModalOpen(true);
                } else {
                  handleOpenAddMember();
                }
              }}
              className="text-xs font-semibold"
            >
              {!household ? "Set Up Household" : "+ Add Member"}
            </Button>
          </div>
        }
      >
        {/* Banner Alert Messages */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs sm:text-sm text-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs text-rose-600 hover:text-rose-900 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs sm:text-sm text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-xs text-emerald-600 hover:text-emerald-900 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-16">
            <LoadingState message="Loading your household and healthcare records..." />
          </div>
        ) : (
          <div className="space-y-8">
            {/* ============================================================ */}
            {/* TAB: OVERVIEW */}
            {/* ============================================================ */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* 1. Metric Overview Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div
                    onClick={() => setActiveTab("household")}
                    className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1 cursor-pointer hover:border-teal-300 transition-colors"
                  >
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Household Members
                    </span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                      {members.length}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {household ? `${household.district}, ${household.state}` : "No profile yet"}
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("support")}
                    className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1 cursor-pointer hover:border-emerald-300 transition-colors"
                  >
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                      Eligible Schemes
                    </span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-emerald-800">
                      {eligibleCount}
                    </p>
                    <p className="text-[11px] text-slate-400">Verified Govt Entitlements</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("actions")}
                    className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1 cursor-pointer hover:border-amber-300 transition-colors"
                  >
                    <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                      Access Gaps
                    </span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-amber-800">
                      {gapsCount}
                    </p>
                    <p className="text-[11px] text-slate-400">Action Steps Required</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("asha-connection")}
                    className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1 cursor-pointer hover:border-teal-300 transition-colors"
                  >
                    <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">
                      ASHA Connection
                    </span>
                    <div className="flex items-center gap-2 pt-1">
                      {connectionStatus?.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Connected</span>
                        </span>
                      ) : connectionStatus?.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          <Clock3 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          <span>Not Connected</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">
                      {connectionStatus?.asha ? connectionStatus.asha.displayName : "Link with Service Code"}
                    </p>
                  </div>
                </div>

                {/* 2. Active ASHA & Assistance Highlights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ASHA Connection Widget */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-teal-700" />
                          <span>My Local ASHA Worker</span>
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("asha-connection")}
                          className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
                        >
                          View Details
                        </Button>
                      </div>

                      {connectionStatus?.status === "ACTIVE" && connectionStatus.asha ? (
                        <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">
                                {connectionStatus.asha.displayName}
                              </h4>
                              <p className="text-xs text-slate-600">
                                {connectionStatus.asha.serviceArea || "Field Jurisdiction"}
                              </p>
                            </div>
                            <span className="font-mono text-xs font-bold bg-white px-2.5 py-1 rounded border border-emerald-200 text-slate-800">
                              {connectionStatus.asha.serviceCode}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            Your family is actively linked for doorstep health access and scheme facilitation.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
                          <p className="font-semibold text-slate-800">No active ASHA connection linked</p>
                          <p>
                            Enter your local ASHA worker's 10-digit Service Code to receive doorstep assistance.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("asha-connection")}
                            className="text-xs font-semibold mt-1"
                          >
                            Link ASHA Worker Now
                          </Button>
                        </div>
                      )}
                    </div>

                    {connectionStatus?.status === "ACTIVE" && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {pendingAssistanceCount > 0
                            ? `${pendingAssistanceCount} pending assistance request(s)`
                            : "Need help with a scheme?"}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAssistanceModal("SCHEME_ENROLLMENT")}
                          className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> Request ASHA Help
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Quick Access Next Steps */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-teal-700" />
                          <span>Priority Next Steps</span>
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("actions")}
                          className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
                        >
                          Full Plan
                        </Button>
                      </div>

                      {!guidance || !guidance.actionPlan || guidance.actionPlan.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                          {household
                            ? "All verified entitlements are in good standing. No urgent action items."
                            : "Complete household onboarding to generate your personalized action plan."}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {guidance.actionPlan.slice(0, 2).map((action, idx) => (
                            <div
                              key={action.id || idx}
                              className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2.5 text-xs"
                            >
                              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <h5 className="font-bold text-slate-900">{action.title}</h5>
                                <p className="text-slate-600 mt-0.5 line-clamp-1">{action.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Deterministic Healthcare Engine</span>
                      <span className="font-medium text-emerald-700">100% Rule-Verified</span>
                    </div>
                  </div>
                </div>

                {/* 3. Top Eligible Schemes */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Discovered Government Healthcare Schemes
                      </h3>
                      <p className="text-xs text-slate-500">
                        Verified government schemes based on your household's profile and demographics.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("support")}
                      className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
                    >
                      View All Schemes ({eligibilityResults.length})
                    </Button>
                  </div>

                  {eligibilityResults.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                      Add family members to discover eligible healthcare schemes.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {eligibilityResults.slice(0, 4).map((result) => (
                        <div
                          key={result.schemeId}
                          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-bold text-slate-900">{result.schemeName}</h4>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  result.status === "ELIGIBLE"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : result.status === "NEEDS_INFORMATION"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {result.status === "ELIGIBLE"
                                  ? "✓ Eligible"
                                  : result.status === "NEEDS_INFORMATION"
                                  ? "ℹ More Info Needed"
                                  : "Not Eligible"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {result.benefitSummary || "Official government healthcare coverage."}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <button
                              onClick={() => {
                                setExpandedSchemeId(result.schemeId);
                                setActiveTab("support");
                              }}
                              className="text-xs font-semibold text-teal-800 hover:text-teal-900"
                            >
                              Inspect Criteria →
                            </button>
                            {connectionStatus?.status === "ACTIVE" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleOpenAssistanceModal(
                                    "SCHEME_ENROLLMENT",
                                    result.schemeId,
                                    result.schemeName
                                  )
                                }
                                className="text-xs border-teal-200 text-teal-800 hover:bg-teal-50"
                              >
                                Get Help from ASHA
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB: MY HOUSEHOLD */}
            {/* ============================================================ */}
            {activeTab === "household" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Household Profile
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Location and ration tier information used to evaluate healthcare support.
                    </p>
                  </div>
                  {household && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHouseholdFormError(null);
                        setIsHouseholdModalOpen(true);
                      }}
                      className="text-xs flex items-center gap-1.5 font-semibold"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Household</span>
                    </Button>
                  )}
                </div>

                {!household ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h3 className="text-base font-bold text-slate-900">No household profile yet</h3>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                        Add basic details about your family location and ration card category so we can discover available healthcare benefits.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setHouseholdFormError(null);
                        setIsHouseholdModalOpen(true);
                      }}
                      className="font-semibold shadow-xs"
                    >
                      Set Up Household
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                          Head of Household
                        </span>
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {household.headOfHouseholdName}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                          Location
                        </span>
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {household.district}, {household.state}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                          Ration Category
                        </span>
                        <p className="text-sm font-bold text-teal-900">{household.incomeCategory}</p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                          Pincode / Town
                        </span>
                        <p className="text-sm font-bold text-slate-900">
                          {household.pincode} • {household.village || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                      <h4 className="text-sm font-bold text-slate-900">Official Identifiers</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-slate-500 font-semibold uppercase text-[10px] block">Ration Card Number</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">{household.rationCardNumber || "Not Provided"}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-slate-500 font-semibold uppercase text-[10px] block">Contact Phone</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">{household.contactPhone || "Not Provided"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: FAMILY MEMBERS */}
            {/* ============================================================ */}
            {activeTab === "family" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Family Members ({members.length})
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Add each family member so SwasthyaSetu can match maternal, geriatric, and specialty schemes.
                    </p>
                  </div>
                  {household && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleOpenAddMember}
                      className="text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Member</span>
                    </Button>
                  )}
                </div>

                {!household ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-xs sm:text-sm text-slate-500">
                    Set up your household first to add family members.
                  </div>
                ) : members.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-900">No family members added yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Add yourself and your family members with their age and health profiles to discover government entitlements.
                    </p>
                    <Button variant="primary" size="sm" onClick={handleOpenAddMember}>
                      + Add First Family Member
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {members.map((m) => {
                      const isSenior = m.age >= 70;
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">{m.fullName}</h4>
                                <p className="text-xs text-slate-500 capitalize">
                                  {m.relationship} • {m.age} yrs • {m.gender}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditMember(m)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                  title="Edit member"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setRemovingMember(m)}
                                  className="p-1 text-rose-400 hover:text-rose-700 rounded"
                                  title="Remove member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Member Badges */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {isSenior && (
                                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Senior Citizen (70+)
                                </span>
                              )}
                              {m.maternalStatus === "pregnant" && (
                                <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  Pregnant Mother
                                </span>
                              )}
                              {m.disabilityStatus && (
                                <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  Person with Disability
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: MY ASHA WORKER */}
            {/* ============================================================ */}
            {activeTab === "asha-connection" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>Accredited Social Health Activist (ASHA) Connection</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Connect your household with your local ASHA worker for doorstep healthcare facilitation, document collection, and scheme enrollment.
                  </p>
                </div>

                {connectionError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="flex-1">{connectionError}</p>
                  </div>
                )}

                {/* ACTIVE CONNECTION CARD */}
                {connectionStatus?.status === "ACTIVE" && connectionStatus.asha && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-100">
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <UserCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">
                              {connectionStatus.asha.displayName}
                            </h3>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                              Active ASHA Connection
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {connectionStatus.asha.serviceArea || "Field Jurisdiction"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                          <span className="text-[11px] font-semibold text-slate-500">Service Code:</span>
                          <span className="text-xs font-mono font-bold text-slate-800">
                            {connectionStatus.asha.serviceCode}
                          </span>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAssistanceModal()}
                          className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Request Assistance</span>
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Your family profile is actively linked. Your ASHA worker can assist with doorstep enrollment and scheme facilitation.
                      </span>
                    </div>
                  </div>
                )}

                {/* PENDING CONNECTION CARD */}
                {connectionStatus?.status === "PENDING" && connectionStatus.asha && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 sm:p-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <Clock3 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900">
                            Connection Request Sent to {connectionStatus.asha.displayName}
                          </h4>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            Awaiting Worker Confirmation
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Service Code: <span className="font-mono font-semibold">{connectionStatus.asha.serviceCode}</span>
                        </p>
                        <p className="text-xs text-slate-500 pt-1">
                          Your connection will become active once your ASHA worker reviews and accepts the request.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONNECT WITH ASHA CODE FORM */}
                {(connectionStatus?.status === "NONE" || connectionStatus?.status === "REJECTED" || !connectionStatus) && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
                    {connectionStatus?.status === "REJECTED" && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                        Previous connection request was not accepted. You can enter a new Service Code provided by your local ASHA worker below.
                      </div>
                    )}

                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        Link with your local ASHA worker
                      </h3>
                      <p className="text-xs text-slate-500">
                        Ask your village or ward ASHA worker for their unique 10-character Service Code (e.g. <span className="font-mono font-semibold">ASHA-KA-7K42</span>).
                      </p>
                    </div>

                    <form onSubmit={handleLookupAsha} className="flex flex-col sm:flex-row gap-3 max-w-lg">
                      <div className="flex-1">
                        <Input
                          placeholder="e.g. ASHA-KA-7K42"
                          value={serviceCodeInput}
                          onChange={(e) => setServiceCodeInput(e.target.value.toUpperCase())}
                          className="font-mono uppercase text-sm tracking-wider"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={isResolvingAsha || !serviceCodeInput.trim() || !household}
                        className="text-xs font-semibold whitespace-nowrap"
                      >
                        {isResolvingAsha ? "Looking up..." : "Look Up ASHA"}
                      </Button>
                    </form>

                    {!household && (
                      <p className="text-[11px] text-amber-700">
                        * Please set up your household profile first before connecting with an ASHA worker.
                      </p>
                    )}
                  </div>
                )}

                {/* ASSISTANCE REQUESTS HISTORY */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-teal-700" />
                        <span>Submitted Assistance Requests</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Track progress on your requests sent to your ASHA worker.
                      </p>
                    </div>
                    {connectionStatus?.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAssistanceModal()}
                        className="text-xs font-semibold border-teal-300 text-teal-800 hover:bg-teal-50"
                      >
                        + New Request
                      </Button>
                    )}
                  </div>

                  {assistanceRequests.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700">No assistance requests submitted yet</p>
                      <p className="max-w-sm mx-auto">
                        Need help with document verification, card issuance, or hospital registration? Submit a request to your connected ASHA worker.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assistanceRequests.map((req) => (
                        <div
                          key={req.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                {req.category.replace(/_/g, " ")}
                              </span>
                              {req.schemeName && (
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  Scheme: {req.schemeName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  req.status === "RESOLVED" || req.status === "CLOSED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : req.status === "IN_PROGRESS"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {req.status === "RESOLVED"
                                  ? "✓ Resolved"
                                  : req.status === "IN_PROGRESS"
                                  ? "Assisting"
                                  : "Pending Review"}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {new Date(req.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1 text-xs">
                            <p className="text-slate-800 font-medium">{req.message}</p>
                            {req.responseNote && (
                              <div className="p-3 mt-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                                <span className="font-bold block text-[11px] uppercase tracking-wide">
                                  ASHA Update from {req.ashaName}:
                                </span>
                                <p className="mt-0.5">{req.responseNote}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: HEALTHCARE SUPPORT */}
            {/* ============================================================ */}
            {activeTab === "support" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Government Healthcare Support
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Verified entitlement pathways based on official government rules.
                    </p>
                  </div>
                </div>

                {!household ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-xs sm:text-sm text-slate-500">
                    Add household details to discover applicable healthcare schemes.
                  </div>
                ) : isEvaluating ? (
                  <div className="py-8">
                    <LoadingState message="Evaluating applicable healthcare schemes..." />
                  </div>
                ) : eligibilityResults.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs sm:text-sm text-slate-500">
                    No verified healthcare schemes evaluated yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {eligibilityResults.map((result) => {
                      const isExpanded = expandedSchemeId === result.schemeId;
                      const isEligible = result.status === "ELIGIBLE";
                      const isNeedsInfo = result.status === "NEEDS_INFORMATION";

                      return (
                        <div
                          key={result.schemeId}
                          className={`rounded-xl border transition-all ${
                            isEligible
                              ? "border-emerald-200/90 bg-emerald-50/20"
                              : isNeedsInfo
                              ? "border-amber-200/90 bg-amber-50/20"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          {/* Scheme Card Header */}
                          <div
                            onClick={() =>
                              setExpandedSchemeId(isExpanded ? null : result.schemeId)
                            }
                            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  isEligible
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isNeedsInfo
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <ShieldCheck className="w-5 h-5" />
                              </div>

                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                    {result.schemeName}
                                  </h3>
                                  {result.pathwayCode && (
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {result.pathwayCode}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-slate-600">
                                  {result.benefitSummary || "Official healthcare coverage."}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                  isEligible
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isNeedsInfo
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {isEligible
                                  ? "✓ Eligible Pathway Found"
                                  : isNeedsInfo
                                  ? "ℹ More Information Needed"
                                  : "Not Eligible"}
                              </span>

                              <button
                                type="button"
                                aria-label="Toggle details"
                                className="text-slate-400 hover:text-slate-700 p-1"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Progressive Disclosure Details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-slate-100/80 space-y-3 text-xs sm:text-sm">
                              {/* Why this applies */}
                              <div className="rounded-lg bg-white p-3 border border-slate-200/80 space-y-1">
                                <span className="font-bold text-slate-800 block text-xs uppercase tracking-wide">
                                  Why this applies:
                                </span>
                                <p className="text-slate-600 leading-relaxed">
                                  {isEligible
                                    ? result.matchedRules.map((r) => r.explanation).filter(Boolean).join(". ") ||
                                      "Household meets verified age and categorical criteria for this pathway."
                                    : isNeedsInfo
                                    ? result.missingRequirements
                                        .map((m) => m.description || m.field)
                                        .filter(Boolean)
                                        .join(". ") ||
                                      "SwasthyaSetu requires additional details to evaluate this pathway."
                                    : result.failedRules.map((r) => r.explanation).filter(Boolean).join(". ") ||
                                      "Household criteria did not match the specific eligibility rules for this scheme."}
                                </p>
                              </div>

                              {/* Required Documents / Next Action */}
                              {result.missingRequirements && result.missingRequirements.length > 0 && (
                                <div className="rounded-lg bg-amber-50/60 p-3 border border-amber-200 space-y-1">
                                  <span className="font-bold text-amber-900 block text-xs uppercase tracking-wide">
                                    Missing details needed:
                                  </span>
                                  <ul className="list-disc list-inside text-amber-800 text-xs space-y-0.5">
                                    {result.missingRequirements.map((req, idx) => (
                                      <li key={idx}>{req.description || req.field}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Direct ASHA Assistance Action */}
                              {connectionStatus?.status === "ACTIVE" && (
                                <div className="pt-2 flex justify-end">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() =>
                                      handleOpenAssistanceModal(
                                        "SCHEME_ENROLLMENT",
                                        result.schemeId,
                                        result.schemeName
                                      )
                                    }
                                    className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white"
                                  >
                                    <Send className="w-3.5 h-3.5 mr-1" /> Get help from your ASHA worker
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: NEXT STEPS */}
            {/* ============================================================ */}
            {activeTab === "actions" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Healthcare Action Plan & Access Gaps
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Clear, prioritized steps to bridge healthcare gaps and claim government entitlements.
                  </p>
                </div>

                {!household ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-xs sm:text-sm text-slate-500">
                    Complete household onboarding to generate your personalized action plan.
                  </div>
                ) : !guidance || !guidance.actionPlan || guidance.actionPlan.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs sm:text-sm text-slate-500">
                    No pending action steps. Your household entitlements are up to date.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Action Items List */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs divide-y divide-slate-100">
                      {guidance.actionPlan.map((action, index) => (
                        <div key={action.id || index} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5">
                          <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {action.stepNumber || index + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-slate-900">
                                {action.title}
                              </h4>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  action.priority === "REQUIRED"
                                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                                    : action.priority === "IMPORTANT"
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {action.priority}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {action.description}
                            </p>
                            {action.reason && (
                              <p className="text-[11px] text-teal-800 font-medium">
                                Why: {action.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Assistance trigger */}
                    {connectionStatus?.status === "ACTIVE" && (
                      <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-teal-900">
                          <p className="font-bold">Need assistance executing these steps?</p>
                          <p className="text-teal-700 mt-0.5">Your connected ASHA worker can visit your doorstep to assist with forms.</p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAssistanceModal("DOCUMENT_HELP")}
                          className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white whitespace-nowrap"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> Request ASHA Help
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODALS */}
        {/* ============================================================ */}

        {/* Modal: Setup / Edit Household */}
        <Modal
          isOpen={isHouseholdModalOpen}
          onClose={() => setIsHouseholdModalOpen(false)}
          title={household ? "Edit Household Details" : "Set Up Household Profile"}
          description="Provide your family location and ration category to evaluate healthcare entitlements."
        >
          <form onSubmit={handleHouseholdSubmit} className="space-y-4">
            {householdFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {householdFormError}
              </div>
            )}

            <Input
              label="Head of Household Name"
              required
              value={householdForm.headOfHouseholdName}
              onChange={(e) =>
                setHouseholdForm({ ...householdForm, headOfHouseholdName: e.target.value })
              }
              placeholder="e.g. Ramesh Kumar"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="State"
                required
                value={householdForm.state}
                onChange={(e) => setHouseholdForm({ ...householdForm, state: e.target.value })}
                placeholder="e.g. Bihar"
              />
              <Input
                label="District"
                required
                value={householdForm.district}
                onChange={(e) =>
                  setHouseholdForm({ ...householdForm, district: e.target.value })
                }
                placeholder="e.g. Patna"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Village / Town"
                required
                value={householdForm.village}
                onChange={(e) =>
                  setHouseholdForm({ ...householdForm, village: e.target.value })
                }
                placeholder="e.g. Patna City"
              />
              <Input
                label="Pincode"
                required
                value={householdForm.pincode}
                onChange={(e) =>
                  setHouseholdForm({ ...householdForm, pincode: e.target.value })
                }
                placeholder="e.g. 800001"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Ration Card Category"
                value={householdForm.incomeCategory}
                onChange={(e) =>
                  setHouseholdForm({
                    ...householdForm,
                    incomeCategory: e.target.value as IncomeCategory,
                  })
                }
                options={INCOME_OPTIONS}
              />
              <Input
                label="Ration Card Number"
                value={householdForm.rationCardNumber}
                onChange={(e) =>
                  setHouseholdForm({ ...householdForm, rationCardNumber: e.target.value })
                }
                placeholder="e.g. RC-10293847"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsHouseholdModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={householdSubmitting}>
                {householdSubmitting ? "Saving..." : "Save Household"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Add / Edit Family Member */}
        <Modal
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          title={editingMemberId ? "Edit Family Member" : "Add Family Member"}
          description="Enter member age and health profile details for entitlement checks."
        >
          <form onSubmit={handleMemberSubmit} className="space-y-4">
            {memberFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {memberFormError}
              </div>
            )}

            <Input
              label="Full Name"
              required
              value={memberForm.fullName}
              onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })}
              placeholder="e.g. Sita Devi"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Age (Years)"
                type="number"
                min="0"
                max="120"
                required
                value={memberForm.age}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, age: parseInt(e.target.value, 10) || 0 })
                }
              />
              <Select
                label="Gender"
                value={memberForm.gender}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, gender: e.target.value as Gender })
                }
                options={GENDER_OPTIONS}
              />
              <Select
                label="Relationship"
                value={memberForm.relationship}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, relationship: e.target.value })
                }
                options={RELATIONSHIP_OPTIONS}
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={memberForm.disabilityStatus}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, disabilityStatus: e.target.checked })
                  }
                  className="rounded text-teal-700 focus:ring-teal-700"
                />
                <span>Person with benchmark disability</span>
              </label>

              {memberForm.gender === "female" && (
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberForm.maternalStatus === "pregnant"}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        maternalStatus: e.target.checked ? "pregnant" : "none",
                      })
                    }
                    className="rounded text-teal-700 focus:ring-teal-700"
                  />
                  <span>Currently pregnant or lactating mother</span>
                </label>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMemberModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={memberSubmitting}>
                {memberSubmitting ? "Saving..." : "Save Member"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Remove Member Confirmation */}
        <Modal
          isOpen={Boolean(removingMember)}
          onClose={() => setRemovingMember(null)}
          title="Remove Family Member"
          description={`Are you sure you want to remove ${removingMember?.fullName} from your household?`}
        >
          <div className="pt-4 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemovingMember(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleConfirmRemoveMember}
              disabled={removeSubmitting}
              className="bg-rose-600 text-white hover:bg-rose-700 border-rose-600"
            >
              {removeSubmitting ? "Removing..." : "Confirm Remove"}
            </Button>
          </div>
        </Modal>

        {/* Modal: Confirm ASHA Connection */}
        <Modal
          isOpen={isConnectionModalOpen}
          onClose={() => {
            setIsConnectionModalOpen(false);
            setResolvedAsha(null);
          }}
          title="Confirm ASHA Connection"
          description="Please review the details of the ASHA worker who will be linked to your family."
        >
          {resolvedAsha && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-800 text-white flex items-center justify-center font-bold text-sm">
                    {resolvedAsha.displayName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{resolvedAsha.displayName}</h4>
                    <p className="text-xs text-slate-500">{resolvedAsha.serviceArea || "Field Jurisdiction"}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Service Code</span>
                    <span className="font-mono font-bold text-slate-800">{resolvedAsha.serviceCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Assigned Area</span>
                    <span className="text-slate-700">{resolvedAsha.serviceArea || "Village Jurisdiction"}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-teal-50/70 rounded-lg border border-teal-200 text-xs text-teal-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  By requesting connection, this verified ASHA worker will be notified and can assist your household with official doorstep health access.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsConnectionModalOpen(false);
                    setResolvedAsha(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirmConnection}
                  disabled={isConnecting}
                  className="font-semibold"
                >
                  {isConnecting ? "Sending Request..." : "Request Connection"}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal: Request ASHA Assistance */}
        <Modal
          isOpen={isAssistanceModalOpen}
          onClose={() => setIsAssistanceModalOpen(false)}
          title="Request ASHA Assistance"
          description={`Submit a request to ${connectionStatus?.asha?.displayName || "your ASHA worker"} for doorstep support, document verification, or scheme enrollment.`}
        >
          <form onSubmit={handleAssistanceSubmit} className="space-y-4">
            {assistanceError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {assistanceError}
              </div>
            )}

            <Select
              label="Assistance Category"
              value={assistanceForm.category}
              onChange={(e) =>
                setAssistanceForm({
                  ...assistanceForm,
                  category: e.target.value as AssistanceCategory,
                })
              }
              options={ASSISTANCE_CATEGORIES}
            />

            {assistanceForm.schemeName && (
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-xs text-teal-900">
                <span className="font-bold block uppercase text-[10px]">Associated Government Scheme:</span>
                <span className="font-semibold">{assistanceForm.schemeName}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Details / Message for ASHA Worker *
              </label>
              <textarea
                required
                rows={4}
                value={assistanceForm.message}
                onChange={(e) =>
                  setAssistanceForm({ ...assistanceForm, message: e.target.value })
                }
                placeholder="Please describe what help or documents you need..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssistanceModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={assistanceSubmitting || !assistanceForm.message.trim()}
                className="bg-teal-800 hover:bg-teal-900 text-white font-semibold"
              >
                {assistanceSubmitting ? "Submitting..." : "Send Request to ASHA"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Floating Healthcare Assistant Trigger */}
        <button
          onClick={() => setIsAssistantOpen(true)}
          aria-label="Open SwasthyaSetu Healthcare Assistant"
          className="fixed bottom-6 right-6 z-40 bg-teal-800 hover:bg-teal-900 text-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95 border border-teal-700 cursor-pointer"
        >
          <Bot className="w-4 h-4 text-teal-200" />
          <span>Ask Assistant</span>
        </button>

        {/* SwasthyaSetu Healthcare Assistant Drawer */}
        <HealthcareAssistantDrawer
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          userRole="CITIZEN"
        />
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
