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

export default function CitizenPage() {
  const { userProfile } = useAuth();

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

  useEffect(() => {
    loadHouseholdData();
  }, [loadHouseholdData]);

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
      gender: "male",
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

  const navTabs = [
    { id: "overview", label: "Overview", icon: Users },
    { id: "household", label: "My Household", icon: MapPin },
    { id: "family", label: "Family Members", icon: Users },
    { id: "support", label: "Healthcare Support", icon: ShieldCheck },
    { id: "actions", label: "Next Steps", icon: FileCheck },
  ];

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  return (
    <ProtectedRoute allowedRoles={["CITIZEN"]}>
      <AuthenticatedShell
        role="CITIZEN"
        title={`Welcome, ${userProfile?.displayName || "Citizen"}`}
        description="Let's check what official government healthcare schemes your family may be eligible for."
        navTabs={navTabs}
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
              <p className="font-bold">Error</p>
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
            {/* Status Indicator Banner */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    household ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {household ? <CheckCircle2 className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Household Profile Status
                  </p>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {household
                      ? `Profile Complete (${members.length} member${members.length === 1 ? "" : "s"})`
                      : "Household Profile Needs Setup"}
                  </h3>
                </div>
              </div>

              {!household ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setHouseholdFormError(null);
                    setIsHouseholdModalOpen(true);
                  }}
                  className="font-semibold shadow-xs"
                >
                  Set Up Household Now
                </Button>
              ) : (
                <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Government Criteria Evaluated</span>
                </div>
              )}
            </div>

            {/* SECTION 1 — YOUR HOUSEHOLD */}
            <section id="household" className="space-y-4 scroll-mt-24">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    1. Your Household
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
                    className="text-xs flex items-center gap-1.5"
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
                    <p className="text-sm font-bold text-teal-800">
                      {household.incomeCategory}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Ration Card
                    </span>
                    <p className="text-sm font-mono text-slate-700">
                      {household.rationCardNumber ? household.rationCardNumber : "Not provided"}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* SECTION 2 — YOUR FAMILY MEMBERS */}
            <section id="family" className="space-y-4 scroll-mt-24">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    2. Your Family Members
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Each family member is evaluated for age, maternal, and senior-specific entitlements.
                  </p>
                </div>
                {household && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAddMember}
                    className="text-xs flex items-center gap-1.5"
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
                  <p className="text-sm font-medium text-slate-700">No family members registered yet.</p>
                  <Button variant="outline" size="sm" onClick={handleOpenAddMember}>
                    + Add First Family Member
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map((m) => {
                    const isSenior = m.age >= 70;
                    return (
                      <div
                        key={m.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {m.fullName}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleOpenEditMember(m)}
                                aria-label={`Edit ${m.fullName}`}
                                className="p-1 text-slate-400 hover:text-teal-800 rounded transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setRemovingMember(m)}
                                aria-label={`Remove ${m.fullName}`}
                                className="p-1 text-slate-400 hover:text-rose-700 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="text-xs text-slate-600 space-y-0.5">
                            <p>
                              <span className="text-slate-400">Relation:</span>{" "}
                              <strong className="font-semibold text-slate-800">{m.relationship}</strong>
                            </p>
                            <p>
                              <span className="text-slate-400">Age:</span>{" "}
                              <strong className="font-semibold text-slate-800">{m.age} years</strong> ({m.gender})
                            </p>
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

            {/* SECTION 3 — HEALTHCARE SUPPORT (MOST IMPORTANT) */}
            <section id="support" className="space-y-4 scroll-mt-24">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    3. Healthcare Support Identified
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
                                    "SwasthyaSetu requires additional details (such as delivery facility or registration records) to evaluate this pathway."
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
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECTION 4 — WHAT TO DO NEXT (ACTION PLAN) */}
            <section id="actions" className="space-y-4 scroll-mt-24">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  4. What To Do Next
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Clear, prioritized steps to unlock and access your healthcare benefits.
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
              )}
            </section>
          </div>
        )}

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
