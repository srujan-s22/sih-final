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
import { CitizenCallModal } from "@/components/voice/citizen-call-modal";
import { voiceService } from "@/services/voice-service";
import { VoicePublicConfig } from "@shared/types/voice";
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
  Bot,
  QrCode,
  Link2,
  UserCheck,
  Clock3,
  Send,
  MessageSquare,
  HelpCircle,
  Calendar,
  Check,
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
    beneficiaryMemberId: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    message: string;
  }>({
    category: "SCHEME_ENROLLMENT",
    schemeId: "",
    schemeName: "",
    beneficiaryMemberId: "",
    priority: "NORMAL",
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

  // Phase 11 Voice / Telephony Modal State
  const [isVoiceCallModalOpen, setIsVoiceCallModalOpen] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState<VoicePublicConfig | null>(null);

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
    voiceService.getVoiceConfig().then((res) => {
      if (res.success && res.data) {
        setVoiceConfig(res.data);
      }
    });
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
    schemeName?: string,
    defaultBeneficiaryId?: string
  ) => {
    let matchedMemberId = defaultBeneficiaryId || "";
    if (!matchedMemberId && members.length > 0) {
      if (schemeId === "ab-pmjay") {
        const senior = members.find((m) => m.age >= 70);
        if (senior) matchedMemberId = senior.id;
      } else if (schemeId === "jsy") {
        const pregnant = members.find(
          (m) => m.gender === "female" && (m.maternalStatus === "pregnant" || (m.age >= 18 && m.age <= 45))
        );
        if (pregnant) matchedMemberId = pregnant.id;
      }
      if (!matchedMemberId && members[0]) {
        matchedMemberId = members[0].id;
      }
    }

    const selectedMember = members.find((m) => m.id === matchedMemberId);
    let defaultMsg = "";
    if (schemeId && selectedMember) {
      defaultMsg = `Requesting doorstep assistance for ${schemeName || schemeId} enrollment and document verification for ${selectedMember.fullName} (Age ${selectedMember.age}, ${selectedMember.relationship || "Member"}).`;
    } else if (schemeId) {
      defaultMsg = `Requesting doorstep assistance for ${schemeName || schemeId} enrollment for our household.`;
    }

    setAssistanceForm({
      category,
      schemeId: schemeId || "",
      schemeName: schemeName || "",
      beneficiaryMemberId: matchedMemberId,
      priority: "NORMAL",
      message: defaultMsg,
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
        beneficiaryMemberId: assistanceForm.beneficiaryMemberId || undefined,
        message: assistanceForm.message.trim(),
        priority: assistanceForm.priority || "NORMAL",
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
        title={
          activeTab === "household"
            ? "My Household"
            : activeTab === "family"
            ? "Family Members"
            : activeTab === "asha-connection"
            ? "My ASHA Worker"
            : activeTab === "support"
            ? "Healthcare Support & Schemes"
            : activeTab === "actions"
            ? "Next Steps"
            : `Welcome, ${userProfile?.displayName || "Citizen"} 👋`
        }
        description={
          activeTab === "household"
            ? "Your household address, location, and ration details used for government healthcare support."
            : activeTab === "family"
            ? "Household members evaluated for healthcare schemes and entitlements."
            : activeTab === "asha-connection"
            ? "Direct connection and doorstep assistance requests with your local ASHA worker."
            : activeTab === "support"
            ? "Discovered government health schemes and verified entitlements."
            : activeTab === "actions"
            ? "Personalized step-by-step guide to complete requirements and claim benefits."
            : "Your government healthcare benefits, family support, and ASHA assistance in one place."
        }
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
                {/* -------------------------------------------------------- */}
                {/* SECTION 2: WHAT DO YOU NEED HELP WITH? */}
                {/* -------------------------------------------------------- */}
                <section className="space-y-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      What do you need help with?
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Quick access to your health benefits, family records, and local ASHA worker.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Card 1: Health Benefits */}
                    <div
                      onClick={() => setActiveTab("support")}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("support")}
                      className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 group-hover:bg-teal-100 group-hover:text-teal-800 transition-colors">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          {eligibleCount > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {eligibleCount} available
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                              {eligibilityResults.length} schemes
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                            My Health Benefits
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            See government schemes you and your family may be eligible for.
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                        <span>View benefits</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    {/* Card 2: My Family */}
                    <div
                      onClick={() => setActiveTab(household ? "family" : "household")}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab(household ? "family" : "household")}
                      className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-slate-100 group-hover:text-slate-900 transition-colors">
                            <Users className="w-5 h-5" />
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {members.length} {members.length === 1 ? "member" : "members"}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                            My Family
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            View and manage your household members and demographics.
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                        <span>Manage family</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    {/* Card 3: Get ASHA Help */}
                    <div
                      onClick={() => setActiveTab("asha-connection")}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("asha-connection")}
                      className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                            <UserCheck className="w-5 h-5" />
                          </div>
                          {connectionStatus?.status === "ACTIVE" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              Link with Code
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                            Get ASHA Help
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {connectionStatus?.status === "ACTIVE" && connectionStatus.asha
                              ? `Connected with ${connectionStatus.asha.displayName} for doorstep care.`
                              : "Connect with your local community healthcare worker."}
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                        <span>ASHA support</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* -------------------------------------------------------- */}
                {/* SECTION 3: YOUR HEALTH BENEFITS */}
                {/* -------------------------------------------------------- */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Your Health Benefits
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Government schemes based on your household information.
                      </p>
                    </div>
                    {eligibilityResults.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("support")}
                        className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
                      >
                        View all schemes ({eligibilityResults.length})
                      </Button>
                    )}
                  </div>

                  {!household ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-teal-50 text-teal-700 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div className="space-y-1 max-w-md mx-auto">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          Set up your household to check benefits
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500">
                          Enter your location and ration details to check eligibility for Ayushman Bharat, Janani Suraksha Yojana, and more.
                        </p>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setHouseholdFormError(null);
                            setIsHouseholdModalOpen(true);
                          }}
                          className="text-xs font-semibold"
                        >
                          Set Up Household
                        </Button>
                      </div>
                    </div>
                  ) : members.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-teal-50 text-teal-700 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="space-y-1 max-w-md mx-auto">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          Add your family members
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500">
                          Add family members to check individual eligibility for senior citizens, mothers, and children.
                        </p>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleOpenAddMember}
                          className="text-xs font-semibold"
                        >
                          + Add Family Member
                        </Button>
                      </div>
                    </div>
                  ) : eligibilityResults.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-3">
                      <div className="space-y-1 max-w-md mx-auto">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          No matching benefits found yet
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500">
                          Based on your current records, no matching national schemes were found. Your local ASHA worker can help check additional state programs.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {eligibilityResults.slice(0, 3).map((result) => (
                        <div
                          key={result.schemeId}
                          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                {result.schemeName}
                              </h4>
                              <span
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 border ${
                                  result.status === "ELIGIBLE"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : result.status === "NEEDS_INFORMATION"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                {result.status === "ELIGIBLE"
                                  ? "✓ You may be eligible"
                                  : result.status === "NEEDS_INFORMATION"
                                  ? "A few details are needed"
                                  : "Not eligible"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                              {result.benefitSummary || "Official government healthcare coverage and benefits."}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedSchemeId(result.schemeId);
                                setActiveTab("support");
                              }}
                              className="text-xs font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                            >
                              View details →
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
                                className="text-xs border-teal-200 text-teal-800 hover:bg-teal-50 font-medium py-1 px-2.5"
                              >
                                Request Help
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* -------------------------------------------------------- */}
                {/* SECTION 4: YOUR NEXT STEP */}
                {/* -------------------------------------------------------- */}
                <section className="space-y-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Your Next Step
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      The most important action for your healthcare access.
                    </p>
                  </div>

                  {!household ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            Set up your household profile
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Add your ration card and location so our system can check government healthcare schemes for you.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setHouseholdFormError(null);
                          setIsHouseholdModalOpen(true);
                        }}
                        className="text-xs font-semibold shrink-0"
                      >
                        Set Up Household
                      </Button>
                    </div>
                  ) : guidance?.actionPlan && guidance.actionPlan.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5">
                          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Clock3 className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                              Priority Action
                            </span>
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                              {guidance.actionPlan[0].title}
                            </h4>
                            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed max-w-3xl">
                              {guidance.actionPlan[0].description}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:self-start">
                          {connectionStatus?.status === "ACTIVE" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenAssistanceModal("DOCUMENT_HELP")}
                              className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Request ASHA Help</span>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("actions")}
                            className="text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View all steps ({guidance.actionPlan.length})
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            You're all caught up
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Your current healthcare actions and verified records are complete.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("actions")}
                        className="text-xs font-semibold text-emerald-800 border-emerald-200 hover:bg-emerald-50 shrink-0"
                      >
                        View full plan
                      </Button>
                    </div>
                  )}
                </section>

                {/* -------------------------------------------------------- */}
                {/* SECTION 5 & 6: ASHA WORKER + NEED HELP / HELPLINE */}
                {/* -------------------------------------------------------- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* SECTION 5: ASHA WORKER */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-teal-700" />
                          <span>Your Local ASHA Worker</span>
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("asha-connection")}
                          className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
                        >
                          View details
                        </Button>
                      </div>

                      {connectionStatus?.status === "ACTIVE" && connectionStatus.asha ? (
                        <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">
                                {connectionStatus.asha.displayName}
                              </h4>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {connectionStatus.asha.serviceArea || "Field Jurisdiction"}
                              </p>
                            </div>
                            <span className="font-mono text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-slate-800">
                              Code: {connectionStatus.asha.serviceCode}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed pt-1">
                            Your family is connected with your local ASHA worker for doorstep health support and scheme facilitation.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
                          <p className="font-semibold text-slate-900">
                            Connect with a local ASHA worker
                          </p>
                          <p className="leading-relaxed">
                            An ASHA worker can help with scheme enrollment, document verification, and doorstep healthcare support.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("asha-connection")}
                            className="text-xs font-semibold mt-1"
                          >
                            Connect with ASHA
                          </Button>
                        </div>
                      )}
                    </div>

                    {connectionStatus?.status === "ACTIVE" && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {pendingAssistanceCount > 0
                            ? `${pendingAssistanceCount} pending request(s)`
                            : "Need assistance?"}
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

                  {/* SECTION 6: NEED HELP? / VOICE HELPLINE */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-teal-700" />
                          <span>Need help?</span>
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          24/7 Helpline
                        </span>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs text-slate-600">
                        <p className="font-semibold text-slate-900">
                          Talk to the SwasthyaSetu healthcare assistant
                        </p>
                        <p className="leading-relaxed">
                          Call our helpline to ask about government health schemes, check your eligibility, or request ASHA assistance.
                        </p>
                        <div className="pt-2 flex items-center gap-2">
                          <div className="bg-white px-3 py-1.5 rounded-md border border-slate-200">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                              {voiceConfig?.isTollFree ? "Toll-Free Helpline" : "Helpline Number"}
                            </span>
                            <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 tracking-wider">
                              {voiceConfig?.displayHelplineText || "08047283240"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAssistantOpen(true)}
                        className="text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Bot className="w-3.5 h-3.5 text-teal-700" />
                        <span>Ask Online Assistant</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setIsVoiceCallModalOpen(true)}
                        className="bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 py-1.5 px-3"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call SwasthyaSetu</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB: MY HOUSEHOLD (A2) */}
            {/* ============================================================ */}
            {activeTab === "household" && (
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      My Household
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Your household address, location, and ration details used for government healthcare support.
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
                      className="text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto text-teal-800 border-teal-200 hover:bg-teal-50"
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
                  <div className="space-y-6">
                    {/* Primary Household Profile Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
                      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                        <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                            Household Head
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900">
                            {household.headOfHouseholdName}
                          </h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                            Ration Category
                          </span>
                          <span className="text-sm font-bold text-teal-900 block">
                            {household.incomeCategory === "BPL"
                              ? "Below Poverty Line (BPL)"
                              : household.incomeCategory === "AAY"
                              ? "Antyodaya Anna Yojana (AAY)"
                              : household.incomeCategory === "APL"
                              ? "Above Poverty Line (APL)"
                              : household.incomeCategory}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                            Contact Phone
                          </span>
                          <span className="font-mono text-sm font-bold text-slate-900 block">
                            {household.contactPhone || "Not Provided"}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                            Ration Card Number
                          </span>
                          <span className="font-mono text-sm font-bold text-slate-900 block">
                            {household.rationCardNumber || "Not Provided"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Location Details Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-700" />
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          Location & Address
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                            Village / Town
                          </span>
                          <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                            {household.village || "N/A"}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                            District
                          </span>
                          <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                            {household.district}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                            State
                          </span>
                          <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                            {household.state}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                            Postal Code
                          </span>
                          <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                            {household.pincode}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Link to Family Members */}
                    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold text-slate-900">
                          Family Members in this Household
                        </h4>
                        <p className="text-xs text-slate-600">
                          {members.length} {members.length === 1 ? "member" : "members"} currently registered for healthcare benefit evaluation.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("family")}
                          className="text-xs font-semibold text-teal-800 border-teal-300 hover:bg-teal-50"
                        >
                          View Family Members →
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleOpenAddMember}
                          className="text-xs font-semibold"
                        >
                          + Add Member
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: FAMILY MEMBERS (A3) */}
            {/* ============================================================ */}
            {activeTab === "family" && (
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Family Members ({members.length})
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Add and manage household members evaluated for healthcare schemes and entitlements.
                    </p>
                  </div>
                  {household && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleOpenAddMember}
                      className="text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Family Member</span>
                    </Button>
                  )}
                </div>

                {!household ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-xs sm:text-sm text-slate-500 space-y-3">
                    <p>Set up your household first to add family members.</p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setHouseholdFormError(null);
                        setIsHouseholdModalOpen(true);
                      }}
                      className="text-xs font-semibold"
                    >
                      Set Up Household
                    </Button>
                  </div>
                ) : members.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h4 className="text-base font-bold text-slate-900">No family members added yet</h4>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Add yourself and your family members with their age and healthcare profiles to check eligibility for government schemes.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button variant="primary" size="sm" onClick={handleOpenAddMember} className="text-xs font-semibold">
                        + Add First Family Member
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {members.map((m) => {
                      const isSenior = m.age >= 70;
                      const isPregnant = m.maternalStatus === "pregnant";
                      const isDisability = m.disabilityStatus;

                      return (
                        <div
                          key={m.id}
                          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between hover:border-teal-300 transition-colors"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-800 font-bold text-sm">
                                  {m.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                                    {m.fullName}
                                  </h4>
                                  <span className="text-xs font-medium text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 inline-block mt-0.5">
                                    {m.relationship || "Member"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditMember(m)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
                                  title="Edit member"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRemovingMember(m)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Remove member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Demographics details */}
                            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Age & Gender:</span>
                                <span className="font-semibold text-slate-800 capitalize">
                                  {m.age} years • {m.gender}
                                </span>
                              </div>
                            </div>

                            {/* Citizen healthcare tags */}
                            {(isSenior || isPregnant || isDisability) && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {isSenior && (
                                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Senior Citizen (70+)
                                  </span>
                                )}
                                {isPregnant && (
                                  <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                    Pregnant / Nursing Mother
                                  </span>
                                )}
                                {isDisability && (
                                  <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                    Benchmark Disability Support
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => handleOpenEditMember(m)}
                              className="font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                            >
                              Edit details
                            </button>
                            {connectionStatus?.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => handleOpenAssistanceModal("SCHEME_ENROLLMENT", undefined, undefined, m.id)}
                                className="font-medium text-slate-600 hover:text-teal-800 transition-colors"
                              >
                                Request ASHA Help →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: MY ASHA WORKER (A4) */}
            {/* ============================================================ */}
            {activeTab === "asha-connection" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    My ASHA Worker
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Your local ASHA worker can help you access healthcare services, verify documents, and apply for government schemes.
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
                  <div className="rounded-xl border border-emerald-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                          <UserCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900">
                              {connectionStatus.asha.displayName}
                            </h3>
                            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              ✓ Connected
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {connectionStatus.asha.serviceArea || "Field Jurisdiction"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                            Service Code
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-800">
                            {connectionStatus.asha.serviceCode}
                          </span>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAssistanceModal()}
                          className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5 shadow-2xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Request ASHA Help</span>
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Your household is connected for doorstep healthcare facilitation, document collection, and scheme enrollment.
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
                  <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                    {connectionStatus?.status === "REJECTED" && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                        Previous connection request was not accepted. You can enter a new Service Code provided by your local ASHA worker below.
                      </div>
                    )}

                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Connect with your local ASHA worker
                      </h3>
                      <p className="text-xs text-slate-500">
                        Ask your village or ward ASHA worker for their 10-character Service Code (e.g. <span className="font-mono font-semibold">ASHA-KA-7K42</span>) to link your household.
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
                        {isResolvingAsha ? "Looking up..." : "Connect with ASHA"}
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
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-teal-700" />
                        <span>My Assistance Requests</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Track progress on healthcare requests submitted to your ASHA worker.
                      </p>
                    </div>
                    {connectionStatus?.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAssistanceModal()}
                        className="text-xs font-semibold border-teal-200 text-teal-800 hover:bg-teal-50"
                      >
                        + New Request
                      </Button>
                    )}
                  </div>

                  {assistanceRequests.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700">No assistance requests yet</p>
                      <p className="max-w-sm mx-auto">
                        Need help with document verification, card issuance, or healthcare registration? Submit a request to your connected ASHA worker.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {assistanceRequests.map((req) => {
                        const isResolved = req.status === "RESOLVED" || req.status === "CLOSED";
                        const isDeclined = req.status === "DECLINED";
                        const isPmjay = req.schemeId === "ab-pmjay";
                        const isJsy = req.schemeId === "jsy";

                        const steps = isPmjay
                          ? [
                              "Eligibility Identified",
                              "Identity Confirmed",
                              "e-KYC & Enrollment",
                              "Application Submitted",
                              "Card Issued",
                              "Hospital Access",
                              "Resolved",
                            ]
                          : isJsy
                          ? [
                              "Pregnancy Confirmed",
                              "Eligibility Verified",
                              "MCP Card Registration",
                              "Facility Mapped",
                              "Delivery Care",
                              "Postnatal Care",
                              "DBT Transfer",
                              "Resolved",
                            ]
                          : [
                              "Request Submitted",
                              "ASHA Accepted",
                              "Doorstep Assistance",
                              "Resolved",
                            ];

                        const currentStepIndex = isResolved
                          ? steps.length - 1
                          : isDeclined
                          ? 0
                          : req.status === "IN_PROGRESS" || req.status === "FOLLOW_UP_REQUIRED"
                          ? Math.min(2, steps.length - 2)
                          : req.status === "ACCEPTED"
                          ? 1
                          : 0;

                        return (
                          <div
                            key={req.id}
                            className={`rounded-xl border p-4 sm:p-5 shadow-2xs space-y-4 transition-all ${
                              isResolved
                                ? "border-emerald-200 bg-emerald-50/15"
                                : isDeclined
                                ? "border-rose-200 bg-rose-50/20"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                {req.initiatedBy === "ASHA" ? (
                                  <span className="text-xs font-bold text-emerald-900 bg-emerald-100/90 px-2.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Doorstep Help from {req.ashaName || "ASHA"}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                                    {req.category.replace(/_/g, " ")}
                                  </span>
                                )}
                                {req.schemeName && (
                                  <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                                    {req.schemeName}
                                  </span>
                                )}
                                {req.beneficiaryName && (
                                  <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-500" />
                                    <span>{req.beneficiaryName} ({req.beneficiaryRelationship || "Member"}{req.beneficiaryAge ? `, Age ${req.beneficiaryAge}` : ""})</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                    isResolved
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : isDeclined
                                      ? "bg-rose-50 text-rose-800 border border-rose-200"
                                      : req.status === "IN_PROGRESS" || req.status === "ACCEPTED"
                                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                                      : "bg-amber-50 text-amber-800 border border-amber-200"
                                  }`}
                                >
                                  {isResolved
                                    ? "✓ Completed"
                                    : isDeclined
                                    ? "✕ Declined"
                                    : req.status === "ACCEPTED"
                                    ? "✓ In Progress"
                                    : req.status === "IN_PROGRESS"
                                    ? "● In Progress"
                                    : "⏳ Awaiting Review"}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {new Date(req.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2 text-xs">
                              <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                                <span className="font-bold text-slate-500 block text-[10px] uppercase mb-0.5">
                                  {req.initiatedBy === "ASHA" ? "ASHA Note:" : "Your Request:"}
                                </span>
                                {req.message}
                              </p>

                              {/* Simple Step Progress Indicator */}
                              <div className="mt-3 pt-2 border-t border-slate-100">
                                <span className="text-[11px] font-semibold text-slate-600 block mb-2">
                                  Assistance Progress:
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                                  {steps.map((stepName, sIdx) => {
                                    const isDone = isResolved || sIdx < currentStepIndex;
                                    const isCurrent = !isResolved && !isDeclined && sIdx === currentStepIndex;

                                    return (
                                      <div
                                        key={sIdx}
                                        className={`p-2 rounded-lg border text-center transition-all ${
                                          isDone
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold"
                                            : isCurrent
                                            ? "bg-teal-50 border-teal-300 text-teal-950 font-bold"
                                            : "bg-slate-50 border-slate-200 text-slate-400"
                                        }`}
                                      >
                                        <div className="flex items-center justify-center mb-1">
                                          {isDone ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                          ) : isCurrent ? (
                                            <div className="w-3 h-3 rounded-full bg-teal-700" />
                                          ) : (
                                            <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-300" />
                                          )}
                                        </div>
                                        <p className="text-[10px] leading-tight line-clamp-2">
                                          {stepName}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* ASHA Response Notes */}
                              {req.responseNote && (
                                <div className="p-3 mt-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                                  <span className="font-bold block text-[10px] uppercase tracking-wide">
                                    Update from {req.ashaName}:
                                  </span>
                                  <p className="mt-0.5 text-xs">{req.responseNote}</p>
                                </div>
                              )}

                              {/* Decline Reason if Declined */}
                              {isDeclined && req.declineReason && (
                                <div className="p-3 mt-2 bg-rose-50 rounded-lg border border-rose-200 text-rose-900">
                                  <span className="font-bold block text-[10px] uppercase tracking-wide">
                                    Notice from ASHA Worker:
                                  </span>
                                  <p className="mt-0.5 text-xs">{req.declineReason}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: HEALTHCARE SUPPORT (A5) */}
            {/* ============================================================ */}
            {activeTab === "support" && (
              <section className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Healthcare Support & Schemes
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Government healthcare benefits evaluated for your household.
                    </p>
                  </div>
                  {household && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadEligibility}
                      disabled={isEvaluating}
                      className="text-xs font-semibold self-start sm:self-auto"
                    >
                      {isEvaluating ? "Checking..." : "Re-check Eligibility"}
                    </Button>
                  )}
                </div>

                {/* Informational Assessment Disclaimer */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <p>
                    <strong>Informational Notice:</strong> Eligibility shown is an informational assessment based on official criteria. Final enrollment and card issuance are determined by the relevant government authority.
                  </p>
                </div>

                {!household ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs sm:text-sm text-slate-500 space-y-3">
                    <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-800">Set up your household first</p>
                    <p className="max-w-sm mx-auto">
                      Add your household location and ration category to discover applicable healthcare schemes.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setHouseholdFormError(null);
                        setIsHouseholdModalOpen(true);
                      }}
                      className="text-xs font-semibold"
                    >
                      Set Up Household
                    </Button>
                  </div>
                ) : isEvaluating ? (
                  <div className="py-12">
                    <LoadingState message="Evaluating applicable healthcare schemes..." />
                  </div>
                ) : eligibilityResults.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs sm:text-sm text-slate-500 space-y-2">
                    <p className="font-semibold text-slate-800">No matching benefits found yet</p>
                    <p className="max-w-sm mx-auto">
                      Based on current records, no matching schemes were found. Your local ASHA worker can help check additional state programs.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {eligibilityResults.map((result) => {
                      const isExpanded = expandedSchemeId === result.schemeId;
                      const isEligible = result.status === "ELIGIBLE";
                      const isNeedsInfo = result.status === "NEEDS_INFORMATION";

                      return (
                        <div
                          key={result.schemeId}
                          className={`rounded-xl border transition-all ${
                            isEligible
                              ? "border-emerald-200 bg-white shadow-2xs"
                              : isNeedsInfo
                              ? "border-amber-200 bg-white shadow-2xs"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          {/* Scheme Card Header */}
                          <div
                            onClick={() =>
                              setExpandedSchemeId(isExpanded ? null : result.schemeId)
                            }
                            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/50 transition-colors rounded-xl"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  isEligible
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                    : isNeedsInfo
                                    ? "bg-amber-50 border border-amber-200 text-amber-700"
                                    : "bg-slate-50 border border-slate-200 text-slate-600"
                                }`}
                              >
                                <ShieldCheck className="w-5 h-5" />
                              </div>

                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                    {result.schemeName}
                                  </h3>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                  {result.benefitSummary || "Official government healthcare coverage."}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <span
                                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                                  isEligible
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isNeedsInfo
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                {isEligible
                                  ? "✓ You may be eligible"
                                  : isNeedsInfo
                                  ? "A few details are needed"
                                  : "Not eligible based on current info"}
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
                            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-slate-100 space-y-4 text-xs sm:text-sm">
                              {/* Why this applies */}
                              <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-1.5">
                                <span className="font-bold text-slate-800 block text-xs uppercase tracking-wide">
                                  Eligibility Explanation:
                                </span>
                                <p className="text-slate-600 leading-relaxed">
                                  {isEligible
                                    ? result.matchedRules.map((r) => r.explanation).filter(Boolean).join(". ") ||
                                      "Your household meets the verified age and categorical criteria for this scheme."
                                    : isNeedsInfo
                                    ? result.missingRequirements
                                        .map((m) => m.description || m.field)
                                        .filter(Boolean)
                                        .join(". ") ||
                                      "A few additional household details are required to complete this evaluation."
                                    : result.failedRules.map((r) => r.explanation).filter(Boolean).join(". ") ||
                                      "Your household details do not currently match the specific criteria for this scheme."}
                                </p>
                              </div>

                              {/* Beneficiary Tag */}
                              {isEligible && (
                                <div className="rounded-lg bg-emerald-50/70 p-3 border border-emerald-200 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="w-4 h-4 text-emerald-800 shrink-0" />
                                    <span className="font-semibold text-emerald-950 text-xs">
                                      {result.schemeId === "ab-pmjay"
                                        ? (() => {
                                            const senior = members.find((m) => m.age >= 70);
                                            return senior
                                              ? `Eligible Beneficiary: ${senior.fullName} (Age ${senior.age}, ${senior.relationship || "Member"})`
                                              : "Senior Citizen (70+) Entitlement";
                                          })()
                                        : result.schemeId === "jsy"
                                        ? (() => {
                                            const mom = members.find(
                                              (m) => m.gender === "female" && (m.maternalStatus === "pregnant" || (m.age >= 18 && m.age <= 45))
                                            );
                                            return mom
                                              ? `Eligible Beneficiary: ${mom.fullName} (${mom.maternalStatus === "pregnant" ? "Pregnant Mother" : "Maternal Care Candidate"}, Age ${mom.age})`
                                              : "Maternal Care Entitlement";
                                          })()
                                        : "Eligible Household Pathway"}
                                    </span>
                                  </div>
                                  <span className="text-[10px] uppercase font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded">
                                    Verified Criteria
                                  </span>
                                </div>
                              )}

                              {/* Next Required Action */}
                              {isEligible && (
                                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1">
                                  <span className="font-bold text-slate-800 block text-xs uppercase tracking-wide flex items-center gap-1.5">
                                    <ArrowRight className="w-3.5 h-3.5 text-teal-700" />
                                    <span>What you should do next:</span>
                                  </span>
                                  <p className="text-slate-600 text-xs leading-relaxed">
                                    {result.schemeId === "ab-pmjay"
                                      ? "Complete Aadhaar-based e-KYC and official PM-JAY registration at your nearest CSC kiosk or through your ASHA worker."
                                      : result.schemeId === "jsy"
                                      ? "Ensure Mother and Child Protection (MCP) card registration at your local Anganwadi/PHC and schedule your ANC checkup."
                                      : "Review required documents and initiate scheme registration."}
                                  </p>
                                </div>
                              )}

                              {/* Action Footer */}
                              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setActiveTab("actions")}
                                  className="text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  View Next Steps →
                                </Button>

                                {isEligible && (
                                  <>
                                    {connectionStatus?.status === "ACTIVE" ? (
                                      (() => {
                                        const existingReq = assistanceRequests.find(
                                          (r) =>
                                            r.schemeId === result.schemeId &&
                                            !["RESOLVED", "DECLINED", "CLOSED"].includes(r.status)
                                        );

                                        if (existingReq) {
                                          return (
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200 flex items-center gap-1">
                                                <Clock3 className="w-3.5 h-3.5 text-teal-700" />
                                                <span>Assistance: In Progress</span>
                                              </span>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActiveTab("asha-connection")}
                                                className="text-xs font-semibold border-teal-200 text-teal-800 hover:bg-teal-50"
                                              >
                                                Track Progress
                                              </Button>
                                            </div>
                                          );
                                        }

                                        const completedReq = assistanceRequests.find(
                                          (r) =>
                                            r.schemeId === result.schemeId &&
                                            ["RESOLVED", "CLOSED"].includes(r.status)
                                        );

                                        if (completedReq) {
                                          return (
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                                <span>Assistance Completed</span>
                                              </span>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActiveTab("asha-connection")}
                                                className="text-xs font-semibold border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                                              >
                                                View History
                                              </Button>
                                            </div>
                                          );
                                        }

                                        const matchedMem =
                                          result.schemeId === "ab-pmjay"
                                            ? members.find((m) => m.age >= 70)
                                            : result.schemeId === "jsy"
                                            ? members.find((m) => m.gender === "female" && (m.maternalStatus === "pregnant" || (m.age >= 18 && m.age <= 45)))
                                            : undefined;

                                        return (
                                          <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() =>
                                              handleOpenAssistanceModal(
                                                "SCHEME_ENROLLMENT",
                                                result.schemeId,
                                                result.schemeName,
                                                matchedMem?.id
                                              )
                                            }
                                            className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white"
                                          >
                                            <Send className="w-3.5 h-3.5 mr-1" /> Ask My ASHA for Help
                                          </Button>
                                        );
                                      })()
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">
                                          Need doorstep help?
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setActiveTab("asha-connection")}
                                          className="text-xs font-semibold border-teal-200 text-teal-800 hover:bg-teal-50"
                                        >
                                          <Link2 className="w-3.5 h-3.5 mr-1" /> Connect ASHA
                                        </Button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
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
            {/* TAB: NEXT STEPS (A6) */}
            {/* ============================================================ */}
            {activeTab === "actions" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Next Steps
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Your step-by-step guide to completing requirements and accessing healthcare benefits.
                  </p>
                </div>

                {!household ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs sm:text-sm text-slate-500 space-y-3">
                    <p className="font-semibold text-slate-800">Set up your household first</p>
                    <p className="max-w-sm mx-auto">
                      Complete household onboarding to generate your personalized action plan.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setHouseholdFormError(null);
                        setIsHouseholdModalOpen(true);
                      }}
                      className="text-xs font-semibold"
                    >
                      Set Up Household
                    </Button>
                  </div>
                ) : !guidance || !guidance.actionPlan || guidance.actionPlan.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 sm:p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h3 className="text-base font-bold text-slate-900">You're all caught up</h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        Your current healthcare actions and verified records are complete. No urgent steps are pending.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Priority Step 1 (CURRENT ACTION) */}
                    {guidance.actionPlan.length > 0 && (
                      <div className="rounded-xl border-2 border-teal-600 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                            Current Priority Step
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            Step 1 of {guidance.actionPlan.length}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-base sm:text-lg font-bold text-slate-900">
                            {guidance.actionPlan[0].title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {guidance.actionPlan[0].description}
                          </p>
                          {guidance.actionPlan[0].reason && (
                            <p className="text-xs text-teal-900 font-medium pt-1">
                              Why this matters: {guidance.actionPlan[0].reason}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          {connectionStatus?.status === "ACTIVE" ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenAssistanceModal("DOCUMENT_HELP")}
                              className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Request ASHA Assistance</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveTab("asha-connection")}
                              className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
                            >
                              Connect with ASHA for Help →
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Upcoming Steps */}
                    {guidance.actionPlan.length > 1 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Upcoming Steps ({guidance.actionPlan.length - 1})
                        </h4>
                        <div className="space-y-3">
                          {guidance.actionPlan.slice(1).map((action, index) => {
                            const stepNumber = index + 2;

                            return (
                              <div
                                key={action.id || index}
                                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                      {stepNumber}
                                    </div>
                                    <div>
                                      <h5 className="text-sm font-bold text-slate-900">
                                        {action.title}
                                      </h5>
                                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        {action.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Assistance trigger */}
                    {connectionStatus?.status === "ACTIVE" && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-700">
                          <p className="font-bold text-slate-900">Need help completing these steps?</p>
                          <p className="text-slate-600 mt-0.5">Your connected ASHA worker can assist you with forms and doorstep verification.</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAssistanceModal("DOCUMENT_HELP")}
                          className="text-xs font-semibold border-teal-200 text-teal-800 hover:bg-teal-50 whitespace-nowrap"
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
          <form onSubmit={handleHouseholdSubmit} className="space-y-5">
            {householdFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {householdFormError}
              </div>
            )}

            {/* Section 1: Household Head */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Household Head & Contact
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Head of Household Name"
                  required
                  value={householdForm.headOfHouseholdName}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, headOfHouseholdName: e.target.value })
                  }
                  placeholder="e.g. Ramesh Kumar"
                />
                <Input
                  label="Contact Phone"
                  value={householdForm.contactPhone}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, contactPhone: e.target.value })
                  }
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>

            {/* Section 2: Location */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Location Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="State"
                  required
                  value={householdForm.state}
                  onChange={(e) => setHouseholdForm({ ...householdForm, state: e.target.value })}
                  placeholder="e.g. Karnataka"
                />
                <Input
                  label="District"
                  required
                  value={householdForm.district}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, district: e.target.value })
                  }
                  placeholder="e.g. Bengaluru Rural"
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
                  placeholder="e.g. Devanahalli"
                />
                <Input
                  label="Postal Code (Pincode)"
                  required
                  value={householdForm.pincode}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, pincode: e.target.value })
                  }
                  placeholder="e.g. 562110"
                />
              </div>
            </div>

            {/* Section 3: Ration Details */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Ration & Identification
              </h4>
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
                  placeholder="e.g. KA-05-RC-987654"
                />
              </div>
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
          description="Enter member age and health profile details for entitlement evaluation."
        >
          <form onSubmit={handleMemberSubmit} className="space-y-4">
            {memberFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {memberFormError}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-3">
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
            </div>

            {/* Special Demographics */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                Healthcare Profile (Optional)
              </span>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer p-2 rounded-lg bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={memberForm.disabilityStatus}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, disabilityStatus: e.target.checked })
                  }
                  className="rounded text-teal-700 focus:ring-teal-700"
                />
                <span className="font-medium">Person with benchmark disability</span>
              </label>

              {memberForm.gender === "female" && (
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer p-2 rounded-lg bg-purple-50 border border-purple-200">
                  <input
                    type="checkbox"
                    checked={memberForm.maternalStatus === "pregnant"}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        maternalStatus: e.target.checked ? "pregnant" : "none",
                      })
                    }
                    className="rounded text-purple-700 focus:ring-purple-700"
                  />
                  <span className="font-medium text-purple-900">Currently pregnant or nursing mother</span>
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

            {/* Beneficiary Member Selector */}
            {members.length > 0 && (
              <Select
                label="Target Family Member (Beneficiary)"
                value={assistanceForm.beneficiaryMemberId}
                onChange={(e) =>
                  setAssistanceForm({
                    ...assistanceForm,
                    beneficiaryMemberId: e.target.value,
                  })
                }
                options={[
                  { value: "", label: "Entire Household / General" },
                  ...members.map((m) => ({
                    value: m.id,
                    label: `${m.fullName} (${m.relationship || "Member"}, Age ${m.age}${m.maternalStatus === "pregnant" ? ", Pregnant" : ""})`,
                  })),
                ]}
              />
            )}

            {/* Priority Selector */}
            <Select
              label="Urgency / Priority"
              value={assistanceForm.priority}
              onChange={(e) =>
                setAssistanceForm({
                  ...assistanceForm,
                  priority: e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT",
                })
              }
              options={[
                { value: "NORMAL", label: "Normal (Standard doorstep assistance)" },
                { value: "HIGH", label: "High (Upcoming hospital visit / deadline)" },
                { value: "URGENT", label: "Urgent (Immediate maternal / senior care)" },
                { value: "LOW", label: "Low (General enquiry)" },
              ]}
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

        {/* Phase 11 Real Voice / Calling Modal */}
        <CitizenCallModal
          isOpen={isVoiceCallModalOpen}
          onClose={() => setIsVoiceCallModalOpen(false)}
          defaultPhone={household?.contactPhone || userProfile?.phoneNumber || ""}
          householdHeadName={household?.headOfHouseholdName}
        />
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
