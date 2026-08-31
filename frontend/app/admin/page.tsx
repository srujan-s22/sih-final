"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/i18n/i18n-context";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Scheme } from "@shared/types/eligibility";
import { EvidenceRecord } from "@shared/types/evidence";
import {
  AshaCase,
  CaseFollowUp,
  AutomationHealthResponse,
  CaseDetailResponse,
} from "@shared/types/case";
import { VoiceHealthResponse } from "@shared/types/voice";
import { schemeService } from "@/services/scheme-service";
import { evidenceService } from "@/services/evidence-service";
import { caseService } from "@/services/case-service";
import { voiceService } from "@/services/voice-service";
import {
  Building2,
  ShieldCheck,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Layers,
  Search,
  ExternalLink,
  Lock,
  RefreshCw,
  Bot,
  Users,
  Activity,
  Workflow,
  Clock,
  AlertTriangle,
  Calendar,
  PhoneCall,
  Mic,
  Inbox,
  ChevronRight,
  UserCheck,
  MapPin,
  Check,
  X,
  FileText,
  HeartPulse,
  Share2,
  ArrowRight,
} from "lucide-react";
import { HealthcareAssistantDrawer } from "@/components/assistant/healthcare-assistant-drawer";

interface AshaWorkerSummary {
  ashaUid: string;
  ashaName: string;
  districts: string[];
  totalCases: number;
  activeCases: number;
  needsAttentionCases: number;
  blockedCases: number;
  totalFollowUps: number;
  overdueFollowUps: number;
  lastActive: string | null;
}

