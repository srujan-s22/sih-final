"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Scheme } from "@shared/types/eligibility";
import { EvidenceRecord } from "@shared/types/evidence";
import { AshaCase, CaseFollowUp, AutomationHealthResponse, AutomationDomainEvent } from "@shared/types/case";
import { schemeService } from "@/services/scheme-service";
import { evidenceService } from "@/services/evidence-service";
import { caseService } from "@/services/case-service";
import {
  Building2,
  ShieldCheck,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Layers,
  Search,
  ExternalLink,
  Settings,
  Lock,
  RefreshCw,
  Bot,
  Users,
  Activity,
  Cpu,
  Workflow,
  Clock,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { HealthcareAssistantDrawer } from "@/components/assistant/healthcare-assistant-drawer";

export default function AdminPage() {
  const { userProfile } = useAuth();

  // Data State
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [conflictsCount, setConflictsCount] = useState(0);
  const [adminCases, setAdminCases] = useState<AshaCase[]>([]);
  const [automationHealth, setAutomationHealth] = useState<AutomationHealthResponse | null>(null);
  const [adminFollowUps, setAdminFollowUps] = useState<CaseFollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("schemes");
  const [searchFilter, setSearchFilter] = useState("");
  const [caseSearchFilter, setCaseSearchFilter] = useState("");
  const [followUpSearchFilter, setFollowUpSearchFilter] = useState("");
  const [followUpStatusFilter, setFollowUpStatusFilter] = useState<string>("ALL");
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("ab-pmjay");
  const [schemeEvidence, setSchemeEvidence] = useState<EvidenceRecord[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Load Admin Data
  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [schemesRes, conflictsRes, casesRes, automationRes, followUpsRes] = await Promise.all([
        schemeService.getActiveSchemes(),
        evidenceService.getEvidenceConflicts(),
        caseService.listAllCasesForAdmin(),
        caseService.getAutomationHealth(),
        caseService.listAllFollowUpsForAdmin(),
      ]);

      if (schemesRes.success && schemesRes.data) {
        setSchemes(schemesRes.data.schemes || []);
      }
      if (conflictsRes.success && conflictsRes.data) {
        setEvidenceList(conflictsRes.data.unverifiedEvidence || []);
        setConflictsCount(conflictsRes.data.count || 0);
      }
      if (casesRes.success && casesRes.data) {
        setAdminCases(casesRes.data.cases || []);
      }
      if (automationRes.success && automationRes.data) {
        setAutomationHealth(automationRes.data);
      }
      if (followUpsRes.success && followUpsRes.data) {
        setAdminFollowUps(followUpsRes.data.followUps || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load specific scheme verified evidence
  const loadSchemeEvidence = useCallback(async (schemeId: string) => {
    setLoadingEvidence(true);
    try {
      const res = await evidenceService.getSchemeEvidence(schemeId);
      if (res.success && res.data) {
        setSchemeEvidence(res.data.evidence || []);
      }
    } catch {
      setSchemeEvidence([]);
    } finally {
      setLoadingEvidence(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (selectedSchemeId) {
      loadSchemeEvidence(selectedSchemeId);
    }
  }, [selectedSchemeId, loadSchemeEvidence]);

  const navTabs = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "schemes", label: "Schemes Registry", icon: Layers },
    { id: "evidence", label: "Evidence & Provenance", icon: ShieldCheck },
    { id: "cases", label: `Platform Caseload (${adminCases.length})`, icon: Users },
    { id: "automation", label: "Automation & Follow-ups", icon: Activity },
    { id: "governance", label: "System Governance", icon: Lock },
  ];

  const filteredSchemes = schemes.filter((s) => {
    if (!searchFilter) return true;
    const query = searchFilter.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.shortName.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query)
    );
  });

  const filteredCases = adminCases.filter((c) => {
    if (!caseSearchFilter) return true;
    const q = caseSearchFilter.toLowerCase();
    return (
      c.headOfHouseholdName.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q) ||
      c.assignedAshaUid.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AuthenticatedShell
        role="ADMIN"
        title="Platform Administration"
        description="Monitor verified healthcare schemes, evidence provenance, platform caseload, and server-side governance."
        navTabs={navTabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssistantOpen(true)}
              className="text-xs font-semibold flex items-center gap-1.5 border-slate-300 text-slate-800 hover:bg-slate-50 shadow-2xs"
            >
              <Bot className="w-3.5 h-3.5 text-slate-700" />
              <span>Admin Assistant</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAdminData}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Telemetry</span>
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <div className="py-16">
            <LoadingState message="Loading administrative scheme registry and security governance..." />
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Administrative Overview Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Active Verified Schemes
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {schemes.length}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium">Deterministic Rule Sets</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">
                  Verified Evidence Records
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-teal-900">
                  {schemeEvidence.length}
                </p>
                <p className="text-[11px] text-slate-400">Official Government Gazette</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                  Platform Caseload
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-blue-900">
                  {adminCases.length}
                </p>
                <p className="text-[11px] text-slate-400">Total Enrolled Cases</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Security Clearance
                </span>
                <p className="text-sm font-bold text-rose-800 bg-rose-50 px-2 py-1 rounded inline-block border border-rose-200">
                  ADMINISTRATOR
                </p>
                <p className="text-[11px] text-slate-400">Server-Side Authorized</p>
              </div>
            </div>

            {/* 2. Schemes Registry Tab */}
            {(activeTab === "overview" || activeTab === "schemes") && (
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      National Healthcare Scheme Registry
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Versioned deterministic rule definitions backed by official government metadata.
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <Input
                      placeholder="Search schemes by ID or name..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Scheme ID</th>
                          <th className="py-3 px-4">Official Name</th>
                          <th className="py-3 px-4">Level</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Source Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSchemes.map((s) => (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedSchemeId(s.id)}
                            className={`cursor-pointer transition-colors ${
                              selectedSchemeId === s.id
                                ? "bg-teal-50/50 font-medium"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {s.id}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 block">{s.name}</span>
                              <span className="text-[11px] text-slate-500">{s.benefitSummary}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">{s.level}</td>
                            <td className="py-3.5 px-4 text-slate-700">{s.category}</td>
                            <td className="py-3.5 px-4">
                              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {s.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {s.sourceMetadata?.isVerified ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{s.sourceMetadata.sourceOrganization}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-700 font-medium">
                                  Pending Source Audit
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* 3. Evidence & Provenance Tab */}
            {(activeTab === "overview" || activeTab === "evidence") && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Evidence & Provenance Registry
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Verified source citations for: <strong className="font-semibold text-slate-800">{selectedSchemeId}</strong>
                  </p>
                </div>

                {loadingEvidence ? (
                  <div className="py-6">
                    <LoadingState message="Loading verified evidence records..." />
                  </div>
                ) : schemeEvidence.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs sm:text-sm text-slate-500">
                    No verified evidence citations recorded for this scheme.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {schemeEvidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {ev.sourceType}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Score: {ev.authorityScore}/100
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{ev.officialTitle}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Org: {ev.sourceOrganization} • Domain: {ev.sourceDomain}
                          </p>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 italic">
                          &ldquo;{ev.relevantExcerpt}&rdquo;
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>VERIFIED</span>
                          </span>
                          {ev.sourceUrl && (
                            <a
                              href={ev.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-800 hover:text-teal-900 flex items-center gap-1 font-medium"
                            >
                              <span>Official Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 4. Platform Caseload Tab */}
            {(activeTab === "overview" || activeTab === "cases") && (
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Platform Caseload & Operational Oversight
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Administrative visibility across all enrolled household cases and assigned ASHA workers.
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <Input
                      placeholder="Search cases by name, district, or ASHA UID..."
                      value={caseSearchFilter}
                      onChange={(e) => setCaseSearchFilter(e.target.value)}
                    />
                  </div>
                </div>

                {filteredCases.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                    No matching cases recorded across platform.
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Case ID</th>
                            <th className="py-3 px-4">Head of Household</th>
                            <th className="py-3 px-4">District</th>
                            <th className="py-3 px-4">Assigned ASHA UID</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Priority</th>
                            <th className="py-3 px-4">Gaps</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCases.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.id}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">{c.headOfHouseholdName}</td>
                              <td className="py-3 px-4 text-slate-600">{c.district}, {c.state}</td>
                              <td className="py-3 px-4 font-mono text-slate-600">{c.assignedAshaUid}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-blue-50 text-blue-800 border border-blue-200">
                                  {c.status}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-700">
                                  {c.priority}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-700 font-medium">
                                {c.detectedGapsCount} gap(s)
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 5. Automation & Follow-up Health Tab (Phase 10) */}
            {(activeTab === "overview" || activeTab === "automation") && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-700" />
                    <span>Automation & Follow-up Engine Telemetry</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Live operational telemetry, non-blocking n8n webhook dispatcher, and platform-wide follow-up tracking.
                  </p>
                </div>

                {/* Automation Status Card */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Orchestrator Status
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          automationHealth?.status === "OPERATIONAL"
                            ? "bg-emerald-500 animate-pulse"
                            : automationHealth?.status === "DEGRADED"
                            ? "bg-amber-500"
                            : "bg-slate-400"
                        }`}
                      />
                      <p className="text-base font-bold text-slate-900">
                        {automationHealth?.status === "OPERATIONAL"
                          ? "Operational"
                          : automationHealth?.status === "DEGRADED"
                          ? "Degraded"
                          : "Unconfigured (Safe Fallback)"}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {automationHealth?.webhookUrl || "Local fallback active (no remote endpoint)"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Active Follow-ups
                    </span>
                    <p className="text-2xl font-bold text-slate-900">
                      {automationHealth?.activeFollowUps || 0}
                    </p>
                    <p className="text-[11px] text-teal-700 font-medium">Due Today & Upcoming</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
                    <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">
                      Overdue Visits
                    </span>
                    <p className="text-2xl font-bold text-rose-700">
                      {automationHealth?.overdueFollowUps || 0}
                    </p>
                    <p className="text-[11px] text-rose-600 font-medium">Requires ASHA Attention</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                      Completed & Resolved
                    </span>
                    <p className="text-2xl font-bold text-emerald-700">
                      {automationHealth?.completedFollowUps || 0}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {automationHealth?.cancelledFollowUps || 0} Cancelled
                    </p>
                  </div>
                </div>

                {/* Follow-ups Table */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-600" />
                      <h3 className="text-sm font-bold text-slate-900">Platform Follow-up Tasks</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative w-48 sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Search follow-ups..."
                          value={followUpSearchFilter}
                          onChange={(e) => setFollowUpSearchFilter(e.target.value)}
                          className="pl-8 text-xs h-8 bg-white"
                        />
                      </div>
                      <select
                        value={followUpStatusFilter}
                        onChange={(e) => setFollowUpStatusFilter(e.target.value)}
                        className="text-xs h-8 px-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Active / Pending</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Task & Scheme</th>
                          <th className="py-3 px-4">Household & Beneficiary</th>
                          <th className="py-3 px-4">Assigned ASHA</th>
                          <th className="py-3 px-4">Due Date</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {adminFollowUps
                          .filter((f) => {
                            if (followUpStatusFilter !== "ALL" && f.status !== followUpStatusFilter) return false;
                            if (!followUpSearchFilter) return true;
                            const q = followUpSearchFilter.toLowerCase();
                            return (
                              (f.title && f.title.toLowerCase().includes(q)) ||
                              f.reason.toLowerCase().includes(q) ||
                              (f.headOfHouseholdName && f.headOfHouseholdName.toLowerCase().includes(q)) ||
                              (f.beneficiaryName && f.beneficiaryName.toLowerCase().includes(q))
                            );
                          })
                          .map((f) => (
                            <tr key={f.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <p className="font-bold text-slate-900">{f.title || f.reason}</p>
                                {f.schemeName && (
                                  <span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                                    {f.schemeName}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-semibold text-slate-800">{f.headOfHouseholdName || "Family"}</p>
                                {f.beneficiaryName && <p className="text-[11px] text-slate-500">Beneficiary: {f.beneficiaryName}</p>}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600">{f.assignedAshaUid}</td>
                              <td className="py-3 px-4 text-slate-700">
                                {new Date(f.dueAt || f.scheduledAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                    f.status === "COMPLETED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : f.status === "CANCELLED"
                                      ? "bg-slate-200 text-slate-700"
                                      : f.isOverdue
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-sky-100 text-sky-800"
                                  }`}
                                >
                                  {f.status === "COMPLETED" ? "COMPLETED" : f.status === "CANCELLED" ? "CANCELLED" : f.isOverdue ? "OVERDUE" : "PENDING"}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Event Logs */}
                {automationHealth?.recentEvents && automationHealth.recentEvents.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
                      <Workflow className="w-4 h-4 text-teal-700" />
                      <h3 className="text-sm font-bold text-slate-900">Recent Domain Automation Dispatches</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Event ID</th>
                            <th className="py-2.5 px-4">Event Type</th>
                            <th className="py-2.5 px-4">Case ID</th>
                            <th className="py-2.5 px-4">ASHA UID</th>
                            <th className="py-2.5 px-4">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {automationHealth.recentEvents.slice(0, 10).map((evt) => (
                            <tr key={evt.eventId} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700">{evt.eventId}</td>
                              <td className="py-2.5 px-4 font-semibold text-teal-900">{evt.eventType}</td>
                              <td className="py-2.5 px-4 font-mono text-slate-600">{evt.caseId}</td>
                              <td className="py-2.5 px-4 font-mono text-slate-600">{evt.assignedAshaUid}</td>
                              <td className="py-2.5 px-4 text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 6. System Governance Tab */}
            {(activeTab === "overview" || activeTab === "governance") && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Server-Side Security & Role Governance
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Cryptographic boundaries and server-side role assignment authorization.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
                      <Lock className="w-4 h-4 text-teal-700" />
                      <span>Role-Based Access Control (RBAC)</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Role authorization is evaluated strictly on the Fastify backend via verified Firebase ID tokens and server-validated user profiles. Client-side state changes cannot bypass server authorization.
                    </p>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1">
                      <div>Privileged Endpoint: POST /api/v1/auth/role/assign</div>
                      <div>Required Claim: role === &quot;ADMIN&quot;</div>
                      <div>Consent Enforcement: requireConsent Middleware Active</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
                      <ShieldCheck className="w-4 h-4 text-teal-700" />
                      <span>Platform Audit Integrity</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      All critical workflow transitions (household connection, case assignment, notes, follow-ups, and assistance requests) generate immutable server-side activity records on Cloud Firestore.
                    </p>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                      <em>Immutable append-only operational history.</em>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* SwasthyaSetu Administrative Assistant Drawer */}
        <HealthcareAssistantDrawer
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          userRole="ADMIN"
        />
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
