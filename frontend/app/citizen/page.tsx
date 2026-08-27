"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { Shell } from "@/components/layout/shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
import { householdService } from "@/services/household-service";

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
  const [isLoading, setIsLoading] = useState(true);
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
    gender: "male",
    relationship: "Spouse",
    disabilityStatus: false,
    chronicConditions: [],
  });
  const [chronicConditionsInput, setChronicConditionsInput] = useState("");
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);

  // Remove Member State
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

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
        } else {
          setHousehold(null);
          setMembers([]);
        }
      } else {
        setError(res.error.message);
      }
    } catch {
      setError("We couldn't load your household details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

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
          setSuccessMessage("Household details updated.");
        } else {
          setHouseholdFormError(res.error.message);
        }
      } else {
        // Create
        const res = await householdService.createHousehold(householdForm);
        if (res.success) {
          setHousehold(res.data.household);
          setIsEditingHousehold(false);
          setSuccessMessage("Household saved.");
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
    setChronicConditionsInput("");
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
    setChronicConditionsInput((member.chronicConditions || []).join(", "));
    setMemberFormError(null);
    setIsMemberModalOpen(true);
  };

  // Handle Member Submit (Add or Edit)
  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberFormError(null);
    setMemberSubmitting(true);

    const conditionsArray = chronicConditionsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: CreateMemberInput = {
      ...memberForm,
      age: Number(memberForm.age),
      chronicConditions: conditionsArray,
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
        } else {
          setMemberFormError(res.error.message);
        }
      } else {
        const res = await householdService.addMember(payload);
        if (res.success) {
          setMembers((prev) => [...prev, res.data.member]);
          setIsMemberModalOpen(false);
          setSuccessMessage("Member added.");
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
        setSuccessMessage("Member removed.");
      }
    } catch {
      setError("Failed to remove member. Please try again.");
    } finally {
      setRemoveSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={["CITIZEN", "ASHA", "ADMIN"]}>
        <Shell className="py-12">
          <LoadingState message="Loading household details..." />
        </Shell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["CITIZEN", "ASHA", "ADMIN"]}>
      <Shell className="py-8 space-y-8 max-w-4xl">
        <PageHeader
          title="Citizen Portal"
          description="Manage your household and family members."
        />

        {/* Global Feedback Notifications */}
        {error && (
          <div role="alert" className="p-3 text-xs sm:text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadHouseholdData} className="h-7 text-xs">
              Try again
            </Button>
          </div>
        )}

        {successMessage && (
          <div role="status" className="p-3 text-xs sm:text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SECTION 1: HOUSEHOLD DETAILS */}
        {!household && !isEditingHousehold ? (
          /* Empty State: No Household Added Yet */
          <Card>
            <CardHeader>
              <CardTitle>Your household</CardTitle>
              <CardDescription>
                Add your household details to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsEditingHousehold(true)}
              >
                Set up household
              </Button>
            </CardContent>
          </Card>
        ) : isEditingHousehold ? (
          /* Household Form: Create or Edit */
          <Card>
            <CardHeader>
              <CardTitle>{household ? "Edit household details" : "Add household details"}</CardTitle>
              <CardDescription>
                Enter your household and location information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleHouseholdSubmit} className="space-y-4">
                {householdFormError && (
                  <div role="alert" className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
                    {householdFormError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Head of Household"
                    placeholder="e.g. Ramesh Kumar"
                    value={householdForm.headOfHouseholdName}
                    onChange={(e) =>
                      setHouseholdForm({ ...householdForm, headOfHouseholdName: e.target.value })
                    }
                    required
                  />

                  <Input
                    label="Ration Card Number"
                    placeholder="e.g. RC-BR-2026-1002"
                    value={householdForm.rationCardNumber}
                    onChange={(e) =>
                      setHouseholdForm({ ...householdForm, rationCardNumber: e.target.value })
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
                    label="Village / City"
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

                <div className="flex items-center justify-end gap-3 pt-3">
                  {household && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingHousehold(false)}
                      disabled={householdSubmitting}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={householdSubmitting}
                  >
                    {householdSubmitting ? "Saving..." : "Save details"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Household Summary Card */
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Household details</CardTitle>
                <CardDescription>
                  Registered household and location information.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingHousehold(true)}
              >
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs sm:text-sm">
                <div>
                  <span className="block text-slate-500 font-medium">Head of Household</span>
                  <span className="font-semibold text-slate-900">{household?.headOfHouseholdName}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium">Ration Card</span>
                  <span className="font-mono text-slate-900">{household?.rationCardNumber}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium">Income Category</span>
                  <span className="font-medium text-teal-800">{household?.incomeCategory}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium">Location</span>
                  <span className="text-slate-800">
                    {household?.village}, {household?.district}, {household?.state} — {household?.pincode}
                  </span>
                </div>
                {household?.contactPhone && (
                  <div>
                    <span className="block text-slate-500 font-medium">Phone</span>
                    <span className="text-slate-800">{household.contactPhone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION 2: FAMILY MEMBERS */}
        {household && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Family members</CardTitle>
                <CardDescription>
                  Who lives in your household.
                </CardDescription>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAddMember}
              >
                + Add member
              </Button>
            </CardHeader>

            <CardContent>
              {members.length === 0 ? (
                <div className="py-6 text-center text-xs sm:text-sm text-slate-500 space-y-3">
                  <p>No family members added yet.</p>
                  <Button variant="outline" size="sm" onClick={handleOpenAddMember}>
                    Add your first member
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">
                            {member.fullName}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            ({member.relationship})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {member.age} yrs • {member.gender.charAt(0).toUpperCase() + member.gender.slice(1)}
                          {member.disabilityStatus && " • Person with disability"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto pt-1 sm:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5"
                          onClick={() => handleOpenEditMember(member)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5 text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                          onClick={() => setRemovingMember(member)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* MODAL: ADD / EDIT MEMBER */}
        <Modal
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          title={editingMemberId ? "Edit member" : "Add family member"}
          description="Enter member demographic details."
        >
          <form onSubmit={handleMemberSubmit} className="space-y-4 pt-2">
            {memberFormError && (
              <div role="alert" className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
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
                onChange={(e) => setMemberForm({ ...memberForm, age: parseInt(e.target.value) || 0 })}
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
              onChange={(e) => setMemberForm({ ...memberForm, relationship: e.target.value })}
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
                Recognized disability or special need
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMemberModalOpen(false)}
                disabled={memberSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={memberSubmitting}
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
          description="Are you sure you want to remove this member from your household?"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs sm:text-sm text-slate-700">
              This will remove <strong className="font-semibold text-slate-900">{removingMember?.fullName}</strong> from your household records.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRemovingMember(null)}
                disabled={removeSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-rose-700 hover:bg-rose-800 text-white"
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