export default function AdminPage() {
  const { userProfile } = useAuth();
  const { t } = useTranslation();

  // --- Core Telemetry & Data State ---
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [conflictsCount, setConflictsCount] = useState(0);
  const [adminCases, setAdminCases] = useState<AshaCase[]>([]);
  const [automationHealth, setAutomationHealth] = useState<AutomationHealthResponse | null>(null);
  const [adminFollowUps, setAdminFollowUps] = useState<CaseFollowUp[]>([]);
  const [voiceTelemetry, setVoiceTelemetry] = useState<VoiceHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- Active Tab Navigation ---
  const [activeTab, setActiveTab] = useState("overview");

  // --- Filter & Search States ---
  const [householdSearch, setHouseholdSearch] = useState("");
  const [householdFilter, setHouseholdFilter] = useState<string>("ALL");

  const [ashaSearch, setAshaSearch] = useState("");

  const [caseSearch, setCaseSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>("ALL");

  const [schemeSearch, setSchemeSearch] = useState("");
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("ab-pmjay");
  const [schemeEvidence, setSchemeEvidence] = useState<EvidenceRecord[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  const [followUpSearch, setFollowUpSearch] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState<string>("ALL");

  // --- Case Detail Drawer State ---
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetailResponse | null>(null);
  const [isCaseDetailLoading, setIsCaseDetailLoading] = useState(false);

  // --- Reassign ASHA Modal State ---
  const [reassigningCase, setReassigningCase] = useState<AshaCase | null>(null);
  const [newAshaUid, setNewAshaUid] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [actionSuccessBanner, setActionSuccessBanner] = useState<string | null>(null);

  // --- Assistant Drawer ---
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // ============================================================================
  // DATA LOADERS
  // ============================================================================
  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [schemesRes, conflictsRes, casesRes, automationRes, followUpsRes, voiceRes] =
        await Promise.all([
          schemeService.getActiveSchemes(),
          evidenceService.getEvidenceConflicts(),
          caseService.listAllCasesForAdmin(),
          caseService.getAutomationHealth(),
          caseService.listAllFollowUpsForAdmin(),
          voiceService.getVoiceTelemetry(),
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
      if (voiceRes.success && voiceRes.data) {
        setVoiceTelemetry(voiceRes.data);
      }
    } catch {
      // Non-blocking catch
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const openCaseDetail = useCallback(async (caseId: string) => {
    setSelectedCaseId(caseId);
    setIsCaseDetailLoading(true);
    try {
      const res = await caseService.getCaseDetail(caseId);
      if (res.success && res.data) {
        setCaseDetail(res.data);
      } else {
        setCaseDetail(null);
      }
    } catch {
      setCaseDetail(null);
    } finally {
      setIsCaseDetailLoading(false);
    }
  }, []);

  const handleReassignAsha = async () => {
    if (!reassigningCase || !newAshaUid.trim()) {
      setReassignError("Please enter a valid target ASHA worker UID.");
      return;
    }

    setIsReassigning(true);
    setReassignError(null);

    try {
      const res = await caseService.assignCaseToAsha(
        reassigningCase.householdId,
        newAshaUid.trim()
      );

      if (res.success) {
        setActionSuccessBanner(
          `Case for ${reassigningCase.headOfHouseholdName} successfully reassigned to ASHA ${newAshaUid.trim()}.`
        );
        setReassigningCase(null);
        setNewAshaUid("");
        await loadAdminData();
        if (selectedCaseId === reassigningCase.id) {
          await openCaseDetail(reassigningCase.id);
        }
      } else {
        const errorMsg = (res as any).error?.message || (res as any).message || "Failed to reassign case.";
        setReassignError(errorMsg);
      }
    } catch (err: any) {
      setReassignError(err.message || "An error occurred during case reassignment.");
    } finally {
      setIsReassigning(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (selectedSchemeId) {
      loadSchemeEvidence(selectedSchemeId);
    }
  }, [selectedSchemeId, loadSchemeEvidence]);

  // ============================================================================
  // SINGLE SOURCE OF TRUTH: UNIFIED METRICS & STATE DERIVATIONS
  // ============================================================================

  // 1. Authoritative Households & Cases
  const totalHouseholdsCount = adminCases.length;

  const activeCases = useMemo(
    () => adminCases.filter((c) => !["RESOLVED", "CLOSED"].includes(c.status)),
    [adminCases]
  );
  const activeCasesCount = activeCases.length;

  const needsAttentionCases = useMemo(
    () =>
      adminCases.filter(
        (c) =>
          c.status === "NEEDS_ATTENTION" ||
          c.status === "BLOCKED" ||
          c.status === "ESCALATED" ||
          c.priority === "URGENT" ||
          c.priority === "HIGH" ||
          c.detectedGapsCount > 0
      ),
    [adminCases]
  );
  const needsAttentionCount = needsAttentionCases.length;

  const blockedCases = useMemo(
    () => adminCases.filter((c) => c.status === "BLOCKED" || c.status === "ESCALATED"),
    [adminCases]
  );
  const blockedCasesCount = blockedCases.length;

  const inProgressCases = useMemo(
    () => adminCases.filter((c) => c.status === "IN_PROGRESS"),
    [adminCases]
  );
  const inProgressCount = inProgressCases.length;

  const resolvedCases = useMemo(
    () => adminCases.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED"),
    [adminCases]
  );
  const resolvedCasesCount = resolvedCases.length;

  // 2. Authoritative ASHA Workforce Aggregation
  const ashaWorkforce = useMemo<AshaWorkerSummary[]>(() => {
    const map = new Map<string, AshaWorkerSummary>();

    for (const c of adminCases) {
      const uid = c.assignedAshaUid || "UNASSIGNED";
      if (!map.has(uid)) {
        map.set(uid, {
          ashaUid: uid,
          ashaName: uid === "UNASSIGNED" ? "Unassigned Pool" : `ASHA (${uid.slice(0, 10)})`,
          districts: [],
          totalCases: 0,
          activeCases: 0,
          needsAttentionCases: 0,
          blockedCases: 0,
          totalFollowUps: 0,
          overdueFollowUps: 0,
          lastActive: null,
        });
      }
      const worker = map.get(uid)!;
      worker.totalCases += 1;
      if (!["RESOLVED", "CLOSED"].includes(c.status)) {
        worker.activeCases += 1;
      }
      if (
        c.status === "NEEDS_ATTENTION" ||
        c.status === "BLOCKED" ||
        c.status === "ESCALATED" ||
        c.priority === "URGENT" ||
        c.detectedGapsCount > 0
      ) {
        worker.needsAttentionCases += 1;
      }
      if (c.status === "BLOCKED" || c.status === "ESCALATED") {
        worker.blockedCases += 1;
      }
      if (c.district && !worker.districts.includes(c.district)) {
        worker.districts.push(c.district);
      }
      if (
        c.lastContactAt &&
        (!worker.lastActive || new Date(c.lastContactAt) > new Date(worker.lastActive))
      ) {
        worker.lastActive = c.lastContactAt;
      } else if (
        c.updatedAt &&
        (!worker.lastActive || new Date(c.updatedAt) > new Date(worker.lastActive))
      ) {
        worker.lastActive = c.updatedAt;
      }
    }

    for (const f of adminFollowUps) {
      const uid = f.assignedAshaUid;
      if (uid && map.has(uid)) {
        const worker = map.get(uid)!;
        worker.totalFollowUps += 1;
        if (f.isOverdue && f.status === "PENDING") {
          worker.overdueFollowUps += 1;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalCases - a.totalCases);
  }, [adminCases, adminFollowUps]);

  const totalAshasCount = ashaWorkforce.filter((a) => a.ashaUid !== "UNASSIGNED").length;

  // 3. Authoritative Follow-up Metrics
  const todayIsoStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const overdueFollowUps = useMemo(
    () => adminFollowUps.filter((f) => f.status === "PENDING" && f.isOverdue === true),
    [adminFollowUps]
  );
  const overdueFollowUpsCount = overdueFollowUps.length;

  const dueTodayFollowUps = useMemo(() => {
    return adminFollowUps.filter((f) => {
      if (f.status !== "PENDING") return false;
      const dueStr = f.dueAt || f.scheduledAt;
      return dueStr ? new Date(dueStr).toISOString().split("T")[0] === todayIsoStr : false;
    });
  }, [adminFollowUps, todayIsoStr]);
  const dueTodayFollowUpsCount = dueTodayFollowUps.length;

  const upcomingFollowUps = useMemo(() => {
    return adminFollowUps.filter((f) => {
      if (f.status !== "PENDING" || f.isOverdue) return false;
      const dueStr = f.dueAt || f.scheduledAt;
      const isToday = dueStr ? new Date(dueStr).toISOString().split("T")[0] === todayIsoStr : false;
      return !isToday;
    });
  }, [adminFollowUps, todayIsoStr]);
  const upcomingFollowUpsCount = upcomingFollowUps.length;

  const completedFollowUpsCount = useMemo(
    () => adminFollowUps.filter((f) => f.status === "COMPLETED").length,
    [adminFollowUps]
  );

  const cancelledFollowUpsCount = useMemo(
    () => adminFollowUps.filter((f) => f.status === "CANCELLED").length,
    [adminFollowUps]
  );

  const totalFollowUpsCount = adminFollowUps.length;
  const actionableFollowUpsCount = overdueFollowUpsCount + dueTodayFollowUpsCount;

  // 4. Scheme Oversight Metrics
  const schemesWithActiveAssistanceCount = useMemo(
    () =>
      schemes.filter((s) =>
        adminCases.some((c) => c.schemeId === s.id && !["RESOLVED", "CLOSED"].includes(c.status))
      ).length,
    [schemes, adminCases]
  );

  // --- Navigation Tabs ---
  const navTabs = [
    { id: "overview", label: t("navigation.dashboard"), icon: Building2 },
    { id: "households", label: `${t("navigation.directory")} (${totalHouseholdsCount})`, icon: Users },
    { id: "ashas", label: `${t("navigation.workforce")} (${totalAshasCount})`, icon: ShieldCheck },
    { id: "cases", label: `${t("navigation.oversight")} (${activeCasesCount})`, icon: Inbox },
    { id: "schemes", label: `${t("navigation.registry")} (${schemes.length})`, icon: Layers },
    { id: "monitoring", label: t("navigation.monitoring"), icon: Activity },
  ];

  // ============================================================================
  // FILTERED DATA SETS
  // ============================================================================

  const filteredHouseholds = useMemo(() => {
    return adminCases.filter((c) => {
      if (householdFilter === "ACTIVE" && ["RESOLVED", "CLOSED"].includes(c.status)) return false;
      if (
        householdFilter === "NEEDS_ATTENTION" &&
        !(
          c.status === "NEEDS_ATTENTION" ||
          c.status === "BLOCKED" ||
          c.status === "ESCALATED" ||
          c.priority === "URGENT" ||
          c.detectedGapsCount > 0
        )
      )
        return false;
      if (householdFilter === "RESOLVED" && !["RESOLVED", "CLOSED"].includes(c.status)) return false;
      if (householdFilter === "HIGH_PRIORITY" && c.priority !== "HIGH" && c.priority !== "URGENT")
        return false;

      if (!householdSearch.trim()) return true;
      const q = householdSearch.toLowerCase();
      return (
        c.headOfHouseholdName.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.assignedAshaUid.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [adminCases, householdFilter, householdSearch]);

  const filteredAshas = useMemo(() => {
    return ashaWorkforce.filter((a) => {
      if (!ashaSearch.trim()) return true;
      const q = ashaSearch.toLowerCase();
      return (
        a.ashaUid.toLowerCase().includes(q) ||
        a.ashaName.toLowerCase().includes(q) ||
        a.districts.some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [ashaWorkforce, ashaSearch]);

  const filteredCases = useMemo(() => {
    return adminCases.filter((c) => {
      if (caseStatusFilter === "ACTIVE" && ["RESOLVED", "CLOSED"].includes(c.status)) return false;
      if (
        caseStatusFilter === "NEEDS_ATTENTION" &&
        !(
          c.status === "NEEDS_ATTENTION" ||
          c.status === "BLOCKED" ||
          c.status === "ESCALATED" ||
          c.priority === "URGENT" ||
          c.detectedGapsCount > 0
        )
      )
        return false;
      if (caseStatusFilter === "IN_PROGRESS" && c.status !== "IN_PROGRESS") return false;
      if (
        caseStatusFilter === "BLOCKED" &&
        c.status !== "BLOCKED" &&
        c.status !== "ESCALATED"
      )
        return false;
      if (caseStatusFilter === "RESOLVED" && !["RESOLVED", "CLOSED"].includes(c.status)) return false;

      if (!caseSearch.trim()) return true;
      const q = caseSearch.toLowerCase();
      return (
        c.headOfHouseholdName.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        c.assignedAshaUid.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.schemeName && c.schemeName.toLowerCase().includes(q)) ||
        (c.schemeId && c.schemeId.toLowerCase().includes(q))
      );
    });
  }, [adminCases, caseStatusFilter, caseSearch]);

  const filteredSchemes = useMemo(() => {
    return schemes.filter((s) => {
      if (!schemeSearch.trim()) return true;
      const query = schemeSearch.toLowerCase();
      return (
        s.name.toLowerCase().includes(query) ||
        s.shortName.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query)
      );
    });
  }, [schemes, schemeSearch]);

  const filteredFollowUps = useMemo(() => {
    return adminFollowUps.filter((f) => {
      const dueDateStr = f.dueAt || f.scheduledAt;
      const dateOnlyStr = dueDateStr ? new Date(dueDateStr).toISOString().split("T")[0] : "";
      const isToday = dateOnlyStr === todayIsoStr;

      if (followUpFilter === "DUE_TODAY" && !(f.status === "PENDING" && isToday)) return false;
      if (followUpFilter === "OVERDUE" && !(f.status === "PENDING" && f.isOverdue === true && !isToday))
        return false;
      if (followUpFilter === "UPCOMING" && !(f.status === "PENDING" && !isToday && !f.isOverdue))
        return false;
      if (followUpFilter === "COMPLETED" && f.status !== "COMPLETED") return false;
      if (followUpFilter === "CANCELLED" && f.status !== "CANCELLED") return false;

      if (!followUpSearch.trim()) return true;
      const q = followUpSearch.toLowerCase();
      return (
        (f.title && f.title.toLowerCase().includes(q)) ||
        f.reason.toLowerCase().includes(q) ||
        (f.headOfHouseholdName && f.headOfHouseholdName.toLowerCase().includes(q)) ||
        (f.beneficiaryName && f.beneficiaryName.toLowerCase().includes(q)) ||
        (f.assignedAshaUid && f.assignedAshaUid.toLowerCase().includes(q))
      );
    });
  }, [adminFollowUps, followUpFilter, followUpSearch, todayIsoStr]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AuthenticatedShell
        role="ADMIN"
        title={t("admin.consoleTitle")}
        description={t("admin.consoleDesc")}
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
              <Bot className="w-3.5 h-3.5 text-teal-700" />
              <span>Admin Assistant</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAdminData}
              className="text-xs font-semibold flex items-center gap-1.5 border-slate-300 hover:bg-slate-50 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Refresh</span>
            </Button>
          </div>
        }
      >
        {/* Success Alert Banner */}
        {actionSuccessBanner && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-800 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="font-semibold">{actionSuccessBanner}</p>
            </div>
            <button
              onClick={() => setActionSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 text-center">
            <LoadingState message="Loading administrative caseload, workforce telemetry, and system registries..." />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ============================================================ */}
            {/* C1. DASHBOARD TAB */}
            {/* ============================================================ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* 1. Operational Summary 4-Metric Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div
                    onClick={() => setActiveTab("households")}
                    className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs cursor-pointer hover:border-teal-300 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Registered Households
                      </span>
                      <Users className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1.5">
                      {totalHouseholdsCount}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Persisted family units</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("ashas")}
                    className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs cursor-pointer hover:border-emerald-300 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        Active ASHA Workers
                      </span>
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-950 mt-1.5">
                      {totalAshasCount}
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">Field healthcare workforce</p>
                  </div>

                  <div
                    onClick={() => setActiveTab("cases")}
                    className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs cursor-pointer hover:border-blue-300 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                        Active Cases
                      </span>
                      <Inbox className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-blue-950 mt-1.5">
                      {activeCasesCount}
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {blockedCasesCount} blocked or escalated
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("monitoring")}
                    className="bg-rose-50/30 rounded-xl border border-rose-200 p-4 sm:p-5 shadow-2xs cursor-pointer hover:border-rose-300 hover:bg-rose-50/60 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                        Follow-ups Due
                      </span>
                      <Clock className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-rose-950 mt-1.5">
                      {actionableFollowUpsCount}
                    </p>
                    <p className="text-xs text-rose-700 mt-0.5">
                      {overdueFollowUpsCount} overdue, {dueTodayFollowUpsCount} today
                    </p>
                  </div>
                </div>

                {/* 2. Quick Field Action Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Administrative Navigation:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("households")}
                      className="text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100"
                    >
                      <Search className="w-3.5 h-3.5 mr-1 text-slate-500" /> Find Household
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("ashas")}
                      className="text-xs font-semibold bg-white border-emerald-200 text-emerald-900 hover:bg-emerald-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-700" /> ASHA Workforce ({totalAshasCount})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("cases")}
                      className="text-xs font-semibold bg-white border-blue-200 text-blue-900 hover:bg-blue-50"
                    >
                      <Inbox className="w-3.5 h-3.5 mr-1 text-blue-700" /> Active Cases ({activeCasesCount})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("schemes")}
                      className="text-xs font-semibold bg-white border-teal-200 text-teal-900 hover:bg-teal-50"
                    >
                      <Layers className="w-3.5 h-3.5 mr-1 text-teal-700" /> Schemes Registry ({schemes.length})
                    </Button>
                  </div>
                </div>

                {/* 3. Priority Needs Attention & Action Queue (2 Columns) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Column 1: Priority Case Attention & Blockers */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Priority Case Oversight ({needsAttentionCount})
                        </h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCaseStatusFilter("NEEDS_ATTENTION");
                          setActiveTab("cases");
                        }}
                        className="text-xs font-semibold text-amber-900 border-amber-200 hover:bg-amber-50"
                      >
                        View Cases
                      </Button>
                    </div>

                    {needsAttentionCases.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                        <p className="font-semibold text-slate-700">All caseloads operating normally</p>
                        <p className="text-slate-500">No unaddressed blockers or escalated cases recorded across platform.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {needsAttentionCases.slice(0, 3).map((c) => (
                          <div
                            key={c.id}
                            className="p-3.5 bg-slate-50/70 hover:bg-amber-50/30 rounded-xl border border-slate-200 space-y-2.5 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  c.status === "BLOCKED" || c.status === "ESCALATED" || c.priority === "URGENT"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {c.status}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                Case: {c.id.slice(0, 8)}...
                              </span>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-slate-900">{c.headOfHouseholdName}</h4>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {c.district}, {c.state} • ASHA: <span className="font-mono text-slate-700">{c.assignedAshaUid}</span>
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                              <span className="text-[11px] font-semibold text-slate-700">
                                {c.detectedGapsCount} identified gap(s)
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCaseDetail(c.id)}
                                className="text-xs font-semibold py-1 px-2.5 text-slate-700 hover:bg-white"
                              >
                                Review Case
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Actionable Home Visits & Outreach */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-rose-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Due Home Visits &amp; Outreach ({actionableFollowUpsCount})
                        </h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFollowUpFilter("OVERDUE");
                          setActiveTab("monitoring");
                        }}
                        className="text-xs font-semibold text-rose-900 border-rose-200 hover:bg-rose-50"
                      >
                        View Follow-ups
                      </Button>
                    </div>

                    {actionableFollowUpsCount === 0 ? (
                      <div className="py-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                        <p className="font-semibold text-slate-700">No overdue visits or tasks</p>
                        <p className="text-slate-500">All scheduled home visits and door-to-door follow-ups are up to date.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {[...overdueFollowUps, ...dueTodayFollowUps].slice(0, 3).map((f) => (
                          <div
                            key={f.id}
                            className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                              f.isOverdue ? "bg-rose-50/40 border-rose-200" : "bg-amber-50/30 border-amber-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {f.headOfHouseholdName || "Registered Family"}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  f.isOverdue ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {f.isOverdue ? "Overdue Visit" : "Due Today"}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 font-medium">{f.title || f.reason}</p>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                              <span className="text-[11px] text-slate-500">
                                ASHA: <span className="font-mono text-slate-700">{f.assignedAshaUid || "General"}</span>
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCaseDetail(f.caseId)}
                                className="text-xs font-semibold py-1 px-2.5 text-slate-700 hover:bg-white"
                              >
                                Open Case
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Compact System Health Strip */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-teal-700" />
                      <span>Platform Infrastructure &amp; Service Health</span>
                    </span>
                    <button
                      onClick={() => setActiveTab("monitoring")}
                      className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Full Telemetry</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">Core API</span>
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Operational
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">Database</span>
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cloud Firestore
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">Voice Speech</span>
                      <span className={`text-xs font-bold flex items-center gap-1 ${voiceTelemetry?.sarvamConfigured ? "text-emerald-800" : "text-amber-800"}`}>
                        <CheckCircle2 className="w-3 h-3" /> {voiceTelemetry?.sarvamConfigured ? "Sarvam saaras:v2" : "Local Engine"}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">Telephony</span>
                      <span className={`text-xs font-bold flex items-center gap-1 ${voiceTelemetry?.exotelConfigured ? "text-emerald-800" : "text-amber-800"}`}>
                        <CheckCircle2 className="w-3 h-3" /> {voiceTelemetry?.exotelConfigured ? "Exotel Connected" : "Local Test Mode"}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">Automation</span>
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Dispatcher Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* C2. USER / HOUSEHOLD MANAGEMENT TAB */}
            {/* ============================================================ */}
            {activeTab === "households" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Registered Household Directory
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Administrative directory of registered families, demographic profiles, and assigned ASHA field workers.
                    </p>
                  </div>

                  <div className="w-full sm:w-72">
                    <Input
                      placeholder="Search household, head, district, or ASHA..."
                      value={householdSearch}
                      onChange={(e) => setHouseholdSearch(e.target.value)}
                      className="text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Filter Pills Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { id: "ALL", label: `All Households (${totalHouseholdsCount})` },
                    { id: "ACTIVE", label: `Active Cases (${activeCasesCount})` },
                    { id: "NEEDS_ATTENTION", label: `Needs Attention (${needsAttentionCount})` },
                    { id: "HIGH_PRIORITY", label: `High / Urgent (${adminCases.filter((c) => c.priority === "HIGH" || c.priority === "URGENT").length})` },
                    { id: "RESOLVED", label: `Resolved (${resolvedCasesCount})` },
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      onClick={() => setHouseholdFilter(pill.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        householdFilter === pill.id
                          ? "bg-slate-900 text-white shadow-2xs"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Household List (Responsive: Desktop Table + Mobile Cards) */}
                {filteredHouseholds.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 space-y-1">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">No households match this filter</p>
                    <p className="text-slate-500">Try adjusting your search keyword or selected status pill.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Structured Table */}
                    <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th className="py-3 px-4">Head of Household</th>
                              <th className="py-3 px-4">Location</th>
                              <th className="py-3 px-4">Assigned ASHA</th>
                              <th className="py-3 px-4">Case Status</th>
                              <th className="py-3 px-4">Priority</th>
                              <th className="py-3 px-4">Gaps</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredHouseholds.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3.5 px-4">
                                  <span className="font-bold text-slate-900 block">{c.headOfHouseholdName}</span>
                                  <span className="text-[10px] font-mono text-slate-400">ID: {c.id.slice(0, 10)}...</span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-700">
                                  {c.district}, {c.state}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                    {c.assignedAshaUid}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                      c.status === "RESOLVED" || c.status === "CLOSED"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : c.status === "BLOCKED" || c.status === "ESCALATED"
                                        ? "bg-rose-100 text-rose-800"
                                        : c.status === "NEEDS_ATTENTION"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {c.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      c.priority === "URGENT"
                                        ? "bg-rose-100 text-rose-800"
                                        : c.priority === "HIGH"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {c.priority}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-700 font-medium">
                                  {c.detectedGapsCount > 0 ? (
                                    <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      {c.detectedGapsCount} gap(s)
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-medium">Clear</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setReassigningCase(c);
                                        setNewAshaUid(c.assignedAshaUid);
                                        setReassignError(null);
                                      }}
                                      className="text-xs py-1 px-2.5 font-semibold text-slate-700"
                                    >
                                      Reassign
                                    </Button>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => openCaseDetail(c.id)}
                                      className="text-xs py-1 px-2.5 font-semibold bg-teal-800 hover:bg-teal-900 text-white"
                                    >
                                      Open Case
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Stacked Cards */}
                    <div className="md:hidden space-y-3">
                      {filteredHouseholds.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">{c.headOfHouseholdName}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {c.district}, {c.state}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                c.status === "RESOLVED" || c.status === "CLOSED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.status === "BLOCKED" || c.status === "ESCALATED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-slate-500">ASHA:</span>
                            <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              {c.assignedAshaUid}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500">Priority:</span>
                            <span className="font-bold text-slate-800">{c.priority}</span>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReassigningCase(c);
                                setNewAshaUid(c.assignedAshaUid);
                                setReassignError(null);
                              }}
                              className="text-xs font-semibold text-slate-700 w-1/2"
                            >
                              Reassign
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openCaseDetail(c.id)}
                              className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white w-1/2"
                            >
                              Open Case
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* C3. ASHA WORKFORCE MANAGEMENT TAB */}
            {/* ============================================================ */}
            {activeTab === "ashas" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      ASHA Workforce Management &amp; Allocation
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Operational overview of registered ASHA field workers, assigned caseloads, and delivery workloads.
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <Input
                      placeholder="Search ASHA name, UID, or district..."
                      value={ashaSearch}
                      onChange={(e) => setAshaSearch(e.target.value)}
                      className="text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Workforce Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Total ASHA Workers
                    </span>
                    <p className="text-2xl font-black text-slate-900 mt-1">{totalAshasCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Active in field</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                      Assigned Households
                    </span>
                    <p className="text-2xl font-black text-teal-950 mt-1">{totalHouseholdsCount}</p>
                    <p className="text-[11px] text-teal-700 mt-0.5">Under frontline care</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                      Active Cases Under Care
                    </span>
                    <p className="text-2xl font-black text-blue-950 mt-1">{activeCasesCount}</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">Open assistance cases</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                      Pending / Overdue Visits
                    </span>
                    <p className="text-2xl font-black text-rose-950 mt-1">{actionableFollowUpsCount}</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">Requiring home visits</p>
                  </div>
                </div>

                {/* ASHA Workforce Roster */}
                {filteredAshas.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 space-y-1">
                    <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">No ASHA workers match this filter</p>
                    <p className="text-slate-500">Try searching for another worker name or UID.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAshas.map((worker) => (
                      <div
                        key={worker.ashaUid}
                        className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">{worker.ashaName}</h3>
                              <p className="text-xs font-mono text-slate-500 mt-0.5">UID: {worker.ashaUid}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ACTIVE
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Jurisdiction / Coverage:
                            </span>
                            <p className="font-semibold text-slate-700">
                              {worker.districts.length > 0 ? worker.districts.join(", ") : "General District Area"}
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="p-2 bg-slate-50/70 rounded border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-semibold">Households</span>
                              <strong className="text-sm font-extrabold text-slate-900">{worker.totalCases}</strong>
                            </div>
                            <div className="p-2 bg-blue-50/50 rounded border border-blue-100">
                              <span className="text-[10px] text-blue-600 block font-semibold">Active</span>
                              <strong className="text-sm font-extrabold text-blue-950">{worker.activeCases}</strong>
                            </div>
                            <div className="p-2 bg-rose-50/50 rounded border border-rose-100">
                              <span className="text-[10px] text-rose-600 block font-semibold">Overdue</span>
                              <strong className="text-sm font-extrabold text-rose-950">{worker.overdueFollowUps}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setHouseholdSearch(worker.ashaUid);
                              setActiveTab("households");
                            }}
                            className="text-xs font-semibold text-slate-700 w-1/2"
                          >
                            Households
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCaseSearch(worker.ashaUid);
                              setActiveTab("cases");
                            }}
                            className="text-xs font-semibold text-teal-900 border-teal-200 bg-teal-50/50 hover:bg-teal-50 w-1/2"
                          >
                            Cases ({worker.activeCases})
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* C4. ASSISTANCE & CASE OVERSIGHT TAB */}
            {/* ============================================================ */}
            {activeTab === "cases" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Platform Healthcare Case Oversight
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Active healthcare journey milestones, entitlement progress, task completion, and escalation tracking.
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <Input
                      placeholder="Search case, head, district, scheme..."
                      value={caseSearch}
                      onChange={(e) => setCaseSearch(e.target.value)}
                      className="text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { id: "ALL", label: `All Cases (${totalHouseholdsCount})` },
                    { id: "ACTIVE", label: `Active (${activeCasesCount})` },
                    { id: "NEEDS_ATTENTION", label: `Needs Attention (${needsAttentionCount})` },
                    { id: "IN_PROGRESS", label: `In Progress (${inProgressCount})` },
                    { id: "BLOCKED", label: `Blocked / Escalated (${blockedCasesCount})` },
                    { id: "RESOLVED", label: `Resolved (${resolvedCasesCount})` },
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      onClick={() => setCaseStatusFilter(pill.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        caseStatusFilter === pill.id
                          ? "bg-slate-900 text-white shadow-2xs"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Cases Roster */}
                {filteredCases.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 space-y-1">
                    <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">No cases match this filter</p>
                    <p className="text-slate-500">All cases in this category are clear or match another query.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th className="py-3 px-4">Household &amp; Beneficiary</th>
                              <th className="py-3 px-4">Location</th>
                              <th className="py-3 px-4">Active Scheme</th>
                              <th className="py-3 px-4">Assigned ASHA</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4">Priority</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredCases.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3.5 px-4">
                                  <span className="font-bold text-slate-900 block">{c.headOfHouseholdName}</span>
                                  <span className="text-[10px] font-mono text-slate-400">ID: {c.id.slice(0, 10)}...</span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-700">
                                  {c.district}, {c.state}
                                </td>
                                <td className="py-3.5 px-4">
                                  {c.schemeName || c.schemeId ? (
                                    <span className="px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded font-semibold text-[10px]">
                                      {c.schemeName || c.schemeId}
                                    </span>
                                  ) : c.eligibleSchemesCount > 0 ? (
                                    <span className="text-blue-700 font-medium text-[11px]">
                                      {c.eligibleSchemesCount} eligible pathway(s)
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">General Enrollment</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-slate-700">
                                  {c.assignedAshaUid}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                      c.status === "RESOLVED" || c.status === "CLOSED"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : c.status === "BLOCKED" || c.status === "ESCALATED"
                                        ? "bg-rose-100 text-rose-800"
                                        : c.status === "NEEDS_ATTENTION"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {c.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      c.priority === "URGENT"
                                        ? "bg-rose-100 text-rose-800"
                                        : c.priority === "HIGH"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {c.priority}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => openCaseDetail(c.id)}
                                    className="text-xs py-1 px-3 font-semibold bg-teal-800 hover:bg-teal-900 text-white"
                                  >
                                    Review Case
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Stacked Cards */}
                    <div className="md:hidden space-y-3">
                      {filteredCases.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">{c.headOfHouseholdName}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {c.district}, {c.state} • ASHA: <span className="font-mono">{c.assignedAshaUid}</span>
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                c.status === "RESOLVED" || c.status === "CLOSED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.status === "BLOCKED" || c.status === "ESCALATED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>

                          {c.schemeName && (
                            <div>
                              <span className="px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded font-semibold text-[10px]">
                                {c.schemeName}
                              </span>
                            </div>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">
                              Priority: <strong className="text-slate-800">{c.priority}</strong>
                            </span>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openCaseDetail(c.id)}
                              className="text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white"
                            >
                              Review Case
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* C5. SCHEMES & ELIGIBILITY OVERSIGHT TAB */}
            {/* ============================================================ */}
            {activeTab === "schemes" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      National Healthcare Scheme Registry &amp; Gazette Provenance
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Verified deterministic rule definitions, gazette citations, and active platform enrollments.
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <Input
                      placeholder="Search schemes by name or code..."
                      value={schemeSearch}
                      onChange={(e) => setSchemeSearch(e.target.value)}
                      className="text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Scheme Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Active Verified Schemes
                    </span>
                    <p className="text-2xl font-black text-slate-900 mt-1">{schemes.length}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">Deterministic Rule Sets</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                      Verified Gazette Records
                    </span>
                    <p className="text-2xl font-black text-teal-950 mt-1">{schemeEvidence.length}</p>
                    <p className="text-[11px] text-teal-700 mt-0.5">Government Citations</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                      Schemes with Active Care
                    </span>
                    <p className="text-2xl font-black text-blue-950 mt-1">{schemesWithActiveAssistanceCount}</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">Doorstep delivery underway</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Rule Verification Engine
                    </span>
                    <p className="text-sm font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded inline-block border border-emerald-200 mt-2">
                      AUTHORITATIVE
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Zero Hallucination</p>
                  </div>
                </div>

                {/* Schemes Catalog Table */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Scheme Code</th>
                          <th className="py-3 px-4">Official Scheme Name</th>
                          <th className="py-3 px-4">Level</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Active Cases</th>
                          <th className="py-3 px-4 text-right">Source Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSchemes.map((s) => {
                          const activeForScheme = adminCases.filter((c) =>
                            c.schemeId === s.id && !["RESOLVED", "CLOSED"].includes(c.status)
                          ).length;

                          return (
                            <tr
                              key={s.id}
                              onClick={() => setSelectedSchemeId(s.id)}
                              className={`cursor-pointer transition-colors ${
                                selectedSchemeId === s.id
                                  ? "bg-teal-50/50 font-medium"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.id}</td>
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-900 block">{s.name}</span>
                                <span className="text-[11px] text-slate-500">{s.benefitSummary}</span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">{s.level}</td>
                              <td className="py-3.5 px-4 text-slate-700">{s.category}</td>
                              <td className="py-3.5 px-4">
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-800">
                                {activeForScheme}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {s.sourceMetadata?.isVerified ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{s.sourceMetadata.sourceOrganization}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-700 font-medium">
                                    Pending Audit
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Scheme Verified Evidence Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-teal-700" />
                      <span>Verified Evidence Citations for: <strong className="text-teal-900">{selectedSchemeId}</strong></span>
                    </h3>
                  </div>

                  {loadingEvidence ? (
                    <div className="py-6">
                      <LoadingState message="Loading verified gazette evidence records..." />
                    </div>
                  ) : schemeEvidence.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
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
                            <h4 className="text-xs font-bold text-slate-900">{ev.officialTitle}</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Org: {ev.sourceOrganization} • Domain: {ev.sourceDomain}
                            </p>
                          </div>

                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 italic leading-relaxed">
                            &ldquo;{ev.relevantExcerpt}&rdquo;
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>VERIFIED GAZETTE</span>
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
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* C6. SYSTEM / OPERATIONAL MONITORING TAB */}
            {/* ============================================================ */}
            {activeTab === "monitoring" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-700" />
                    <span>Operational Telemetry &amp; System Infrastructure</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Live operational telemetry, telephony engine monitoring, follow-up execution roster, and domain automation event logs.
                  </p>
                </div>

                {/* Section A: Voice Telephony & Speech Engine (Phase 11) */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-emerald-700" />
                      <span>Sarvam AI &amp; Exotel Voice Telephony Engine</span>
                    </h3>
                    <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded">
                      Helpline: {voiceTelemetry?.virtualNumber || "+91-1800-SWASTHYA"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                        Sarvam STT / TTS
                      </span>
                      <p className={`text-base font-bold ${voiceTelemetry?.sarvamConfigured ? "text-emerald-700" : "text-amber-700"}`}>
                        {voiceTelemetry?.sarvamConfigured ? "Active (saaras:v2)" : "Local Engine"}
                      </p>
                      <p className="text-[11px] text-slate-400">Multilingual Speech Engine</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                        Exotel Telephony
                      </span>
                      <p className={`text-base font-bold ${voiceTelemetry?.exotelConfigured ? "text-emerald-700" : "text-amber-700"}`}>
                        {voiceTelemetry?.exotelConfigured ? "Connected (PSTN)" : "Local Test Mode"}
                      </p>
                      <p className="text-[11px] text-slate-400">Carrier Outbound / IVR</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
                      <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide block">
                        Calls Today
                      </span>
                      <p className="text-2xl font-bold text-blue-950">
                        {voiceTelemetry?.totalCallsToday || 0}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {voiceTelemetry?.completedCallsToday || 0} completed, {voiceTelemetry?.noAnswerCallsToday || 0} no answer
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
                      <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide block">
                        Avg Call Duration
                      </span>
                      <p className="text-2xl font-bold text-teal-950">
                        {voiceTelemetry?.averageDurationSeconds || 0}s
                      </p>
                      <p className="text-[11px] text-slate-400">Cost Controlled (Max 300s)</p>
                    </div>
                  </div>

                  {/* Recent Voice Sessions Table */}
                  {voiceTelemetry?.recentSessions && voiceTelemetry.recentSessions.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                      <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
                        <Mic className="w-3.5 h-3.5 text-teal-700" />
                        <h4 className="text-xs font-bold text-slate-900">Recent Voice Helpline &amp; Reminder Sessions</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th className="py-2.5 px-4">Session SID</th>
                              <th className="py-2.5 px-4">Direction</th>
                              <th className="py-2.5 px-4">Caller (Masked)</th>
                              <th className="py-2.5 px-4">Intent</th>
                              <th className="py-2.5 px-4">Duration</th>
                              <th className="py-2.5 px-4">Outcome</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {voiceTelemetry.recentSessions.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-mono text-[11px] text-slate-800">{s.callSid}</td>
                                <td className="py-2.5 px-4 font-semibold text-slate-700">{s.direction}</td>
                                <td className="py-2.5 px-4 font-mono text-slate-600">{s.maskedNumber}</td>
                                <td className="py-2.5 px-4 text-teal-800 font-semibold">{s.intent || "GENERAL"}</td>
                                <td className="py-2.5 px-4 text-slate-600">{s.durationSeconds ? `${s.durationSeconds}s` : "--"}</td>
                                <td className="py-2.5 px-4">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                    {s.outcome || s.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section B: Follow-up & Visit Tasks Roster */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-700" />
                        <span>Platform-Wide Follow-up &amp; Outreach Roster ({adminFollowUps.length})</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Track scheduled home visits, pending verifications, and completed field tasks.
                      </p>
                    </div>

                    <div className="w-full sm:w-64">
                      <Input
                        placeholder="Search follow-ups..."
                        value={followUpSearch}
                        onChange={(e) => setFollowUpSearch(e.target.value)}
                        className="text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* Filter Pills Bar */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[
                      { id: "ALL", label: `All Follow-ups (${totalFollowUpsCount})` },
                      { id: "OVERDUE", label: `Overdue (${overdueFollowUpsCount})` },
                      { id: "DUE_TODAY", label: `Due Today (${dueTodayFollowUpsCount})` },
                      { id: "UPCOMING", label: `Upcoming (${upcomingFollowUpsCount})` },
                      { id: "COMPLETED", label: `Completed (${completedFollowUpsCount})` },
                      { id: "CANCELLED", label: `Cancelled (${cancelledFollowUpsCount})` },
                    ].map((pill) => (
                      <button
                        key={pill.id}
                        onClick={() => setFollowUpFilter(pill.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                          followUpFilter === pill.id
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  {/* Follow-ups Table */}
                  {filteredFollowUps.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                      No follow-ups recorded in this category.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th className="py-3 px-4">Task &amp; Scheme</th>
                              <th className="py-3 px-4">Household</th>
                              <th className="py-3 px-4">Assigned ASHA</th>
                              <th className="py-3 px-4">Due Date</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredFollowUps.map((f) => (
                              <tr key={f.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <p className="font-bold text-slate-900">{f.title || f.reason}</p>
                                  {f.schemeName && (
                                    <span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                                      {f.schemeName}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  {f.headOfHouseholdName || "Registered Family"}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600">
                                  {f.assignedAshaUid || "General"}
                                </td>
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
                                    {f.status === "COMPLETED"
                                      ? "COMPLETED"
                                      : f.status === "CANCELLED"
                                      ? "CANCELLED"
                                      : f.isOverdue
                                      ? "OVERDUE"
                                      : "PENDING"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openCaseDetail(f.caseId)}
                                    className="text-xs font-semibold py-1 px-2.5 text-slate-700 hover:bg-slate-100"
                                  >
                                    Open Case
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

                {/* Section C: Automation Health & Domain Event Logs (Phase 10) */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-teal-700" />
                      <span>n8n Workflow Automation Dispatcher &amp; Domain Event Logs</span>
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      Status: {automationHealth?.status || "OPERATIONAL"}
                    </span>
                  </div>

                  {automationHealth?.recentEvents && automationHealth.recentEvents.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                      <div className="p-3 border-b border-slate-200 bg-slate-50/50">
                        <h4 className="text-xs font-bold text-slate-900">Recent Domain Automation Dispatches</h4>
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
                            {automationHealth.recentEvents.slice(0, 8).map((evt) => (
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
                </div>

                {/* Section D: Server-Side Governance & RBAC */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div>Consent Enforcement: requireConsent Active</div>
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
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* CASE DETAIL DRAWER */}
        {/* ============================================================ */}
        {selectedCaseId && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
            <div
              className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
            >
              <div className="p-5 sm:p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 uppercase">
                      Administrative Case Inspection
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                      {caseDetail?.case.headOfHouseholdName || "Household Profile"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Case ID: <span className="font-mono">{selectedCaseId}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCaseId(null);
                      setCaseDetail(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isCaseDetailLoading ? (
                  <div className="py-16 text-center">
                    <LoadingState message="Loading aggregated case records and journey steps..." />
                  </div>
                ) : !caseDetail ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Failed to load case detail.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Case Status & Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                        <span className="text-xs font-bold text-slate-900 mt-0.5 block">
                          {caseDetail.case.status}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Priority</span>
                        <span className="text-xs font-bold text-slate-900 mt-0.5 block">
                          {caseDetail.case.priority}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Assigned ASHA</span>
                        <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block truncate">
                          {caseDetail.case.assignedAshaUid}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Location</span>
                        <span className="text-xs font-bold text-slate-900 mt-0.5 block truncate">
                          {caseDetail.case.district}
                        </span>
                      </div>
                    </div>

                    {/* Family Members */}
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-teal-700" />
                        <span>Family Members ({caseDetail.members.length})</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {caseDetail.members.map((m) => (
                          <div
                            key={m.id}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{m.fullName}</span>
                              <span className="text-[10px] font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {m.relationship}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Age: {m.age} yrs • Gender: {m.gender}
                              {m.maternalStatus === "pregnant" && " • Pregnant"}
                              {m.disabilityStatus && " • Disability"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Journey Steps */}
                    {caseDetail.journeySteps && caseDetail.journeySteps.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Workflow className="w-3.5 h-3.5 text-teal-700" />
                          <span>Scheme Journey Progression</span>
                        </h3>
                        <div className="space-y-2">
                          {caseDetail.journeySteps.map((step, idx) => (
                            <div
                              key={step.stepId || idx}
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                                step.status === "COMPLETED"
                                  ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                                  : step.status === "CURRENT"
                                  ? "bg-blue-50/50 border-blue-200 text-blue-950"
                                  : "bg-slate-50 border-slate-200 text-slate-600"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                                    step.status === "COMPLETED"
                                      ? "bg-emerald-600 text-white"
                                      : step.status === "CURRENT"
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <div>
                                  <span className="font-bold block">{step.title}</span>
                                  <span className="text-[11px] opacity-80">{step.description}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-slate-200">
                                {step.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tasks Checklist */}
                    {caseDetail.tasks && caseDetail.tasks.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5 text-teal-700" />
                          <span>Actionable Tasks ({caseDetail.tasks.length})</span>
                        </h3>
                        <div className="space-y-2">
                          {caseDetail.tasks.map((t) => (
                            <div
                              key={t.id}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-900 block">{t.title}</span>
                                <p className="text-[11px] text-slate-600">{t.description}</p>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                                  t.status === "COMPLETED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Healthcare Gaps */}
                    {caseDetail.guidance && caseDetail.guidance.gaps.length > 0 && (
                      <div className="space-y-2.5">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Identified Healthcare Gaps ({caseDetail.guidance.gaps.length})</span>
                        </h3>
                        <div className="space-y-2">
                          {caseDetail.guidance.gaps.map((gap, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-amber-50/40 rounded-xl border border-amber-200 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-950">{gap.title}</span>
                                <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded">
                                  {gap.priority}
                                </span>
                              </div>
                              <p className="text-[11px] text-amber-900 leading-relaxed">{gap.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (caseDetail) {
                      setReassigningCase(caseDetail.case);
                      setNewAshaUid(caseDetail.case.assignedAshaUid);
                      setReassignError(null);
                    }
                  }}
                  className="text-xs font-semibold text-slate-700"
                >
                  Reassign ASHA
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedCaseId(null);
                    setCaseDetail(null);
                  }}
                  className="text-xs font-semibold bg-slate-900 text-white"
                >
                  Close Inspection
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REASSIGN ASHA MODAL */}
        {/* ============================================================ */}
        {reassigningCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-teal-700" />
                  <h3 className="font-bold text-slate-900 text-base">Reassign Household Case</h3>
                </div>
                <button
                  onClick={() => setReassigningCase(null)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <p className="text-slate-500">Target Family:</p>
                  <p className="font-bold text-slate-900 text-sm">{reassigningCase.headOfHouseholdName}</p>
                  <p className="text-slate-500">Location: {reassigningCase.district}, {reassigningCase.state}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">
                    Target ASHA Worker UID:
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter target ASHA UID..."
                    value={newAshaUid}
                    onChange={(e) => setNewAshaUid(e.target.value)}
                    className="text-xs font-mono bg-white"
                  />
                  <p className="text-[11px] text-slate-400">
                    The case will be transferred with full history, notes, and journey step status.
                  </p>
                </div>

                {reassignError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>{reassignError}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReassigningCase(null)}
                  disabled={isReassigning}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReassignAsha}
                  disabled={isReassigning}
                  className="text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white"
                >
                  {isReassigning ? "Reassigning..." : "Confirm Reassignment"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* SwasthyaSetu Healthcare Assistant Drawer */}
        <HealthcareAssistantDrawer
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          userRole="ADMIN"
        />
      </AuthenticatedShell>
    </ProtectedRoute>
  );
}
