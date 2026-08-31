"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { voiceService } from "@/services/voice-service";
import {
  VoiceSession,
  VoicePublicConfig,
  CallHistoryItem,
} from "@shared/types/voice";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Languages,
  History,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export interface CitizenCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
  householdHeadName?: string;
}

const QUICK_REASONS = [
  "General Healthcare Assistance & Eligibility",
  "PM-JAY Senior Citizen 70+ Coverage",
  "Janani Suraksha Yojana (JSY) Maternal Care",
  "Check Application / Field Task Status",
  "Coordinate Doorstep ASHA Worker Visit",
];

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

export function CitizenCallModal({
  isOpen,
  onClose,
  defaultPhone = "",
  householdHeadName,
}: CitizenCallModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(
    defaultPhone.replace(/^\+91/, "").replace(/\D/g, "")
  );
  const [language, setLanguage] = useState("hi-IN");
  const [reason, setReason] = useState(QUICK_REASONS[0]);
  const [activeTab, setActiveTab] = useState<"call" | "history">("call");

  // Call lifecycle states
  const [callState, setCallState] = useState<
    "IDLE" | "REQUESTING" | "INITIATED" | "RINGING" | "CONNECTED" | "COMPLETED" | "FAILED"
  >("IDLE");
  const [activeSession, setActiveSession] = useState<VoiceSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Config & History
  const [config, setConfig] = useState<VoicePublicConfig | null>(null);
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load configuration & default phone
  useEffect(() => {
    if (isOpen) {
      voiceService.getVoiceConfig().then((res) => {
        if (res.success && res.data) {
          setConfig(res.data);
        }
      });
      if (defaultPhone) {
        setPhoneNumber(defaultPhone.replace(/^\+91/, "").replace(/\D/g, ""));
      }
      loadHistory();
    } else {
      resetState();
    }
  }, [isOpen, defaultPhone]);

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

  // Poll session state
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
            loadHistory();
          } else if (s.status === "FAILED" || s.callOutcome === "CALL_FAILED" || s.callOutcome === "CALL_NO_ANSWER") {
            setCallState("FAILED");
            setErrorMessage(
              s.callOutcome === "CALL_NO_ANSWER"
                ? "The call was not answered. Please check your phone and try again."
                : "The call could not be completed. Please ensure your number is reachable."
            );
            stopPolling();
            loadHistory();
          } else if (s.status === "ACTIVE" || s.status === "PROCESSING" || s.status === "RESPONDING") {
            setCallState("CONNECTED");
          }
        }
      } catch {
        // Continue polling silently
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

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await voiceService.getCitizenCallHistory();
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

    const clean = phoneNumber.replace(/\D/g, "");
    if (clean.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setCallState("REQUESTING");

    try {
      const res = await voiceService.requestCitizenCall({
        phoneNumber: `+91${clean}`,
        language,
        reason,
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
        setErrorMessage(res.error.message || "Failed to initiate call. Please try again.");
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

  const supportedLangs = config?.supportedLanguages || DEFAULT_LANGUAGES;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (callState === "INITIATED" || callState === "RINGING" || callState === "CONNECTED") {
          if (window.confirm("A voice call is currently in progress. Are you sure you want to close this window?")) {
            resetState();
            onClose();
          }
        } else {
          resetState();
          onClose();
        }
      }}
      title="SwasthyaSetu Healthcare Voice Assistant"
      description="Connect directly with our AI Voice Assistant on your phone for instant scheme advice, eligibility, and ASHA coordination."
      className="max-w-xl"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("call")}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "call"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Place Call
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              loadHistory();
            }}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Recent Calls {history.length > 0 && `(${history.length})`}
          </button>
        </div>

        {/* Tab 1: Place Call */}
        {activeTab === "call" && (
          <div className="space-y-4 pt-1">
            {/* Inbound Helpline Reference Banner */}
            <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 p-3 flex items-start gap-3 text-xs">
              <div className="p-1.5 rounded-md bg-emerald-600 text-white shrink-0 mt-0.5">
                <PhoneIncoming className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Direct Inbound Helpline</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    PSTN
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  You can also dial our central helpline directly from any phone:
                </p>
                <p className="font-mono font-bold text-emerald-900 text-xs pt-0.5">
                  {config?.displayHelplineText || "Helpline number will be assigned upon provisioning"}
                </p>
              </div>
            </div>

            {/* Active Call UI State */}
            {(callState === "RINGING" || callState === "CONNECTED" || callState === "REQUESTING") && (
              <div className="rounded-xl border border-teal-200 bg-gradient-to-b from-teal-50/90 to-white p-5 space-y-4 text-center">
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-teal-400/30 animate-ping" />
                  <div className="relative w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                    <Phone className="w-7 h-7 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-sm font-bold text-slate-900">
                      {callState === "REQUESTING"
                        ? "Connecting with Telephony Gateway..."
                        : callState === "RINGING"
                        ? "Calling your phone..."
                        : "Call In Progress"}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    Dialing <span className="font-semibold text-slate-900">+91 {phoneNumber}</span>. Please pick up the call to speak with the SwasthyaSetu Healthcare Assistant.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-600 bg-white/80 py-2 px-4 rounded-lg border border-teal-100 max-w-xs mx-auto">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-teal-700" />
                    Duration: {formatSeconds(callDuration)}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-700 font-semibold">
                    {callState === "CONNECTED" ? "CONNECTED" : "RINGING"}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 text-left space-y-1 text-xs">
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    What to expect when you answer:
                  </p>
                  <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-0.5">
                    <li>The assistant will greet you in your chosen language ({language}).</li>
                    <li>You can ask questions about PM-JAY, JSY, or your household application status.</li>
                    <li>For privacy, the assistant will ask for your Ration Card digits before reading family health data.</li>
                  </ul>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetState}
                  className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  <PhoneOff className="w-3.5 h-3.5 mr-1" />
                  Cancel / Reset Call
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
                  <h4 className="text-sm font-bold text-emerald-950">Call Completed Successfully</h4>
                  <p className="text-xs text-slate-600">
                    Thank you for connecting with the SwasthyaSetu Healthcare Assistant. Any assistance requests or updates made during the call have been synchronized.
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={resetState}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                  >
                    Place Another Call
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}

            {/* Failed Call UI State */}
            {callState === "FAILED" && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-rose-100 text-rose-700 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-sm font-bold text-rose-950">Call Could Not Be Connected</h4>
                    <p className="text-xs text-rose-800">
                      {errorMessage || "We were unable to reach your phone. Please verify your phone number and network connectivity."}
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetState}
                    className="text-xs font-semibold"
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

                {/* Phone Number Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Your Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-600 focus-within:border-emerald-600">
                    <span className="inline-flex items-center px-3 bg-slate-50 text-slate-500 text-xs font-semibold border-r border-slate-300">
                      🇮🇳 +91
                    </span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      maxLength={10}
                      required
                      className="w-full px-3 py-2 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {householdHeadName
                      ? `Registered for ${householdHeadName}'s household profile.`
                      : "The SwasthyaSetu telephony service will dial this number."}
                  </p>
                </div>

                {/* Language Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-teal-700" />
                    Spoken Language / भाषा
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {supportedLangs.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setLanguage(lang.code)}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          language === lang.code
                            ? "border-emerald-600 bg-emerald-50/80 font-bold text-emerald-900 ring-1 ring-emerald-600"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="text-xs font-semibold">{lang.name}</div>
                        <div className="text-[11px] text-slate-500">{lang.nativeName}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Purpose / Reason */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Reason for Call (Helps assistant prepare your records)
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {QUICK_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Privacy & Duration Notice */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                    Privacy & Healthcare Boundary
                  </div>
                  <p>
                    • This call provides administrative and scheme guidance. It does not provide medical diagnoses.
                  </p>
                  <p>
                    • Maximum call duration is {Math.round((config?.maxCallDurationSec || 300) / 60)} minutes per session for service availability.
                  </p>
                </div>

                {/* Submit / Action Button */}
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
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm"
                  >
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    Request Phone Call
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Call History */}
        {activeTab === "history" && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Recent Voice Interactions</span>
              <button
                type="button"
                onClick={loadHistory}
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
                No past calls recorded yet. Place a call to connect with the assistant.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 text-xs shadow-2xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.status === "COMPLETED" || item.outcome === "CALL_COMPLETED"
                              ? "bg-emerald-500"
                              : item.status === "FAILED" || item.outcome === "CALL_FAILED"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <span className="font-bold text-slate-900">
                          {item.outboundReason || (item.direction === "INBOUND" ? "Helpline Call" : "Voice Assistant")}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : item.status === "FAILED"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {item.outcome || item.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>To: {item.maskedNumber}</span>
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
