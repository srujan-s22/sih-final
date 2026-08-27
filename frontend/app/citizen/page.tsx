"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { Shell } from "@/components/layout/shell";
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
  Home,
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
  Sparkles,
  FileCheck,
  ArrowRight,
  Info,
} from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Household Form State
  const [isEditingHousehold, setIsEditingHousehold] = useState(false);
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
    chronicConditions: [],
  });
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);

  // Remove Member State
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  // Scheme Details Disclosure State
  const [expandedSchemeId, setExpandedSchemeId] = useState<string | null>(null);

  // Healthcare Access Guidance State (Phase 5)
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);

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
      // Non-blocking for portal view
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

          // Fetch deterministic scheme evaluations and guidance
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
        // Update
        const res = await householdService.updateHousehold(householdForm);
        if (res.success) {
          setHousehold(res.data.household);
          setIsEditingHousehold(false);
          setSuccessMessage("Household details updated successfully.");
          await loadEligibility();
        } else {
          setHouseholdFormError(res.error.message);
        }
      } else {
        // Create
        const res = await householdService.createHousehold(householdForm);
        if (res.success) {
          setHousehold(res.data.household);
          setIsEditingHousehold(false);
          setSuccessMessage("Household profile created successfully.");
          await loadEligibility();
        } else {
          setHouseholdFormError(res.error.message);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save household.";
      setHouseholdFormError(msg);
    } finally {
      setHouseholdSubmitting(false);
    }
  };

  // Open Member Modal for Create
  const handleOpenAddMember = () => {
    setEditingMemberId(null);
    setMemberForm({
      fullName: "",
      age: 18,
      gender: "female",
      relationship: "Spouse",
      disabilityStatus: false,
      chronicConditions: [],
    });
    setMemberFormError(null);
    setIsMemberModalOpen(true);
  };

  // Open Member Modal for Edit
  const handleOpenEditMember = (member: Member) => {
    setEditingMemberId(member.id);
    setMemberForm({
      fullName: member.fullName,
      age: member.age,
      gender: member.gender,
      relationship: member.relationship,
      disabilityStatus: member.disabilityStatus,
      chronicConditions: member.chronicConditions,
    });
    setMemberFormError(null);
    setIsMemberModalOpen(true);
  };

  // Handle Member Submit (Add or Edit)
  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberFormError(null);
    setMemberSubmitting(true);

    const payload: CreateMemberInput = {
      ...memberForm,
      age: Number(memberForm.age),
      chronicConditions: memberForm.chronicConditions || [],
    };

    try {
      if (editingMemberId) {
        const res = await householdService.updateMember(editingMemberId, payload);
        if (res.success) {
          setMembers((prev) =>
            prev.map((m) => (m.id === editingMemberId ? res.data.member : m))
          );
          setIsMemberModalOpen(false);
          setSuccessMessage("Member details updated.");
          await loadEligibility();
        } else {
          setMemberFormError(res.error.message);
        }
      } else {
        const res = await householdService.addMember(payload);
        if (res.success) {
          setMembers((prev) => [...prev, res.data.member]);
          setIsMemberModalOpen(false);
          setSuccessMessage("Family member added.");
          await loadEligibility();
        } else {
          setMemberFormError(res.error.message);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save member.";
      setMemberFormError(msg);
    } finally {
      setMemberSubmitting(false);
    }
  };

  // Handle Member Delete
  const handleConfirmRemoveMember = async () => {
    if (!removingMember) return;
    setRemoveSubmitting(true);
    try {
      const res = await householdService.deleteMember(removingMember.id);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== removingMember.id));
        setRemovingMember(null);
        setSuccessMessage("Member removed from household.");
        await loadEligibility();
      }
    } catch {
      setError("Failed to remove member. Please try again.");
    } finally {
      setRemoveSubmitting(false);
    }
  };

  const citizenDisplayName =
    userProfile?.displayName || userProfile?.email?.split("@")[0] || "Citizen";

  const eligibleCount = eligibilityResults.filter((r) => r.status === "ELIGIBLE").length;

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={["CITIZEN", "ASHA", "ADMIN"]}>
        <Shell className="py-12">
          <LoadingState message="Loading your household information..." />
        </Shell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["CITIZEN", "ASHA", "ADMIN"]}>
      <Shell className="py-6 sm:py-8 space-y-6 sm:space-y-8 max-w-4xl">
        {/* Top Greeting & Action Purpose */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Welcome, {citizenDisplayName}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Let&apos;s make sure your household can access the healthcare support it may be eligible for.
            </p>
          </div>

          {/* Setup Progress Summary Chips */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                household
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {household ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Household Set Up</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Setup Needed</span>
                </>
              )}
            </span>

            {household && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                <Users className="w-3.5 h-3.5 text-teal-700" />
                <span>
                  {members.length} {members.length === 1 ? "Member" : "Members"}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Global Feedback Notifications */}
        {error && (
          <div
            role="alert"
            className="p-3.5 text-xs sm:text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadHouseholdData}
              className="h-7 text-xs shrink-0"
            >
              Try again
            </Button>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="p-3.5 text-xs sm:text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs shrink-0 p-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TASK 1: YOUR HOUSEHOLD */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                  Task 1
                </span>
                <h2 className="text-base font-bold text-slate-900">Your household</h2>
              </div>
            </div>

            {household && !isEditingHousehold && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingHousehold(true)}
                className="h-8 text-xs px-3 flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
            )}
          </div>

          {!household && !isEditingHousehold ? (
            /* Empty State */
            <div className="py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-slate-600 max-w-md">
                Add your household details to discover which healthcare schemes your family may qualify for.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsEditingHousehold(true)}
                className="shrink-0 font-semibold"
              >
                Set up household
              </Button>
            </div>
          ) : isEditingHousehold ? (
            /* Form: Create or Edit */
            <form onSubmit={handleHouseholdSubmit} className="space-y-4 pt-1">
              {householdFormError && (
                <div
                  role="alert"
                  className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md"
                >
                  {householdFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Head of Household"
                  placeholder="e.g. Ramesh Kumar"
                  value={householdForm.headOfHouseholdName}
                  onChange={(e) =>
                    setHouseholdForm({
                      ...householdForm,
                      headOfHouseholdName: e.target.value,
                    })
                  }
                  required
                />

                <Input
                  label="Ration Card Number"
                  placeholder="e.g. RC-BR-2026-1002"
                  value={householdForm.rationCardNumber}
                  onChange={(e) =>
                    setHouseholdForm({
                      ...householdForm,
                      rationCardNumber: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Income Category"
                  options={INCOME_OPTIONS}
                  value={householdForm.incomeCategory}
                  onChange={(e) =>
                    setHouseholdForm({
                      ...householdForm,
                      incomeCategory: e.target.value as IncomeCategory,
                    })
                  }
                  required
                />

                <Input
                  label="Contact Phone (Optional)"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={householdForm.contactPhone || ""}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, contactPhone: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="State"
                  placeholder="e.g. Bihar"
                  value={householdForm.state}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, state: e.target.value })
                  }
                  required
                />

                <Input
                  label="District"
                  placeholder="e.g. Patna"
                  value={householdForm.district}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, district: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Village / Town"
                  placeholder="e.g. Bakhtiyarpur"
                  value={householdForm.village}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, village: e.target.value })
                  }
                  required
                />

                <Input
                  label="Pincode"
                  placeholder="6-digit postal code"
                  value={householdForm.pincode}
                  onChange={(e) =>
                    setHouseholdForm({ ...householdForm, pincode: e.target.value })
                  }
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                {household && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingHousehold(false)}
                    disabled={householdSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={householdSubmitting}
                  className="w-full sm:w-auto font-semibold"
                >
                  {householdSubmitting ? "Saving..." : "Save details"}
                </Button>
              </div>
            </form>
          ) : (
            /* Summary Row */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3.5 gap-x-6 text-xs sm:text-sm pt-1">
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-slate-500 text-xs font-medium">Head of Household</span>
                  <span className="font-semibold text-slate-900">{household?.headOfHouseholdName}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CreditCard className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-slate-500 text-xs font-medium">Ration Card</span>
                  <span className="font-mono text-slate-900 font-medium">{household?.rationCardNumber}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-slate-500 text-xs font-medium">Income Tier</span>
                  <span className="font-semibold text-teal-800">{household?.incomeCategory}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 sm:col-span-2">
                <MapPin className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-slate-500 text-xs font-medium">Address</span>
                  <span className="text-slate-800 font-medium">
                    {household?.village}, {household?.district}, {household?.state} — {household?.pincode}
                  </span>
                </div>
              </div>

              {household?.contactPhone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                  <div>
                    <span className="block text-slate-500 text-xs font-medium">Contact Phone</span>
                    <span className="text-slate-800 font-medium">{household.contactPhone}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TASK 2: FAMILY MEMBERS */}
        {household && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                    Task 2
                  </span>
                  <h2 className="text-base font-bold text-slate-900">Family members</h2>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAddMember}
                className="h-8 text-xs px-3 font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add member</span>
              </Button>
            </div>

            {members.length === 0 ? (
              <div className="py-6 text-center text-xs sm:text-sm text-slate-500 space-y-3">
                <p>No family members added yet.</p>
                <Button variant="outline" size="sm" onClick={handleOpenAddMember} className="font-semibold">
                  Add first family member
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/50 rounded-lg px-2 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {member.fullName}
                        </span>
                        <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                          {member.relationship}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {member.age} yrs •{" "}
                        {member.gender.charAt(0).toUpperCase() + member.gender.slice(1)}
                        {member.disabilityStatus && " • Person with disability"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto pt-1 sm:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5 flex items-center gap-1"
                        onClick={() => handleOpenEditMember(member)}
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5 text-rose-700 hover:text-rose-800 hover:bg-rose-50 flex items-center gap-1"
                        onClick={() => setRemovingMember(member)}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TASK 3: HEALTHCARE ACCESS GUIDANCE & ACTION PLAN (PHASE 5) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                  Task 3 • Action Guidance
                </span>
                <h2 className="text-base font-bold text-slate-900">Healthcare access guidance</h2>
              </div>
            </div>

            {household && guidance && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    guidance.householdStatus === "ACTION_NEEDED"
                      ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                      : guidance.householdStatus === "MORE_INFORMATION_NEEDED"
                      ? "text-amber-800 bg-amber-50 border-amber-200"
                      : "text-slate-700 bg-slate-100 border-slate-200"
                  }`}
                >
                  {isEvaluating
                    ? "Evaluating..."
                    : guidance.householdStatus === "ACTION_NEEDED"
                    ? "Action Needed"
                    : guidance.householdStatus === "MORE_INFORMATION_NEEDED"
                    ? "Details Needed"
                    : "No Current Match"}
                </span>
              </div>
            )}
          </div>

          {!household ? (
            <div className="py-6 text-xs sm:text-sm text-slate-500 text-center">
              Complete your household profile above to check applicable healthcare support.
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. TOP HIGHLIGHT: YOUR NEXT STEP */}
              {guidance && guidance.actionPlan.length > 0 && (
                <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-teal-50/90 to-emerald-50/70 border border-teal-200/80 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-800 shrink-0" />
                    <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider">
                      Your immediate next step
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {guidance.actionPlan[0].title}
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {guidance.actionPlan[0].description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] text-teal-900 font-medium">
                    <span className="bg-white/80 px-2.5 py-0.5 rounded border border-teal-200 font-semibold">
                      Reason: {guidance.actionPlan[0].reason}
                    </span>
                  </div>
                </div>
              )}

              {/* 2. HEALTHCARE SUPPORT FOUND */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Healthcare support matching your household</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {guidance ? guidance.eligibleSchemes.length : eligibleCount} Eligible Pathway(s)
                  </span>
                </div>

                {eligibilityResults.length === 0 ? (
                  <div className="p-4 rounded-xl border border-slate-200 text-xs text-slate-500 bg-slate-50">
                    No active schemes evaluated yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {eligibilityResults.map((res) => {
                      const isExpanded = expandedSchemeId === res.schemeId;
                      const isEligible = res.status === "ELIGIBLE";
                      const isNeedsInfo = res.status === "NEEDS_INFORMATION";

                      return (
                        <div
                          key={res.schemeId}
                          className={`rounded-xl border p-4 space-y-3 transition-colors ${
                            isEligible
                              ? "border-emerald-200 bg-emerald-50/20"
                              : isNeedsInfo
                              ? "border-amber-200 bg-amber-50/20"
                              : "border-slate-200 bg-slate-50/40"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-900">
                                  {res.schemeShortName || res.schemeName}
                                </h4>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                    isEligible
                                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                      : isNeedsInfo
                                      ? "text-amber-800 bg-amber-50 border-amber-200"
                                      : "text-slate-600 bg-slate-100 border-slate-200"
                                  }`}
                                >
                                  {isEligible
                                    ? "May Qualify"
                                    : isNeedsInfo
                                    ? "Details Needed"
                                    : "Not Applicable"}
                                </span>
                                {res.pathwayCode && (
                                  <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                    {res.pathwayCode}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600">{res.benefitSummary}</p>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs self-start sm:self-auto flex items-center gap-1 font-medium shrink-0"
                              onClick={() =>
                                setExpandedSchemeId(isExpanded ? null : res.schemeId)
                              }
                            >
                              <span>{isExpanded ? "Hide details" : "View guidance"}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>

                          {/* Progressive Disclosure Accordion */}
                          {isExpanded && (
                            <div className="pt-3 border-t border-slate-200/80 space-y-3 text-xs text-slate-600 animate-in fade-in duration-150">
                              {/* Why this may apply */}
                              {res.matchedRules.length > 0 && (
                                <div className="p-3 bg-white rounded-lg border border-slate-100 space-y-1.5">
                                  <span className="font-bold text-slate-900 block">
                                    Why this may apply:
                                  </span>
                                  <ul className="space-y-1 text-slate-700">
                                    {res.matchedRules.map((m, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                        <span>{m.explanation}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Missing Information / Gaps */}
                              {res.missingRequirements.length > 0 && (
                                <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200 space-y-1.5">
                                  <span className="font-bold text-amber-900 block">
                                    Information needed to confirm support:
                                  </span>
                                  <ul className="space-y-1 text-amber-800">
                                    {res.missingRequirements.map((req, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                        <span>{req.actionPrompt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Required Documents */}
                              {res.requiredDocuments && res.requiredDocuments.length > 0 && (
                                <div className="p-3 bg-white rounded-lg border border-slate-100 space-y-1.5">
                                  <span className="font-bold text-slate-900 block">
                                    Required documents:
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {res.requiredDocuments.map((doc) => (
                                      <div
                                        key={doc.id}
                                        className="p-2 rounded bg-slate-50 border border-slate-200/80 flex items-start gap-2"
                                      >
                                        <FileCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                                        <div>
                                          <p className="font-semibold text-slate-900">
                                            {doc.name}
                                          </p>
                                          <p className="text-[11px] text-slate-500">
                                            {doc.description}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. STEP-BY-STEP ACTION PLAN */}
              {guidance && guidance.actionPlan.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-700" />
                      <span>Step-by-step action plan</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {guidance.actionPlan.length} Step(s)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {guidance.actionPlan.map((act) => (
                      <div
                        key={act.id}
                        className="p-3.5 rounded-xl border border-slate-200/90 bg-white flex items-start justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {act.stepNumber}
                          </span>
                          <div className="space-y-0.5">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                              {act.title}
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {act.description}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium pt-0.5">
                              {act.reason}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                            act.priority === "REQUIRED"
                              ? "text-rose-800 bg-rose-50 border-rose-200"
                              : "text-amber-800 bg-amber-50 border-amber-200"
                          }`}
                        >
                          {act.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. DOCUMENT READINESS CHECKLIST */}
              {guidance && guidance.documentReadiness.items.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-teal-700" />
                      <span>Document readiness checklist</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {guidance.documentReadiness.readyCount} /{" "}
                      {guidance.documentReadiness.totalRequired} Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {guidance.documentReadiness.items.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-900">{doc.name}</p>
                          <p className="text-[11px] text-slate-500">{doc.description}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                            doc.status === "READY"
                              ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                              : "text-amber-800 bg-amber-50 border-amber-200"
                          }`}
                        >
                          {doc.status === "READY" ? "Ready" : "Details Needed"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL: ADD / EDIT MEMBER */}
        <Modal
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          title={editingMemberId ? "Edit member" : "Add family member"}
          description="Enter your family member's information."
        >
          <form onSubmit={handleMemberSubmit} className="space-y-4 pt-2">
            {memberFormError && (
              <div
                role="alert"
                className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md"
              >
                {memberFormError}
              </div>
            )}

            <Input
              label="Full Name"
              placeholder="e.g. Rahul Kumar"
              value={memberForm.fullName}
              onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Age (Years)"
                type="number"
                min="0"
                max="125"
                value={memberForm.age.toString()}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, age: parseInt(e.target.value) || 0 })
                }
                required
              />

              <Select
                label="Gender"
                options={GENDER_OPTIONS}
                value={memberForm.gender}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, gender: e.target.value as Gender })
                }
                required
              />
            </div>

            <Select
              label="Relationship to Head"
              options={RELATIONSHIP_OPTIONS}
              value={memberForm.relationship}
              onChange={(e) =>
                setMemberForm({ ...memberForm, relationship: e.target.value })
              }
              required
            />

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="disabilityStatus"
                checked={memberForm.disabilityStatus}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, disabilityStatus: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <label htmlFor="disabilityStatus" className="text-xs font-medium text-slate-700">
                Person with recognized disability
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMemberModalOpen(false)}
                disabled={memberSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={memberSubmitting}
                className="w-full sm:w-auto font-semibold"
              >
                {memberSubmitting ? "Saving..." : "Save member"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: REMOVE MEMBER CONFIRMATION */}
        <Modal
          isOpen={Boolean(removingMember)}
          onClose={() => setRemovingMember(null)}
          title="Remove member"
          description="Are you sure you want to remove this member?"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs sm:text-sm text-slate-700">
              Remove{" "}
              <strong className="font-semibold text-slate-900">
                {removingMember?.fullName}
              </strong>{" "}
              from your household records?
            </p>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRemovingMember(null)}
                disabled={removeSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-rose-700 hover:bg-rose-800 text-white w-full sm:w-auto font-semibold"
                onClick={handleConfirmRemoveMember}
                disabled={removeSubmitting}
              >
                {removeSubmitting ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </Modal>
      </Shell>
    </ProtectedRoute>
  );
}
