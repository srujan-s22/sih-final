"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { LanguageSelector } from "@/components/i18n/language-selector";
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
  const { userProfile, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
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
    if (authLoading || !isAuthenticated || userProfile?.role !== "CITIZEN") {
      return;
    }
    loadHouseholdData();
    loadConnectionStatus();
    loadAssistanceRequests();
    voiceService.getVoiceConfig().then((res) => {
      if (res.success && res.data) {
        setVoiceConfig(res.data);
      }
    });
  }, [authLoading, isAuthenticated, userProfile?.role, loadHouseholdData, loadConnectionStatus, loadAssistanceRequests]);

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
    { id: "overview", label: t("navigation.overview"), icon: Users },
    { id: "household", label: t("navigation.household"), icon: MapPin },
    { id: "family", label: t("navigation.family"), icon: Users },
    { id: "asha-connection", label: t("navigation.ashaConnect"), icon: UserCheck },
    { id: "support", label: t("navigation.schemes"), icon: ShieldCheck },
    { id: "actions", label: t("common.next"), icon: FileCheck },
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
            ? t("navigation.household")
            : activeTab === "family"
            ? t("navigation.family")
            : activeTab === "asha-connection"
            ? t("navigation.ashaConnect")
            : activeTab === "support"
            ? t("navigation.schemes")
            : activeTab === "actions"
            ? t("common.next")
            : t("citizen.welcome", { name: userProfile?.displayName || "Citizen" })
        }
        description={
          activeTab === "household"
            ? t("citizen.healthBenefitsDesc")
            : activeTab === "family"
            ? t("citizen.familyMembersDesc")
            : activeTab === "asha-connection"
            ? t("citizen.ashaSectionDesc")
            : activeTab === "support"
            ? t("citizen.healthBenefitsDesc")
            : activeTab === "actions"
            ? t("citizen.portalSubtitle")
            : t("citizen.portalSubtitle")
        }
        navTabs={navTabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        actions={
          <div className="flex items-center gap-2">
            <LanguageSelector size="sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssistantOpen(true)}
              className="text-xs flex items-center gap-1.5 border-teal-300 text-teal-800 hover:bg-teal-50 shadow-2xs font-semibold cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-teal-700" />
              <span>{t("citizen.healthcareAssistantBtn")}</span>
            </Button>
            {household && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadEligibility}
                disabled={isEvaluating}
                className="text-xs cursor-pointer"
              >
                {isEvaluating ? t("common.submitting") : t("citizen.recheckEligibilityBtn")}
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
              className="text-xs font-semibold cursor-pointer"
            >
              {!household ? t("citizen.setUpHouseholdBtn") : t("citizen.addMemberBtn")}
            </Button>
          </div>
        }
      >
        {/* Banner Alert Messages */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs sm:text-sm text-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">{t("common.notice")}</p>
              <p className="mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs text-rose-600 hover:text-rose-900 font-semibold cursor-pointer"
            >
              {t("common.dismiss")}
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
              <div className="space-y-6">
                {/* -------------------------------------------------------- */}
                {/* -------------------------------------------------------- */}
                {/* QUICK LANGUAGE SELECTOR BAR */}
                {/* -------------------------------------------------------- */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-teal-600" />
                    <span>{t("citizen.quickLangLabel")}</span>
                    <span className="text-slate-400 font-normal">{t("citizen.quickLangSubtitle")}</span>
                  </div>
                  <LanguageSelector variant="pills" size="sm" />
                </div>

                {/* -------------------------------------------------------- */}
                {/* SECTION 2: WHAT DO YOU NEED HELP WITH? */}
                {/* -------------------------------------------------------- */}
                <section className="space-y-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {t("citizen.helpSectionTitle")}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {t("citizen.helpSectionDesc")}
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
                              {t("citizen.schemesCountBadge", { count: eligibleCount })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                              {t("citizen.schemesTotalBadge", { count: eligibilityResults.length })}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                            {t("citizen.healthBenefits")}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {t("citizen.healthBenefitsDesc")}
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                        <span>{t("common.viewBenefits")}</span>
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
                            {t("citizen.memberCount", { count: members.length })}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                            {t("citizen.myFamilyCardTitle")}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {t("citizen.myFamilyCardDesc")}
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                        <span>{t("navigation.family")}</span>
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
                              {t("common.active")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              {t("citizen.connectButton")}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                            {t("citizen.ashaCardTitle")}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {connectionStatus?.status === "ACTIVE" && connectionStatus.asha
                              ? t("citizen.connectedAshaBanner", { name: connectionStatus.asha.displayName })
                              : t("citizen.ashaCardDesc")}
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                        <span>{t("citizen.requestAssistanceBtn")}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* -------------------------------------------------------- */}
                {/* -------------------------------------------------------- */}
                {/* SECTION 3: YOUR HEALTH BENEFITS */}
                {/* -------------------------------------------------------- */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        {t("citizen.healthBenefits")}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">
                        {t("citizen.healthBenefitsDesc")}
                      </p>
                    </div>
                    {eligibilityResults.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("support")}
                        className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50 cursor-pointer"
                      >
                        {t("common.viewBenefits")} ({eligibilityResults.length})
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
                          {t("citizen.setUpHouseholdBtn")}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500">
                          {t("home.step1Desc")}
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
                          className="text-xs font-semibold cursor-pointer"
                        >
                          {t("citizen.setUpHouseholdBtn")}
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
                          {t("citizen.addMemberBtn")}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500">
                          {t("citizen.familyMembersDesc")}
                        </p>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleOpenAddMember}
                          className="text-xs font-semibold cursor-pointer"
                        >
                          {t("citizen.addMemberBtn")}
                        </Button>
                      </div>
                    </div>
                  ) : eligibilityResults.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-3">
                      <div className="space-y-1 max-w-md mx-auto">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {t("citizen.noSchemesMessage")}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500">
                          {t("citizen.noSchemesMessage")}
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
                                  ? t("status.eligible")
                                  : result.status === "NEEDS_INFORMATION"
                                  ? t("status.action_required")
                                  : t("status.declined")}
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
                              className="text-xs font-semibold text-teal-700 hover:text-teal-900 transition-colors cursor-pointer"
                            >
                              {t("common.viewDetails")} →
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
                                className="text-xs border-teal-200 text-teal-800 hover:bg-teal-50 font-medium py-1 px-2.5 cursor-pointer"
                              >
                                {t("citizen.requestAssistanceBtn")}
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
                      {t("citizen.stepGuideTitle")}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {t("citizen.stepGuideSubtitle")}
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
                              className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{t("citizen.requestAssistanceBtn")}</span>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("actions")}
                            className="text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {t("citizen.viewActionPlanBtn")} ({guidance.actionPlan.length})
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
                            {t("status.completed")}
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {t("citizen.portalSubtitle")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("actions")}
                        className="text-xs font-semibold text-emerald-800 border-emerald-200 hover:bg-emerald-50 shrink-0 cursor-pointer"
                      >
                        {t("citizen.viewActionPlanBtn")}
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
                          <span>{t("citizen.ashaSectionTitle")}</span>
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("asha-connection")}
                          className="text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50 cursor-pointer"
                        >
                          {t("common.viewDetails")}
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
                              {t("common.code")}: {connectionStatus.asha.serviceCode}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed pt-1">
                            {t("citizen.connectedAshaBanner", { name: connectionStatus.asha.displayName })}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
                          <p className="font-semibold text-slate-900">
                            {t("citizen.connectAshaPrompt")}
                          </p>
                          <p className="leading-relaxed">
                            {t("citizen.ashaCardDesc")}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("asha-connection")}
                            className="text-xs font-semibold mt-1 cursor-pointer"
                          >
                            {t("citizen.connectButton")}
                          </Button>
                        </div>
                      )}
                    </div>

                    {connectionStatus?.status === "ACTIVE" && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {pendingAssistanceCount > 0
                            ? t("citizen.activeAssistanceCount", { count: pendingAssistanceCount })
                            : t("citizen.helpSectionTitle")}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAssistanceModal("SCHEME_ENROLLMENT")}
                          className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> {t("citizen.requestAssistanceBtn")}
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
                          <span>{t("common.help")}</span>
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          24/7 Helpline
                        </span>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs text-slate-600">
                        <p className="font-semibold text-slate-900">
                          {t("voice.helplineTitle")}
                        </p>
                        <p className="leading-relaxed">
                          {t("voice.helplineDesc")}
                        </p>
                        <div className="pt-2 flex items-center gap-2">
                          <div className="bg-white px-3 py-1.5 rounded-md border border-slate-200">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                              {voiceConfig?.isTollFree ? "Toll-Free Helpline" : "Helpline Number"}
                            </span>
                            <a
                              href={`tel:${voiceConfig?.virtualNumber || "+918047283240"}`}
                              className="font-mono text-xs sm:text-sm font-bold text-slate-900 tracking-wider hover:text-teal-800 transition-colors"
                            >
                              {voiceConfig?.displayHelplineText || "08047283240"}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAssistantOpen(true)}
                        className="text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5 text-teal-700" />
                        <span>{t("citizen.healthcareAssistantBtn")}</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setIsVoiceCallModalOpen(true)}
                        className="bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 py-1.5 px-3 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{t("citizen.voiceCallBtn")}</span>
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
                      {t("navigation.household")}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {t("citizen.healthBenefitsDesc")}
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
                      className="text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto text-teal-800 border-teal-200 hover:bg-teal-50 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{t("citizen.editHouseholdBtn")}</span>
                    </Button>
                  )}
                </div>

                {!household ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h3 className="text-base font-bold text-slate-900">{t("citizen.setUpHouseholdBtn")}</h3>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                        {t("home.step1Desc")}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setHouseholdFormError(null);
                        setIsHouseholdModalOpen(true);
                      }}
                      className="font-semibold shadow-xs cursor-pointer"
                    >
                      {t("citizen.setUpHouseholdBtn")}
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
                            {t("citizen.headOfHousehold")}
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900">
                            {household.headOfHouseholdName}
                          </h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                            {t("citizen.incomeCategory")}
                          </span>
                          <span className="text-sm font-bold text-teal-900 block">
                            {household.incomeCategory === "BPL"
                              ? t("forms.categoryBPL")
                              : household.incomeCategory === "AAY"
                              ? t("forms.categoryAntyodaya")
                              : household.incomeCategory === "APL"
                              ? t("forms.categoryAPL")
                              : household.incomeCategory}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                            {t("citizen.contactPhoneLabel")}
                          </span>
                          <span className="font-mono text-sm font-bold text-slate-900 block">
                            {household.contactPhone || t("common.notAvailable")}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                            {t("citizen.rationCardNumber")}
                          </span>
                          <span className="font-mono text-sm font-bold text-slate-900 block">
                            {household.rationCardNumber || t("common.notAvailable")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Location Details Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-700" />
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {t("citizen.locationDetails")}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                            {t("citizen.villageLabel")}
                          </span>
                          <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                            {household.village || t("common.notAvailable")}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                            {t("citizen.districtLabel")}
                          </span>
                          <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                            {household.district}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                            {t("citizen.stateLabel")}
                          </span>
                          <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                            {household.state}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                            {t("citizen.pincodeLabel")}
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
                          {t("citizen.familyMembersTitle")}
                        </h4>
                        <p className="text-xs text-slate-600">
                          {t("citizen.memberCount", { count: members.length })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("family")}
                          className="text-xs font-semibold text-teal-800 border-teal-300 hover:bg-teal-50 cursor-pointer"
                        >
                          {t("navigation.family")} →
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleOpenAddMember}
                          className="text-xs font-semibold cursor-pointer"
                        >
                          {t("citizen.addMemberBtn")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* ============================================================ */}
            {/* TAB: FAMILY MEMBERS (A3) */}
            {/* ============================================================ */}
            {activeTab === "family" && (
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {t("citizen.familyMembersTitle")} ({members.length})
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {t("citizen.familyMembersDesc")}
                    </p>
                  </div>
                  {household && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleOpenAddMember}
                      className="text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("citizen.addMemberBtn")}</span>
                    </Button>
                  )}
                </div>

                {!household ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-xs sm:text-sm text-slate-500 space-y-3">
                    <p>{t("citizen.setUpHouseholdBtn")}</p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setHouseholdFormError(null);
                        setIsHouseholdModalOpen(true);
                      }}
                      className="text-xs font-semibold cursor-pointer"
                    >
                      {t("citizen.setUpHouseholdBtn")}
                    </Button>
                  </div>
                ) : members.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h4 className="text-base font-bold text-slate-900">{t("citizen.familyMembersTitle")}</h4>
                      <p className="text-xs sm:text-sm text-slate-500">
                        {t("citizen.familyMembersDesc")}
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button variant="primary" size="sm" onClick={handleOpenAddMember} className="text-xs font-semibold cursor-pointer">
                        {t("citizen.addMemberBtn")}
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
                                    {m.relationship || t("common.member")}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditMember(m)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                                  title={t("citizen.editMemberBtn")}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRemovingMember(m)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title={t("citizen.removeMemberBtn")}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Demographics details */}
                            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">{t("forms.age")} & {t("forms.gender")}:</span>
                                <span className="font-semibold text-slate-800 capitalize">
                                  {t("citizen.ageYears", { age: m.age })} • {m.gender}
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
                                    {t("citizen.pregnantLabel")}
                                  </span>
                                )}
                                {isDisability && (
                                  <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                    {t("citizen.disabilityLabel")}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => handleOpenEditMember(m)}
                              className="font-semibold text-teal-700 hover:text-teal-900 transition-colors cursor-pointer"
                            >
                              {t("common.edit")}
                            </button>
                            {connectionStatus?.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => handleOpenAssistanceModal("SCHEME_ENROLLMENT", undefined, undefined, m.id)}
                                className="font-medium text-slate-600 hover:text-teal-800 transition-colors cursor-pointer"
                              >
                                {t("citizen.requestAssistanceBtn")} →
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
            {/* ============================================================ */}
            {/* TAB: MY ASHA WORKER (A4) */}
            {/* ============================================================ */}
            {activeTab === "asha-connection" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    {t("citizen.ashaSectionTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {t("citizen.ashaSectionDesc")}
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
                              ✓ {t("common.active")}
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
                            {t("common.code")}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-800">
                            {connectionStatus.asha.serviceCode}
                          </span>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAssistanceModal()}
                          className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{t("citizen.requestAssistanceBtn")}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {t("citizen.connectedAshaBanner", { name: connectionStatus.asha.displayName })}
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
                            {t("citizen.connectionPendingApproval")}
                          </h4>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            {t("status.pending")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {t("common.code")}: <span className="font-mono font-semibold">{connectionStatus.asha.serviceCode}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONNECT WITH ASHA CODE FORM */}
                {(connectionStatus?.status === "NONE" || connectionStatus?.status === "REJECTED" || !connectionStatus) && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {t("citizen.connectAshaPrompt")}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t("citizen.enterServiceCode")}
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
                        className="text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        {isResolvingAsha ? t("common.submitting") : t("citizen.connectButton")}
                      </Button>
                    </form>
                  </div>
                )}

                {/* ASSISTANCE REQUESTS HISTORY */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-teal-700" />
                        <span>{t("citizen.assistanceHistoryTitle")}</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t("citizen.stepGuideSubtitle")}
                      </p>
                    </div>
                    {connectionStatus?.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAssistanceModal()}
                        className="text-xs font-semibold border-teal-200 text-teal-800 hover:bg-teal-50 cursor-pointer"
                      >
                        + {t("citizen.requestAssistanceBtn")}
                      </Button>
                    )}
                  </div>

                  {assistanceRequests.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700">{t("citizen.noAssistanceRequests")}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {assistanceRequests.map((req) => {
                        const isResolved = req.status === "RESOLVED" || req.status === "CLOSED";
                        const isDeclined = req.status === "DECLINED";
                        const isPmjay = req.schemeId === "ab-pmjay";
                        const isJsy = req.schemeId === "jsy";

                        const getCategoryLabel = (category: string) => {
                          switch (category) {
                            case "SCHEME_ENROLLMENT":
                              return t("citizen.categorySchemeEnrollment");
                            case "DOCUMENT_HELP":
                              return t("citizen.categoryDocHelp");
                            case "FACILITY_ACCESS":
                              return t("citizen.categoryFacilityAccess");
                            case "ELIGIBILITY_CLARIFICATION":
                              return t("citizen.categoryEligibilityClarification");
                            case "FOLLOW_UP":
                              return t("citizen.categoryFollowUp");
                            case "OTHER":
                            default:
                              return t("citizen.categoryOther");
                          }
                        };

                        const steps = isPmjay
                          ? [
                              t("citizen.stepEligibilityIdentified"),
                              t("citizen.stepIdentityConfirmed"),
                              t("citizen.stepEkycEnrollment"),
                              t("citizen.stepAppSubmitted"),
                              t("citizen.stepCardIssued"),
                              t("citizen.stepHospitalAccess"),
                              t("citizen.stepResolved"),
                            ]
                          : isJsy
                          ? [
                              t("citizen.stepPregnancyConfirmed"),
                              t("citizen.stepIdentityConfirmed"),
                              t("citizen.stepMcpRegistration"),
                              t("citizen.stepFacilityMapped"),
                              t("citizen.stepDeliveryCare"),
                              t("citizen.stepPostnatalCare"),
                              t("citizen.stepDbtTransfer"),
                              t("citizen.stepResolved"),
                            ]
                          : [
                              t("citizen.stepRequestSubmitted"),
                              t("citizen.stepAshaAccepted"),
                              t("citizen.stepDoorstepHelp"),
                              t("citizen.stepResolved"),
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
                                    <span>{t("citizen.doorstepHelpFrom", { name: req.ashaName || "ASHA" })}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                                    {getCategoryLabel(req.category)}
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
                                    ? `✓ ${t("status.completed")}`
                                    : isDeclined
                                    ? `✕ ${t("status.declined")}`
                                    : req.status === "ACCEPTED"
                                    ? `✓ ${t("status.in_progress")}`
                                    : req.status === "IN_PROGRESS"
                                    ? `● ${t("status.in_progress")}`
                                    : `⏳ ${t("citizen.awaitingReviewBadge")}`}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {new Date(req.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2 text-xs">
                              <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                                <span className="font-bold text-slate-500 block text-[10px] uppercase mb-0.5">
                                  {req.initiatedBy === "ASHA" ? t("citizen.ashaNoteLabel") : t("citizen.yourRequestLabel")}
                                </span>
                                {req.message}
                              </p>

                              {/* Simple Step Progress Indicator */}
                              <div className="mt-3 pt-2 border-t border-slate-100">
                                <span className="text-[11px] font-semibold text-slate-600 block mb-2">
                                  {t("citizen.stepGuideTitle")}:
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
                                  ? t("status.eligible")
                                  : isNeedsInfo
                                  ? t("status.action_required")
                                  : t("status.declined")}
                              </span>

                              <button
                                type="button"
                                aria-label="Toggle details"
                                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
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
                                  {t("citizen.healthBenefits")}
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
                                              ? `${t("forms.relGrandparent")}: ${senior.fullName} (${t("citizen.ageYears", { age: senior.age })})`
                                              : "Senior Citizen (70+) Entitlement";
                                          })()
                                        : result.schemeId === "jsy"
                                        ? (() => {
                                            const mom = members.find(
                                              (m) => m.gender === "female" && (m.maternalStatus === "pregnant" || (m.age >= 18 && m.age <= 45))
                                            );
                                            return mom
                                              ? `${t("citizen.pregnantLabel")}: ${mom.fullName} (${t("citizen.ageYears", { age: mom.age })})`
                                              : "Maternal Care Entitlement";
                                          })()
                                        : t("citizen.coverageVerified")}
                                    </span>
                                  </div>
                                  <span className="text-[10px] uppercase font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded">
                                    {t("status.verified")}
                                  </span>
                                </div>
                              )}

                              {/* Next Required Action */}
                              {isEligible && (
                                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1">
                                  <span className="font-bold text-slate-800 block text-xs uppercase tracking-wide flex items-center gap-1.5">
                                    <ArrowRight className="w-3.5 h-3.5 text-teal-700" />
                                    <span>{t("citizen.stepGuideTitle")}:</span>
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
                                  className="text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  {t("citizen.viewActionPlanBtn")} →
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
                                                <span>{t("status.in_progress")}</span>
                                              </span>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActiveTab("asha-connection")}
                                                className="text-xs font-semibold border-teal-200 text-teal-800 hover:bg-teal-50 cursor-pointer"
                                              >
                                                {t("common.track")}
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
                                                <span>{t("status.completed")}</span>
                                              </span>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActiveTab("asha-connection")}
                                                className="text-xs font-semibold border-emerald-200 text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                                              >
                                                {t("citizen.assistanceHistoryTitle")}
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
                                            className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white cursor-pointer"
                                          >
                                            <Send className="w-3.5 h-3.5 mr-1" /> {t("citizen.requestAssistanceBtn")}
                                          </Button>
                                        );
                                      })()
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">
                                          {t("citizen.helpSectionTitle")}
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setActiveTab("asha-connection")}
                                          className="text-xs font-semibold border-teal-200 text-teal-800 hover:bg-teal-50 cursor-pointer"
                                        >
                                          <Link2 className="w-3.5 h-3.5 mr-1" /> {t("citizen.connectButton")}
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
                    {t("navigation.nextSteps")}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {t("citizen.stepGuideSubtitle")}
                  </p>
                </div>

                {!household ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs sm:text-sm text-slate-500 space-y-3">
                    <p className="font-semibold text-slate-800">{t("citizen.setUpHouseholdBtn")}</p>
                    <p className="max-w-sm mx-auto">
                      {t("home.step1Desc")}
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setHouseholdFormError(null);
                        setIsHouseholdModalOpen(true);
                      }}
                      className="text-xs font-semibold cursor-pointer"
                    >
                      {t("citizen.setUpHouseholdBtn")}
                    </Button>
                  </div>
                ) : !guidance || !guidance.actionPlan || guidance.actionPlan.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 sm:p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h3 className="text-base font-bold text-slate-900">{t("status.completed")}</h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {t("citizen.portalSubtitle")}
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
                            {t("status.urgent")}
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
        {/* ============================================================ */}
        {/* MODALS */}
        {/* ============================================================ */}

        {/* Modal: Setup / Edit Household */}
        <Modal
          isOpen={isHouseholdModalOpen}
          onClose={() => setIsHouseholdModalOpen(false)}
          title={household ? t("citizen.editHouseholdBtn") : t("citizen.setUpHouseholdBtn")}
          description={t("citizen.healthBenefitsDesc")}
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
                {t("citizen.headOfHousehold")} & {t("citizen.contactPhoneLabel")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t("citizen.headOfHousehold")}
                  required
                  value={householdForm.headOfHouseholdName}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, headOfHouseholdName: e.target.value })
                  }
                  placeholder="e.g. Ramesh Kumar"
                />
                <Input
                  label={t("citizen.contactPhoneLabel")}
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
                {t("citizen.locationDetails")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t("citizen.stateLabel")}
                  required
                  value={householdForm.state}
                  onChange={(e) => setHouseholdForm({ ...householdForm, state: e.target.value })}
                  placeholder="e.g. Karnataka"
                />
                <Input
                  label={t("citizen.districtLabel")}
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
                  label={t("citizen.villageLabel")}
                  required
                  value={householdForm.village}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, village: e.target.value })
                  }
                  placeholder="e.g. Devanahalli"
                />
                <Input
                  label={t("citizen.pincodeLabel")}
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
                {t("citizen.incomeCategory")} & {t("citizen.rationCardNumber")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label={t("citizen.incomeCategory")}
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
                  label={t("citizen.rationCardNumber")}
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
                className="cursor-pointer"
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={householdSubmitting} className="cursor-pointer">
                {householdSubmitting ? t("common.submitting") : t("common.save")}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Add / Edit Family Member */}
        <Modal
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          title={editingMemberId ? t("citizen.editMemberBtn") : t("citizen.addMemberBtn")}
          description={t("citizen.familyMembersDesc")}
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
                label={t("forms.fullName")}
                required
                value={memberForm.fullName}
                onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })}
                placeholder="e.g. Sita Devi"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label={t("forms.age")}
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
                  label={t("forms.gender")}
                  value={memberForm.gender}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, gender: e.target.value as Gender })
                  }
                  options={GENDER_OPTIONS}
                />
                <Select
                  label={t("forms.relationship")}
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
                {t("forms.healthCondition")}
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
                <span className="font-medium">{t("citizen.disabilityLabel")}</span>
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
                  <span className="font-medium text-purple-900">{t("citizen.pregnantLabel")}</span>
                </label>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMemberModalOpen(false)}
                className="cursor-pointer"
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={memberSubmitting} className="cursor-pointer">
                {memberSubmitting ? t("common.submitting") : t("common.save")}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Remove Member Confirmation */}
        <Modal
          isOpen={Boolean(removingMember)}
          onClose={() => setRemovingMember(null)}
          title={t("citizen.removeMemberBtn")}
          description={removingMember ? t("dialogs.removeMemberConfirm", { name: removingMember.fullName }) : ""}
        >
          <div className="pt-4 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemovingMember(null)}
              className="cursor-pointer"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleConfirmRemoveMember}
              disabled={removeSubmitting}
              className="bg-rose-600 text-white hover:bg-rose-700 border-rose-600 cursor-pointer"
            >
              {removeSubmitting ? t("common.submitting") : t("common.delete")}
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
          title={t("citizen.ashaSectionTitle")}
          description={t("citizen.ashaSectionDesc")}
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
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">{t("common.code")}</span>
                    <span className="font-mono font-bold text-slate-800">{resolvedAsha.serviceCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">{t("asha.coverageArea")}</span>
                    <span className="text-slate-700">{resolvedAsha.serviceArea || "Village Jurisdiction"}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-teal-50/70 rounded-lg border border-teal-200 text-xs text-teal-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  {t("citizen.connectedAshaBanner", { name: resolvedAsha.displayName })}
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
                  className="cursor-pointer"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirmConnection}
                  disabled={isConnecting}
                  className="font-semibold cursor-pointer"
                >
                  {isConnecting ? t("common.submitting") : t("citizen.connectButton")}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal: Request ASHA Assistance */}
        <Modal
          isOpen={isAssistanceModalOpen}
          onClose={() => setIsAssistanceModalOpen(false)}
          title={t("citizen.requestAssistanceBtn")}
          description={t("citizen.ashaCardDesc")}
        >
          <form onSubmit={handleAssistanceSubmit} className="space-y-4">
            {assistanceError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {assistanceError}
              </div>
            )}

            <Select
              label={t("forms.assistanceType")}
              value={assistanceForm.category}
              onChange={(e) =>
                setAssistanceForm({
                  ...assistanceForm,
                  category: e.target.value as AssistanceCategory,
                })
              }
              options={ASSISTANCE_CATEGORIES}
            />

            {/* Priority Selector */}
            <Select
              label={t("forms.priority")}
              value={assistanceForm.priority}
              onChange={(e) =>
                setAssistanceForm({
                  ...assistanceForm,
                  priority: e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT",
                })
              }
              options={[
                { value: "NORMAL", label: t("forms.priorityNormal") },
                { value: "HIGH", label: t("forms.priorityHigh") },
                { value: "URGENT", label: t("forms.priorityUrgent") },
                { value: "LOW", label: t("forms.priorityLow") },
              ]}
            />

            {assistanceForm.schemeName && (
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-xs text-teal-900">
                <span className="font-bold block uppercase text-[10px]">{t("citizen.healthBenefits")}:</span>
                <span className="font-semibold">{assistanceForm.schemeName}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t("forms.notes")} *
              </label>
              <textarea
                required
                rows={4}
                value={assistanceForm.message}
                onChange={(e) =>
                  setAssistanceForm({ ...assistanceForm, message: e.target.value })
                }
                placeholder={t("forms.notesPlaceholder")}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssistanceModalOpen(false)}
                className="cursor-pointer"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={assistanceSubmitting || !assistanceForm.message.trim()}
                className="bg-teal-800 hover:bg-teal-900 text-white font-semibold cursor-pointer"
              >
                {assistanceSubmitting ? t("common.submitting") : t("citizen.requestAssistanceBtn")}
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
          <span>{t("citizen.healthcareAssistantBtn")}</span>
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
