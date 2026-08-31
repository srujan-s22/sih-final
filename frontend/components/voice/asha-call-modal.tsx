"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { voiceService } from "@/services/voice-service";
import {
  VoiceSession,
  CallHistoryItem,
} from "@shared/types/voice";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Languages,
  History,
  RefreshCw,
  User,
  Home,
  FileText,
} from "lucide-react";

export interface AshaCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  citizenName?: string;
  headOfHousehold?: string;
  schemeName?: string;
  contactPhoneMasked?: string;
  followUpId?: string;
  defaultReason?: string;
  onCallComplete?: () => void;
}

const DEFAULT_LANGUAGES = [
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "en-IN", name: "English", nativeName: "English" },
];

export function AshaCallModal({
  isOpen,
  onClose,
  caseId,
  citizenName = "Beneficiary",
  headOfHousehold,
  schemeName = "Government Health Scheme",
  contactPhoneMasked = "+91 98*** **210",
  followUpId,
  defaultReason = "Doorstep visit & document verification reminder",
  onCallComplete,
}: AshaCallModalProps) {
  const [language, setLanguage] = useState("hi-IN");
  const [reason, setReason] = useState(defaultReason);
  const [activeTab, setActiveTab] = useState<"call" | "history">("call");

  // Call lifecycle states
  const [callState, setCallState] = useState<
    "IDLE" | "REQUESTING" | "INITIATED" | "RINGING" | "CONNECTED" | "COMPLETED" | "FAILED"
  >("IDLE");
  const [activeSession, setActiveSession] = useState<VoiceSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // History for this case
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason(defaultReason);
      loadCaseHistory();
    } else {
      resetState();
    }
  }, [isOpen, caseId, defaultReason]);

  // Handle call timer
  useEffect(() => {
    if (callState === "INITIATED" || callState === "RINGING" || callState === "CONNECTED") {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [callState]);

  const startPollingSession = (sessionId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await voiceService.getSession(sessionId);
        if (res.success && res.data) {
          const s = res.data;
          setActiveSession(s);

          if (s.status === "COMPLETED" || s.status === "ENDED") {
            setCallState("COMPLETED");
            stopPolling();
            loadCaseHistory();
            if (onCallComplete) onCallComplete();
          } else if (s.status === "FAILED" || s.callOutcome === "CALL_FAILED" || s.callOutcome === "CALL_NO_ANSWER") {
            setCallState("FAILED");
            setErrorMessage(
              s.callOutcome === "CALL_NO_ANSWER"
                ? "The beneficiary did not answer the phone."
                : "The telephony call could not be completed."
            );
            stopPolling();
            loadCaseHistory();
          } else if (s.status === "ACTIVE" || s.status === "PROCESSING" || s.status === "RESPONDING") {
            setCallState("CONNECTED");
          }
        }
      } catch {
        // Continue polling
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const resetState = () => {
    stopPolling();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setCallState("IDLE");
    setActiveSession(null);
    setErrorMessage(null);
    setCallDuration(0);
  };

  const loadCaseHistory = async () => {
    if (!caseId) return;
    setIsLoadingHistory(true);
    try {
      const res = await voiceService.getCaseCallHistory(caseId);
      if (res.success && res.data) {
        setHistory(res.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setCallState("REQUESTING");

    try {
      const res = await voiceService.ashaCallCitizen({
        caseId,
        followUpId,
        reason,
        language,
      });

      if (res.success) {
        if (res.data) {
          setActiveSession(res.data.session);
          setCallState("RINGING");
          setCallDuration(0);
          startPollingSession(res.data.session.id);
        }
      } else {
        setCallState("FAILED");
        setErrorMessage(res.error.message || "Failed to initiate ASHA outbound call.");
      }
    } catch (err: any) {
      setCallState("FAILED");
      setErrorMessage(err.message || "An unexpected error occurred while placing the call.");
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (callState === "INITIATED" || callState === "RINGING" || callState === "CONNECTED") {
          if (window.confirm("A telephony call is in progress. Are you sure you want to close this window?")) {
            resetState();
            onClose();
          }
        } else {
          resetState();
          onClose();
        }
      }}
      title="ASHA Beneficiary Voice Call"
      description="Initiate an automated voice reminder or connect with the beneficiary using Exotel telephony & Sarvam AI."
      className="max-w-xl"
    >
      <div className="space-y-4">
        {/* Case Context Summary Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <User className="w-3.5 h-3.5 text-teal-700" />
              {citizenName}
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              {schemeName}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
            {headOfHousehold && (
              <div className="flex items-center gap-1.5">
                <Home className="w-3 h-3 text-slate-400" />
                <span>Head: <strong className="text-slate-800">{headOfHousehold}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>Registered Phone: <strong className="text-slate-800 font-mono">{contactPhoneMasked}</strong></span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("call")}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "call"
                ? "border-teal-700 text-teal-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Initiate Call
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              loadCaseHistory();
            }}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-teal-700 text-teal-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Case Call Logs {history.length > 0 && `(${history.length})`}
          </button>
        </div>

        {/* Tab 1: Place Call */}
        {activeTab === "call" && (
          <div className="space-y-4 pt-1">
            {/* Active Call UI State */}
            {(callState === "RINGING" || callState === "CONNECTED" || callState === "REQUESTING") && (
              <div className="rounded-xl border border-teal-200 bg-gradient-to-b from-teal-50/90 to-white p-5 space-y-4 text-center">
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-teal-400/30 animate-ping" />
                  <div className="relative w-14 h-14 rounded-full bg-teal-700 text-white flex items-center justify-center shadow-md">
                    <Phone className="w-7 h-7 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                    <h4 className="text-sm font-bold text-slate-900">
                      {callState === "REQUESTING"
                        ? "Dispatching Outbound Telephony Call..."
                        : callState === "RINGING"
                        ? "Ringing Beneficiary Phone..."
                        : "Call In Progress with Beneficiary"}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    Calling <span className="font-semibold text-slate-900">{contactPhoneMasked}</span> on behalf of your ASHA workspace.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-600 bg-white/80 py-2 px-4 rounded-lg border border-teal-100 max-w-xs mx-auto">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-teal-700" />
                    Duration: {formatSeconds(callDuration)}
                  </span>
                  <span>•</span>
                  <span className="text-teal-800 font-semibold">
                    {callState === "CONNECTED" ? "CONNECTED" : "RINGING"}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetState}
                  className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  <PhoneOff className="w-3.5 h-3.5 mr-1" />
                  Cancel Call
                </Button>
              </div>
            )}

            {/* Completed Call UI State */}
            {callState === "COMPLETED" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-950">Call Completed</h4>
                  <p className="text-xs text-slate-600">
                    The outbound call to {citizenName} has completed and the telemetry outcome has been logged to the case record.
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={onClose}
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}

            {/* Failed Call UI State */}
            {callState === "FAILED" && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-sm font-bold text-rose-950">Call Could Not Be Connected</h4>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      {errorMessage || "The beneficiary could not be reached via telephony. Please verify the contact number or schedule a doorstep visit."}
                    </p>
                  </div>
                </div>
                <div className="pt-1 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={resetState}
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* Call Form (Shown when IDLE) */}
            {callState === "IDLE" && (
              <form onSubmit={handleStartCall} className="space-y-4">
                {errorMessage && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {errorMessage}
                  </div>
                )}

                {/* Spoken Language */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-teal-700" />
                    Preferred Language for Beneficiary
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DEFAULT_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setLanguage(lang.code)}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          language === lang.code
                            ? "border-teal-700 bg-teal-50 font-bold text-teal-900 ring-1 ring-teal-700"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="text-xs font-semibold">{lang.name}</div>
                        <div className="text-[11px] text-slate-500">{lang.nativeName}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Call Purpose / Reason */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Call Purpose & Spoken Context
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    placeholder="e.g. Doorstep visit tomorrow at 10 AM for Ayushman Card document verification."
                  />
                  <p className="text-[11px] text-slate-500">
                    The assistant will speak this context to the beneficiary when they answer.
                  </p>
                </div>

                {/* Safe Practice Notice */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                    Telephony Protocol & Compliance
                  </div>
                  <p>
                    • Server-side phone resolution prevents exposure of unmasked beneficiary numbers.
                  </p>
                  <p>
                    • Call outcome (e.g. Completed vs No Answer) will be logged to the case audit log.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-sm"
                  >
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    Place Call to Beneficiary
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Case Call History */}
        {activeTab === "history" && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Call History for this Case</span>
              <button
                type="button"
                onClick={loadCaseHistory}
                disabled={isLoadingHistory}
                className="text-teal-700 hover:underline flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading call history...</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500">
                No past calls recorded for this case yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {item.outboundReason || "Outbound Call"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.status === "COMPLETED" || item.outcome === "CALL_COMPLETED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : item.status === "FAILED" || item.outcome === "CALL_FAILED"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {item.outcome || item.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>Destination: {item.maskedNumber}</span>
                      <span>•</span>
                      <span>{new Date(item.startedAt).toLocaleString()}</span>
                      {item.durationSeconds !== undefined && item.durationSeconds > 0 && (
                        <>
                          <span>•</span>
                          <span>Duration: {formatSeconds(item.durationSeconds)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
