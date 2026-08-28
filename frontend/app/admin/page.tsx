"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Scheme } from "@shared/types/eligibility";
import { EvidenceRecord } from "@shared/types/evidence";
import { schemeService } from "@/services/scheme-service";
import { evidenceService } from "@/services/evidence-service";
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
} from "lucide-react";
import { HealthcareAssistantDrawer } from "@/components/assistant/healthcare-assistant-drawer";

export default function AdminPage() {
  const { userProfile } = useAuth();

  // Data State
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [conflictsCount, setConflictsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("schemes");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("ab-pmjay");
  const [schemeEvidence, setSchemeEvidence] = useState<EvidenceRecord[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Load Admin Data
  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [schemesRes, conflictsRes] = await Promise.all([
        schemeService.getActiveSchemes(),
        evidenceService.getEvidenceConflicts(),
      ]);

      if (schemesRes.success && schemesRes.data) {
        setSchemes(schemesRes.data.schemes || []);
      }
      if (conflictsRes.success && conflictsRes.data) {
        setEvidenceList(conflictsRes.data.unverifiedEvidence || []);
        setConflictsCount(conflictsRes.data.count || 0);
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

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AuthenticatedShell
        role="ADMIN"
        title="Platform Administration"
        description="Monitor verified healthcare schemes, evidence provenance, conflict audits, and server-side governance."
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
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                  Unverified Evidence Queue
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-800">
                  {conflictsCount}
                </p>
                <p className="text-[11px] text-slate-400">Isolated from Rule Engine</p>
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

            {/* 4. System Governance Tab */}
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
                      <span>Upcoming System Telemetry</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Real-time API error monitoring, automated load metric dashboards, and detailed audit log exporters are scheduled for subsequent platform releases.
                    </p>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                      <em>No fabricated charts or simulated counters. Real data only.</em>
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
