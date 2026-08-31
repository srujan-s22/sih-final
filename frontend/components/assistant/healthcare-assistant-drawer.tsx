"use client";

import React, { useState, useEffect, useRef } from "react";
import { assistantService } from "@/services/assistant-service";
import {
  AssistantMessage,
  AssistantCitedEvidence,
  AssistantGroundingSummary,
} from "@shared/types/assistant";
import { UserRole } from "@shared/types/auth";
import {
  X,
  Send,
  Bot,
  User,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Info,
  Layers,
  FileCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HealthcareAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
  initialPrompt?: string;
  schemeId?: string;
  caseId?: string;
}

interface ChatEntry extends AssistantMessage {
  id: string;
  groundingData?: AssistantGroundingSummary;
  suggestedActions?: string[];
  isError?: boolean;
}

const QUICK_ACTIONS = [
  "What schemes can my family get?",
  "Explain my eligibility results",
  "What documents do I need next?",
  "What healthcare gaps were found?",
];

export function HealthcareAssistantDrawer({
  isOpen,
  onClose,
  userRole = "CITIZEN",
  initialPrompt,
  schemeId,
  caseId,
}: HealthcareAssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "kn">("en");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check assistant status on open
  useEffect(() => {
    if (isOpen) {
      assistantService.getStatus().then((res) => {
        if (res.success) {
          setIsConfigured(res.data.isConfigured);
        }
      });
    }
  }, [isOpen]);

  // Initial welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcome: ChatEntry = {
        id: "welcome-msg",
        role: "assistant",
        content:
          userRole === "ASHA"
            ? "Namaste. I am your SwasthyaSetu ASHA Field Assistant. I can help you understand verified government scheme rules, health access gaps, and documentation guidance for your assigned caseload."
            : userRole === "ADMIN"
            ? "Hello. I am the SwasthyaSetu Administrative Assistant. I can help you query active scheme metadata, verified evidence records, and platform governance summaries."
            : "Namaste. I am your SwasthyaSetu Healthcare Assistant. I am here to help you understand your healthcare entitlements, explain why schemes apply to your family, and guide you on necessary documents.",
        timestamp: new Date().toISOString(),
        suggestedActions:
          userRole === "CITIZEN"
            ? QUICK_ACTIONS.slice(0, 3)
            : ["Explain active schemes", "Summarize verified evidence"],
      };
      setMessages([welcome]);

      if (initialPrompt) {
        handleSend(initialPrompt);
      }
    }
  }, [isOpen, userRole]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessageId = `user_${Date.now()}`;
    const userMsg: ChatEntry = {
      id: userMessageId,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    // Update conversation state with user message
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    // Prepare bounded conversation history for API (last 8 messages)
    const historyPayload: AssistantMessage[] = updatedMessages
      .filter((m) => !m.isError && m.id !== "welcome-msg")
      .slice(-8)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const res = await assistantService.sendMessage({
        message: text,
        conversationHistory: historyPayload,
        language,
        schemeId: schemeId || null,
        caseId: caseId || null,
        conversationId: conversationId || null,
      });

      if (res.success) {
        const assistantMsg: ChatEntry = {
          id: `asst_${Date.now()}`,
          role: "assistant",
          content: res.data.reply,
          timestamp: res.data.timestamp,
          groundingData: res.data.groundingData,
          suggestedActions: res.data.suggestedActions,
        };
        setConversationId(res.data.conversationId);
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatEntry = {
          id: `err_${Date.now()}`,
          role: "assistant",
          content:
            res.error.code === "GEMINI_UNCONFIGURED"
              ? "The conversational assistant is currently unavailable. Please try again later."
              : res.error.message || "An error occurred while processing your request.",
          timestamp: new Date().toISOString(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: unknown) {
      const errorMsg: ChatEntry = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: "Unable to reach the assistant service. Please check your network connection.",
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setConversationId(null);
    const welcome: ChatEntry = {
      id: "welcome-msg",
      role: "assistant",
      content: "Conversation reset. How can I assist you with your healthcare entitlements today?",
      timestamp: new Date().toISOString(),
      suggestedActions: userRole === "CITIZEN" ? QUICK_ACTIONS.slice(0, 3) : undefined,
    };
    setMessages([welcome]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center text-white shrink-0 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {userRole === "ASHA"
                      ? "ASHA Field Assistant"
                      : userRole === "ADMIN"
                      ? "Administrative Assistant"
                      : "Ask SwasthyaSetu"}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-800">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Verified Data
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Authoritative healthcare guidance & eligibility explanation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Language Selector */}
              <select
                aria-label="Select assistant language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "hi" | "kn")}
                className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-medium hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-teal-700"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="kn">ಕನ್ನಡ</option>
              </select>

              <button
                onClick={handleClearChat}
                title="Reset conversation"
                aria-label="Reset conversation"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onClose}
                aria-label="Close assistant"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Assistant Unconfigured Notice (if server has no key) */}
          {isConfigured === false && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Conversational assistant is currently offline (API key unconfigured on server).
              </span>
            </div>
          )}

          {/* Conversation Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white ${
                      msg.isError ? "bg-rose-600" : "bg-teal-800"
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-teal-800 text-white shadow-2xs font-medium"
                      : msg.isError
                      ? "bg-rose-50 text-rose-900 border border-rose-200"
                      : "bg-slate-50 text-slate-800 border border-slate-200/80 shadow-2xs"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Verified Citations Box (if grounded evidence exists) */}
                  {msg.groundingData &&
                    msg.groundingData.citedEvidence &&
                    msg.groundingData.citedEvidence.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                        <div className="text-[11px] font-bold text-teal-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-teal-700" />
                          <span>Verified Government Sources</span>
                        </div>
                        <div className="space-y-1">
                          {msg.groundingData.citedEvidence.map((ev) => (
                            <a
                              key={ev.id}
                              href={ev.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-white border border-slate-200 hover:border-teal-700 text-slate-700 text-[11px] font-medium transition-colors"
                            >
                              <span className="truncate">{ev.officialTitle}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Suggested Follow-up Actions */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                      {msg.suggestedActions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(action)}
                          disabled={isLoading}
                          className="text-[11px] text-teal-800 bg-white border border-teal-200 hover:bg-teal-50 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer text-left"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  {msg.timestamp && (
                    <div
                      className={`text-[10px] mt-1.5 ${
                        msg.role === "user" ? "text-teal-200" : "text-slate-400"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-white">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 items-center">
                <div className="w-7 h-7 rounded-full bg-teal-800 flex items-center justify-center shrink-0 text-white">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="rounded-xl px-4 py-3 bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-teal-700 animate-pulse" />
                  <span>Evaluating verified rules & drafting explanation...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar (visible when conversation is short) */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
                Suggested Questions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="text-xs bg-white border border-slate-200 hover:border-teal-700 hover:bg-teal-50/50 text-slate-700 px-2.5 py-1 rounded-md text-left font-medium transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input & Footer Area */}
          <div className="p-3 sm:p-4 border-t border-slate-200 bg-white space-y-2">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  language === "hi"
                    ? "योजनाओं या पात्रता के बारे में पूछें..."
                    : language === "kn"
                    ? "ಯೋಜನೆಗಳು ಅಥವಾ ಅರ್ಹತೆಯ ಬಗ್ಗೆ ಕೇಳಿ..."
                    : "Ask about your eligible schemes, documents, or gaps..."
                }
                rows={2}
                disabled={isLoading}
                className="flex-1 resize-none rounded-xl border border-slate-200 p-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-700 focus:border-teal-700 disabled:opacity-50"
              />
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || !inputValue.trim()}
                className="bg-teal-800 hover:bg-teal-900 text-white rounded-xl h-[42px] px-3.5 flex items-center justify-center shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Official Disclaimer */}
            <p className="text-[10px] text-slate-400 text-center leading-tight">
              SwasthyaSetu Assistant provides guidance based on verified government data. Official benefit decisions are subject to government authority verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
