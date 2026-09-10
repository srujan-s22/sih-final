"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { nfcService } from "@/services/nfc-service";
import {
  isNfcWritingSupported,
  buildNfcUrl,
  writeNfcTag,
} from "@/lib/nfc/nfc-writer";
import { HouseholdNfcStatusResponse } from "@shared/types/nfc";
import {
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Copy,
  Check,
  ShieldAlert,
  Trash2,
} from "lucide-react";

export interface AshaNfcModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  headOfHouseholdName: string;
  village?: string;
  district?: string;
  state?: string;
  onNfcStatusChanged?: () => void;
}

type ModalStep =
  | "INITIAL_CHECK"
  | "STATUS_OVERVIEW"
  | "CONFIRM_PROVISION"
  | "CONFIRM_ROTATE"
  | "CONFIRM_REVOKE"
  | "GENERATING_CREDENTIAL"
  | "WAITING_FOR_TAP"
  | "SUCCESS"
  | "ERROR";

interface NfcModalErrorBoundaryProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

interface NfcModalErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class NfcModalErrorBoundary extends React.Component<
  NfcModalErrorBoundaryProps,
  NfcModalErrorBoundaryState
> {
  constructor(props: NfcModalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): NfcModalErrorBoundaryState {
    const msg = error instanceof Error ? error.message : "An unexpected NFC dialog error occurred.";
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("AshaNfcModal caught unhandled exception:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.props.isOpen) {
      return (
        <Modal
          isOpen={this.props.isOpen}
          onClose={() => {
            this.setState({ hasError: false, errorMessage: null });
            this.props.onClose();
          }}
          title="NFC Management Unavailable"
          description="A client-side error occurred while displaying the NFC modal."
          className="max-w-md"
        >
          <div className="p-4 space-y-4 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-sm text-red-900">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Could not load NFC interface</span>
              </p>
              <p className="text-slate-600">
                {this.state.errorMessage || "Please try again or contact system support."}
              </p>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: null });
                  this.props.onClose();
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      );
    }
    return this.props.children;
  }
}

