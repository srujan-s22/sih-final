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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Household,
  Member,
  CreateHouseholdInput,
  IncomeCategory,
  Gender,
  CreateMemberInput,
} from "@shared/types/household";
import { GuidanceResponse } from "@shared/types/guidance";
import { householdService } from "@/services/household-service";
import { guidanceService } from "@/services/guidance-service";
import {
  Users,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  MapPin,
  FileCheck,
  Plus,
  Search,
  ArrowRight,
  Filter,
  UserPlus,
  Eye,
  Clock,
  HeartHandshake,
} from "lucide-react";

const INCOME_OPTIONS: Array<{ value: IncomeCategory; label: string }> = [
  { value: "BPL", label: "Below Poverty Line (BPL)" },
  { value: "AAY", label: "Antyodaya Anna Yojana (AAY)" },
  { value: "APL", label: "Above Poverty Line (APL)" },
  { value: "OTHER", label: "Other" },
];

export default function AshaPage() {
  const { userProfile } = useAuth();

  // Data State
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState<Household | null>(null);

  // Field Onboarding Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState<CreateHouseholdInput>({
    headOfHouseholdName: "",
    rationCardNumber: "",
    incomeCategory: "BPL",
    state: "",
    district: "",
    village: "",
    pincode: "",
    contactPhone: "",
  });
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  // Load ASHA Data
  const loadAshaData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [hhRes, guideRes] = await Promise.all([
        householdService.getHousehold(),
        guidanceService.getMyGuidance(),
      ]);

      if (hhRes.success && hhRes.data) {
        setHousehold(hhRes.data.household);
        setMembers(hhRes.data.members || []);
      }
      if (guideRes.success && guideRes.data) {
        setGuidance(guideRes.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAshaData();
  }, [loadAshaData]);

  // Handle Assisted Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSubmitting(true);

    try {
      const res = await householdService.createHousehold(registerForm);
      if (res.success) {
        setHousehold(res.data.household);
        setIsRegisterModalOpen(false);
        setRegisterSuccess(`Household registered for ${res.data.household.headOfHouseholdName}`);
        await loadAshaData();
      } else {
        setRegisterError(res.error.message);
      }
    } catch {
      setRegisterError("Failed to register household in field.");
    } finally {
      setRegisterSubmitting(false);
    }
  };

  const navTabs = [
    { id: "overview", label: "Overview", icon: HeartHandshake },
    { id: "cases", label: "Households & Cases", icon: Users },
    { id: "attention", label: "Needs Attention", icon: AlertCircle },
    { id: "register", label: "Field Registration", icon: UserPlus },
  ];

  // Cases List (Derived from real household data)
  const householdList = household ? [household] : [];
  const filteredCases = householdList.filter((h) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      h.headOfHouseholdName.toLowerCase().includes(query) ||
      h.district.toLowerCase().includes(query) ||
      (h.rationCardNumber && h.rationCardNumber.toLowerCase().includes(query))
    );
  });

  const needsAttentionCount = guidance?.gaps?.length ? guidance.gaps.length : 0;
  const pendingActionsCount = guidance?.actionPlan?.length ? guidance.actionPlan.length : 0;
  const eligibleSchemesCount = guidance?.eligibleSchemes?.length ? guidance.eligibleSchemes.length : 0;

  return (
    <ProtectedRoute allowedRoles={["ASHA", "ADMIN"]}>
      <AuthenticatedShell
        role="ASHA"
        title="ASHA Field Workspace"
        description="Monitor household cases, identify healthcare access gaps, and assist families with government scheme enrollment."
        navTabs={navTabs}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          if (tabId === "register") {
            setIsRegisterModalOpen(true);
          } else {
            setActiveTab(tabId);
          }
        }}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setRegisterError(null);
              setIsRegisterModalOpen(true);
            }}
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Register Household</span>
          </Button>
        }
      >
        {/* Success Alert */}
        {registerSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="font-semibold">{registerSuccess}</p>
            </div>
            <button
              onClick={() => setRegisterSuccess(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-16">
            <LoadingState message="Loading ASHA field caseload and assigned households..." />
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Quick Overview Operational Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Assigned Households
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {householdList.length}
                </p>
                <p className="text-[11px] text-slate-400">Verified in field cache</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                  Needs Attention
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-800">
                  {needsAttentionCount}
                </p>
                <p className="text-[11px] text-slate-400">Access gaps detected</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                  Eligible Pathways
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-800">
                  {eligibleSchemesCount}
                </p>
                <p className="text-[11px] text-slate-400">Verified scheme matches</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">
                  Pending Actions
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-teal-900">
                  {pendingActionsCount}
                </p>
                <p className="text-[11px] text-slate-400">e-KYC & document tasks</p>
              </div>
            </div>

            {/* 2. My Households & Cases Section */}
            {(activeTab === "overview" || activeTab === "cases") && (
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Caseload Households
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Families under your operational coverage area.
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <Input
                      placeholder="Search family or ration card..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {householdList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
                    <Users className="w-8 h-8 text-slate-400 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800">No households registered yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Use the button below to register a rural household directly during field visits.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsRegisterModalOpen(true)}
                    >
                      + Register First Household
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                          <tr>
                            <th className="py-3 px-4">Head of Household</th>
                            <th className="py-3 px-4">Location</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Members</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCases.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-slate-900">
                                {c.headOfHouseholdName}
                                <span className="block text-[11px] font-mono text-slate-400 font-normal">
                                  {c.rationCardNumber || "No ration ID"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                {c.village}, {c.district}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-teal-800">
                                {c.incomeCategory}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">
                                {members.length} member{members.length === 1 ? "" : "s"}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                    eligibleSchemesCount > 0
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : "bg-amber-50 text-amber-800 border-amber-200"
                                  }`}
                                >
                                  {eligibleSchemesCount > 0
                                    ? "✓ Eligible Match"
                                    : "Needs Info"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedCase(c)}
                                  className="text-xs"
                                >
                                  View Case
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card Stack View */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {filteredCases.map((c) => (
                        <div key={c.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">
                                {c.headOfHouseholdName}
                              </h4>
                              <p className="text-xs text-slate-500">
                                {c.village}, {c.district}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {c.incomeCategory}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{members.length} members</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedCase(c)}
                              className="text-xs"
                            >
                              Review Case
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 3. Needs Attention Section */}
            {(activeTab === "overview" || activeTab === "attention") && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Cases Requiring Attention
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Unmet access requirements, missing document proofs, or pending e-KYC steps.
                  </p>
                </div>

                {!guidance?.gaps || guidance.gaps.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs sm:text-sm text-slate-500">
                    No urgent gaps identified in your caseload.
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs divide-y divide-slate-100">
                    {guidance.gaps.map((gap) => (
                      <div key={gap.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center font-bold shrink-0 mt-0.5">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900">
                              {gap.title}
                            </h4>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                              {gap.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {gap.description}
                          </p>
                          {gap.reason && (
                            <p className="text-[11px] text-teal-800 font-medium">
                              Scheme Impact: {gap.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* Modal: Assisted Field Registration */}
        <Modal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          title="Assisted Household Registration"
          description="Register a citizen household directly during field outreach."
        >
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {registerError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {registerError}
              </div>
            )}

            <Input
              label="Head of Household Full Name"
              required
              value={registerForm.headOfHouseholdName}
              onChange={(e) =>
                setRegisterForm({ ...registerForm, headOfHouseholdName: e.target.value })
              }
              placeholder="e.g. Ram Prasad"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="State"
                required
                value={registerForm.state}
                onChange={(e) => setRegisterForm({ ...registerForm, state: e.target.value })}
                placeholder="e.g. Bihar"
              />
              <Input
                label="District"
                required
                value={registerForm.district}
                onChange={(e) => setRegisterForm({ ...registerForm, district: e.target.value })}
                placeholder="e.g. Patna"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Village / Ward"
                required
                value={registerForm.village}
                onChange={(e) => setRegisterForm({ ...registerForm, village: e.target.value })}
                placeholder="e.g. Ward 4"
              />
              <Input
                label="Pincode"
                required
                value={registerForm.pincode}
                onChange={(e) => setRegisterForm({ ...registerForm, pincode: e.target.value })}
                placeholder="e.g. 800001"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Ration Category"
                value={registerForm.incomeCategory}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    incomeCategory: e.target.value as IncomeCategory,
                  })
                }
                options={INCOME_OPTIONS}
              />
              <Input
                label="Ration Card ID"
                value={registerForm.rationCardNumber}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, rationCardNumber: e.target.value })
                }
                placeholder="e.g. RC-998877"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRegisterModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={registerSubmitting}>
                {registerSubmitting ? "Registering..." : "Complete Registration"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: View Case Details */}
        <Modal
          isOpen={Boolean(selectedCase)}
          onClose={() => setSelectedCase(null)}
          title={`Household Case: ${selectedCase?.headOfHouseholdName}`}
          description={`Location: ${selectedCase?.village}, ${selectedCase?.district}, ${selectedCase?.state}`}
        >
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Ration Tier:</span>
                <span className="font-bold text-teal-800">{selectedCase?.incomeCategory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ration Card:</span>
                <span className="font-mono">{selectedCase?.rationCardNumber || "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registered Members:</span>
                <span className="font-semibold">{members.length}</span>
              </div>
            </div>

            {guidance?.actionPlan && guidance.actionPlan.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                  Pending Actions for ASHA Follow-up:
                </h4>
                <ul className="space-y-2">
                  {guidance.actionPlan.map((step, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-teal-50/50 border border-teal-100 flex items-start gap-2"
                    >
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{step.title}</p>
                        <p className="text-xs text-slate-600">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedCase(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