function AshaNfcModalInner({
  isOpen,
  onClose,
  householdId,
  headOfHouseholdName,
  village,
  district,
  state: stateName,
  onNfcStatusChanged,
}: AshaNfcModalProps) {
  const [step, setStep] = useState<ModalStep>("INITIAL_CHECK");
  const [statusData, setStatusData] = useState<HouseholdNfcStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [nfcVersion, setNfcVersion] = useState<number>(1);
  const [copied, setCopied] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [isRotationFlow, setIsRotationFlow] = useState(false);

  // In-memory one-time token & URL ref (NEVER stored in persistent browser storage)
  const currentTokenRef = useRef<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const pendingNfcIdRef = useRef<string | null>(null);
  const isRotationRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup helper
  const clearSensitiveMemory = () => {
    currentTokenRef.current = null;
    currentUrlRef.current = null;
    pendingNfcIdRef.current = null;
    isRotationRef.current = false;
    setIsRotationFlow(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Safe modal close wrapper
  const handleModalClose = () => {
    clearSensitiveMemory();
    setStep("INITIAL_CHECK");
    setErrorMessage(null);
    setSuccessMessage(null);
    setRevokeReason("");
    setCopied(false);
    onClose();
  };

  // Check Web NFC capability & load status when modal opens
  useEffect(() => {
    if (!isOpen) return;

    try {
      setIsNfcSupported(isNfcWritingSupported());
    } catch {
      setIsNfcSupported(false);
    }
    let mounted = true;

    async function loadStatus() {
      setLoading(true);
      setStep("INITIAL_CHECK");
      setErrorMessage(null);
      try {
        if (!householdId || !householdId.trim()) {
          if (mounted) {
            setErrorMessage("No household ID associated with this case.");
            setStep("ERROR");
          }
          return;
        }
        const res = await nfcService.getHouseholdNfcStatus(householdId.trim());
        if (!mounted) return;
        if (res.success) {
          setStatusData(res.data);
          setStep("STATUS_OVERVIEW");
        } else {
          setErrorMessage(
            res.error?.message || "Failed to retrieve household NFC status."
          );
          setStep("ERROR");
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : "Failed to connect to backend NFC service.";
          setErrorMessage(msg);
          setStep("ERROR");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStatus();

    return () => {
      mounted = false;
      clearSensitiveMemory();
    };
  }, [isOpen, householdId]);

  // Trigger physical NFC write via Web NFC API
  const startPhysicalWrite = async (nfcUrl: string, targetVersion: number) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStep("WAITING_FOR_TAP");
    setErrorMessage(null);

    // If Web NFC is supported by the browser, initiate write listener
    if (isNfcWritingSupported()) {
      const result = await writeNfcTag(nfcUrl, controller.signal);
      if (result.success) {
        // If this is a rotation, atomically activate the pending card and revoke the old card
        if (isRotationRef.current && pendingNfcIdRef.current) {
          try {
            const confirmRes = await nfcService.confirmRotateNfc(
              householdId,
              pendingNfcIdRef.current,
              targetVersion,
              revokeReason || "REPLACEMENT_CONFIRMED"
            );
            if (!confirmRes.success) {
              setErrorMessage(
                confirmRes.error.message ||
                  "Card was written physically, but failed to activate replacement on server."
              );
              setStep("ERROR");
              return;
            }
          } catch {
            setErrorMessage(
              "Card was written physically, but server activation failed. Your previous card remains active."
            );
            setStep("ERROR");
            return;
          }
        }

        clearSensitiveMemory();
        setSuccessMessage(
          isRotationRef.current
            ? "The replacement NFC card was successfully written and activated. The previous card is now deactivated."
            : "The NFC tag was successfully written and linked."
        );
        setStep("SUCCESS");
        onNfcStatusChanged?.();
      } else {
        // Only set error if not intentionally cancelled
        if (result.error !== "NFC write operation was cancelled.") {
          setErrorMessage(
            isRotationRef.current
              ? `Could not write the new NFC card: ${result.error || "Write failed"}. Your existing NFC card is still active.`
              : result.error || "Failed to write NFC tag."
          );
          setStep("ERROR");
        }
      }
    }
  };

  // Provision new NFC credential
  const handleStartProvisioning = async () => {
    setStep("GENERATING_CREDENTIAL");
    setLoading(true);
    setErrorMessage(null);
    isRotationRef.current = false;
    setIsRotationFlow(false);
    pendingNfcIdRef.current = null;

    try {
      const res = await nfcService.provisionNfc(householdId);
      if (res.success) {
        const { token, version } = res.data;
        setNfcVersion(version);

        // Store one-time raw token in memory only
        currentTokenRef.current = token;
        const nfcUrl = buildNfcUrl(householdId, token, undefined, version);
        currentUrlRef.current = nfcUrl;

        setLoading(false);
        await startPhysicalWrite(nfcUrl, version);
      } else {
        setErrorMessage(
          res.error.message || "Failed to generate NFC credential on server."
        );
        setStep("ERROR");
        setLoading(false);
      }
    } catch {
      setErrorMessage("Network error while communicating with NFC service.");
      setStep("ERROR");
      setLoading(false);
    }
  };

  // Rotate existing NFC credential
  const handleStartRotation = async () => {
    setStep("GENERATING_CREDENTIAL");
    setLoading(true);
    setErrorMessage(null);
    isRotationRef.current = true;
    setIsRotationFlow(true);

    try {
      const res = await nfcService.rotateNfc(
        householdId,
        revokeReason || "ROTATION_REPLACEMENT"
      );
      if (res.success) {
        const { token, version } = res.data;
        setNfcVersion(version);
        pendingNfcIdRef.current = `nfc_${householdId}_v${version}`;

        currentTokenRef.current = token;
        const nfcUrl = buildNfcUrl(householdId, token, undefined, version);
        currentUrlRef.current = nfcUrl;

        setLoading(false);
        await startPhysicalWrite(nfcUrl, version);
      } else {
        setErrorMessage(
          res.error.message || "Failed to rotate NFC credential."
        );
        setStep("ERROR");
        setLoading(false);
      }
    } catch {
      setErrorMessage("Network error while rotating NFC credential.");
      setStep("ERROR");
      setLoading(false);
    }
  };

  // Revoke NFC credential
  const handleConfirmRevoke = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await nfcService.revokeNfc(
        householdId,
        revokeReason || "MANUAL_REVOCATION"
      );
      if (res.success) {
        setSuccessMessage("The NFC credential has been revoked.");
        setStep("SUCCESS");
        onNfcStatusChanged?.();
      } else {
        setErrorMessage(res.error.message || "Failed to revoke NFC credential.");
        setStep("ERROR");
      }
    } catch {
      setErrorMessage("Network error while revoking NFC credential.");
      setStep("ERROR");
    } finally {
      setLoading(false);
    }
  };

  // Clean cancellation of an in-progress write
  const handleCancelWrite = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    try {
      if (isRotationRef.current) {
        // Cancel pending replacement so existing active card stays completely valid!
        await nfcService.cancelRotateNfc(
          householdId,
          pendingNfcIdRef.current || undefined,
          "WRITE_CANCELLED_OR_FAILED"
        );
      } else {
        // Initial provision cancellation revokes the unwritten credential
        await nfcService.revokeNfc(householdId, "WRITE_CANCELLED_OR_FAILED");
      }
    } catch {
      // Best-effort cleanup
    }

    clearSensitiveMemory();
    handleModalClose();
  };

  // Retry write using the current in-memory token
  const handleRetryWrite = async () => {
    if (currentUrlRef.current) {
      await startPhysicalWrite(currentUrlRef.current, nfcVersion);
    } else {
      // If token was lost, restart from status overview
      setStep("STATUS_OVERVIEW");
    }
  };

  // Fallback demo simulation
  const handleSimulateDemoWrite = async () => {
    if (isRotationRef.current && pendingNfcIdRef.current) {
      try {
        await nfcService.confirmRotateNfc(
          householdId,
          pendingNfcIdRef.current,
          nfcVersion,
          revokeReason || "REPLACEMENT_DEMO_CONFIRMED"
        );
      } catch {
        // Best-effort confirmation in demo mode
      }
    }
    clearSensitiveMemory();
    setSuccessMessage(
      isRotationRef.current
        ? "Replacement tag write simulated successfully. Previous card deactivated (Demo Mode)."
        : "Tag write simulated successfully (Demo Mode)."
    );
    setStep("SUCCESS");
    onNfcStatusChanged?.();
  };

  const handleCopyUrl = () => {
    if (currentUrlRef.current) {
      navigator.clipboard.writeText(currentUrlRef.current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Household NFC Card Management"
      description={`Manage physical NFC access card for ${headOfHouseholdName}`}
      className="max-w-lg"
    >
      <div className="space-y-4 py-1 text-slate-800">
        {/* Household Identification Card */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Target Household
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {headOfHouseholdName}
              </span>
              <p className="text-slate-500 mt-0.5">
                {[village, district, stateName].filter(Boolean).join(", ")}
              </p>
            </div>
            <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              {householdId}
            </span>
          </div>
        </div>

        {/* STEP: INITIAL CHECK LOADING */}
        {step === "INITIAL_CHECK" && (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-700 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Checking household NFC status...</p>
          </div>
        )}

        {/* STEP: STATUS OVERVIEW */}
        {step === "STATUS_OVERVIEW" && statusData && (
          <div className="space-y-4">
            {statusData.hasActiveNfc && statusData.record ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">
                        NFC Card Active & Linked
                      </h4>
                      <p className="text-xs text-emerald-800">
                        Version {statusData.record.version} • Registered on{" "}
                        {new Date(statusData.record.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
                    Active
                  </span>
                </div>

                {statusData.pendingReplacement && (
                  <div className="text-[11px] text-amber-800 bg-amber-100/60 border border-amber-300/80 rounded-lg p-2.5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      A replacement (Version {statusData.pendingReplacement.version}) was previously started but not confirmed. The current card remains active.
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("CONFIRM_ROTATE")}
                    className="text-xs font-semibold flex items-center gap-1 border-emerald-300 text-emerald-900 hover:bg-emerald-100/70"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Replace NFC Card</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("CONFIRM_REVOKE")}
                    className="text-xs text-red-700 hover:bg-red-50 hover:text-red-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Card</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center mx-auto">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    No NFC Card Registered
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Associate a physical NFC sticker or card with this household so
                    family members can tap to view their eligible healthcare schemes.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setStep("CONFIRM_PROVISION")}
                    className="text-xs font-semibold flex items-center gap-2 mx-auto"
                  >
                    <Radio className="w-4 h-4" />
                    <span>Register NFC Card</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: CONFIRM PROVISION */}
        {step === "CONFIRM_PROVISION" && (
          <div className="space-y-4">
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-teal-950 text-sm flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-teal-700" />
                <span>Confirm NFC Registration</span>
              </h4>
              <p className="text-slate-600 leading-relaxed">
                This will generate a cryptographically secure, privacy-minimal access
                link for <strong>{headOfHouseholdName}</strong>. Please ensure you have
                an NDEF-compatible NFC tag ready.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("STATUS_OVERVIEW")}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartProvisioning}
                className="font-semibold"
              >
                Continue & Write NFC
              </Button>
            </div>
          </div>
        )}

        {/* STEP: CONFIRM ROTATION */}
        {step === "CONFIRM_ROTATE" && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <span>Replace Existing NFC Card</span>
              </h4>
              <p className="text-amber-900 leading-relaxed">
                Your current NFC card will <strong>remain active</strong> until the new card is successfully written.
                Once confirmed, the new card (Version {(statusData?.record?.version || 1) + 1}) will activate and the previous card will be deactivated.
              </p>
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Reason for Replacement (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Card lost or damaged"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full text-xs py-1.5 px-2.5 rounded border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("STATUS_OVERVIEW")}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartRotation}
                className="font-semibold bg-amber-700 hover:bg-amber-800 text-white"
              >
                Proceed to Replace Card
              </Button>
            </div>
          </div>
        )}

        {/* STEP: CONFIRM REVOKE */}
        {step === "CONFIRM_REVOKE" && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-red-950 text-sm flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-red-700" />
                <span>Revoke Household NFC Card</span>
              </h4>
              <p className="text-red-900 leading-relaxed">
                Are you sure you want to deactivate this household&apos;s NFC card? Once
                revoked, tapping the physical card will no longer work.
              </p>
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Reason for Revocation (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Card reported stolen or deceased head"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full text-xs py-1.5 px-2.5 rounded border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("STATUS_OVERVIEW")}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmRevoke}
                disabled={loading}
                className="font-semibold bg-red-700 hover:bg-red-800 text-white"
              >
                {loading ? "Revoking..." : "Confirm Revocation"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: GENERATING CREDENTIAL */}
        {step === "GENERATING_CREDENTIAL" && (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-700 animate-spin mx-auto" />
            <p className="text-xs text-slate-600 font-semibold">
              Generating secure household access token...
            </p>
            <p className="text-[11px] text-slate-400">
              Applying SHA-256 hash & Caseload validation
            </p>
          </div>
        )}

        {/* STEP: WAITING FOR PHYSICAL NFC TAP */}
        {step === "WAITING_FOR_TAP" && (
          <div className="space-y-4">
            {isNfcSupported ? (
              <div className="rounded-2xl bg-teal-50/80 border-2 border-dashed border-teal-300 p-8 text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-teal-200 animate-ping opacity-75" />
                  <div className="relative w-14 h-14 rounded-full bg-teal-700 text-white flex items-center justify-center shadow-lg">
                    <Smartphone className="w-7 h-7" />
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Hold NFC Card Near Phone
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                    Bring the physical NFC card or sticker within 2-3 cm of the back of
                    your phone and hold steady.
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-900 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                  <span>Waiting for tag... (Version {nfcVersion})</span>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelWrite}
                    className="text-xs text-slate-600"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* Fallback when browser lacks Web NFC API */
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Web NFC Not Supported on this Browser
                    </h4>
                    <p className="text-slate-600 mt-1 leading-relaxed">
                      Web NFC writing requires an NFC-enabled Android phone running Google
                      Chrome.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Authorized Demo Fallback — NDEF Deep-Link URL:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={currentUrlRef.current || ""}
                      className="w-full text-[11px] font-mono py-1.5 px-2 rounded bg-slate-100 border border-slate-200 text-slate-700"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyUrl}
                      className="shrink-0 flex items-center gap-1 text-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    You can copy this link into an external NFC tool (e.g. NFC Tools app)
                    or simulate a successful write for demo validation.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelWrite}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSimulateDemoWrite}
                    className="font-semibold"
                  >
                    Simulate Tag Write (Demo Mode)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === "SUCCESS" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900">
                NFC Registered Successfully
              </h4>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                {successMessage ||
                  "The physical NFC card is now linked to this household."}
              </p>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 inline-block text-left max-w-sm">
              <p>
                <strong>Household:</strong> {headOfHouseholdName}
              </p>
              <p>
                <strong>NFC Version:</strong> {nfcVersion}
              </p>
              <p>
                <strong>Status:</strong> Active & Ready for Tap
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleModalClose}
                className="font-semibold mx-auto px-8"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* STEP: ERROR / WRITE FAILED */}
        {step === "ERROR" && (
          <div className="py-4 space-y-4 text-xs">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>Could Not Complete NFC Operation</span>
              </div>
              <p className="text-red-800 leading-relaxed">
                {errorMessage ||
                  "An error occurred while communicating with the physical NFC tag or backend service."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelWrite}
              >
                {isRotationFlow ? "Cancel Replacement" : "Cancel"}
              </Button>
              {currentUrlRef.current && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRetryWrite}
                  className="font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Writing Again</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AshaNfcModal(props: AshaNfcModalProps) {
  return (
    <NfcModalErrorBoundary isOpen={props.isOpen} onClose={props.onClose}>
      <AshaNfcModalInner {...props} />
    </NfcModalErrorBoundary>
  );
}
