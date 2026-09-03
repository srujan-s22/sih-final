"use client";

import React, { useState, useEffect, useRef } from "react";
import { assistantService } from "@/services/assistant-service";
import { useTranslation } from "@/i18n/i18n-context";
import { Language } from "@/i18n/types";
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
  RefreshCw,
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

function renderInlineFormatted(text: string) {
  // Support both **bold** and __bold__ syntax
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  return parts.map((part, i) => {
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function FormattedMessageContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
  let currentTable: { headers: string[]; rows: string[][] } | null = null;

  const flushList = (key: string) => {
    if (!currentList) return;
    if (currentList.type === "ul") {
      elements.push(
        <ul key={key} className="my-2 pl-4 list-disc space-y-1 text-slate-800">
          {currentList.items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatted(item)}</li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={key} className="my-2 pl-4 list-decimal space-y-1 text-slate-800">
          {currentList.items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatted(item)}</li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  const flushTable = (key: string) => {
    if (!currentTable) return;
    elements.push(
      <div key={key} className="my-2.5 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
        <table className="w-full text-xs text-left border-collapse">
          {currentTable.headers.length > 0 && (
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                {currentTable.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2">
                    {renderInlineFormatted(h)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-200">
            {currentTable.rows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-2 text-slate-800">
                    {renderInlineFormatted(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    currentTable = null;
  };

  const flushAll = (key: string) => {
    flushList(`${key}-list`);
    flushTable(`${key}-table`);
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Skip horizontal dividers (---, ***, ___)
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushAll(`divider-${idx}`);
      return;
    }

    // Markdown Table handling: lines starting and ending with |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList(`table-start-${idx}`);
      // Table separator row: |---|---| or |:---|---:|
      if (/^\|(\s*:?-+:?\s*\|)+$/.test(trimmed)) {
        return; // Suppress separator line
      }
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      if (!currentTable) {
        currentTable = { headers: cells, rows: [] };
      } else {
        currentTable.rows.push(cells);
      }
      return;
    }

    // Non-table line encountered
    flushTable(`table-end-${idx}`);

    // Clean leading heading markers (###, ##, #)
    const isHeading = /^#{1,6}\s+/.test(trimmed);
    const cleanedLine = trimmed.replace(/^#{1,6}\s+/, "");

    // Check unordered bullet (•, -, *)
    const ulMatch = cleanedLine.match(/^[•\-*]\s+(.*)$/);
    if (ulMatch) {
      if (currentList && currentList.type !== "ul") {
        flushList(`list-${idx}`);
      }
      if (!currentList) {
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(ulMatch[1]);
      return;
    }

    // Check numbered list (1., 2.)
    const olMatch = cleanedLine.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (currentList && currentList.type !== "ol") {
        flushList(`list-${idx}`);
      }
      if (!currentList) {
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(olMatch[1]);
      return;
    }

    // Regular line
    flushList(`list-${idx}`);

    if (cleanedLine.length > 0) {
      if (isHeading) {
        elements.push(
          <h4 key={`h-${idx}`} className="font-semibold text-slate-900 mt-2.5 mb-1 text-sm">
            {renderInlineFormatted(cleanedLine)}
          </h4>
        );
      } else {
        elements.push(
          <p key={`p-${idx}`} className="my-1.5 leading-relaxed text-slate-800">
            {renderInlineFormatted(cleanedLine)}
          </p>
        );
      }
    }
  });

  flushAll("final");

  return <div className="space-y-0.5">{elements}</div>;
}

export function HealthcareAssistantDrawer({
  isOpen,
  onClose,
  userRole = "CITIZEN",
  initialPrompt,
  schemeId,
  caseId,
}: HealthcareAssistantDrawerProps) {
  const { language, setLanguage, t } = useTranslation();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const quickActions = [
    t("assistant.q1"),
    t("assistant.q2"),
    t("assistant.q3"),
  ];

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
            ? language === "kn"
              ? "ನಮಸ್ಕಾರ. ನಾನು ನಿಮ್ಮ ಸ್ವಾಸ್ಥ್ಯಸೇತು ಆಶಾ ಕ್ಷೇತ್ರ ಸಹಾಯಕ. ನಿಮ್ಮ ಕುಟುಂಬಗಳ ಯೋಜನೆ ನಿಯಮಗಳು, ಆರೋಗ್ಯ ಕೊರತೆಗಳು ಮತ್ತು ದಾಖಲೆಗಳ ಮಾರ್ಗದರ್ಶನಕ್ಕೆ ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ."
              : language === "hi"
              ? "नमस्ते। मैं आपका स्वास्थ्यसेतु आशा फील्ड सहायक हूँ। मैं आपके नामित परिवारों के लिए योजना नियमों, कमियों और दस्तावेज़ों के मार्गदर्शन में आपकी सहायता कर सकता हूँ।"
              : "Namaste. I am your SwasthyaSetu ASHA Field Assistant. I can help you understand verified government scheme rules, health access gaps, and documentation guidance for your assigned caseload."
            : userRole === "ADMIN"
            ? language === "kn"
              ? "ನಮಸ್ಕಾರ. ನಾನು ಸ್ವಾಸ್ಥ್ಯಸೇತು ಆಡಳಿತ ಸಹಾಯಕ. ಸಕ್ರಿಯ ಯೋಜನೆಗಳು, ಗೆಜೆಟ್ ಆಧಾರಗಳು ಮತ್ತು ವ್ಯವಸ್ಥೆಯ ಮಾಹಿತಿ ನೀಡಲು ನಾನು ಸಿದ್ಧನಿದ್ದೇನೆ."
              : language === "hi"
              ? "नमस्ते। मैं स्वास्थ्यसेतु प्रशासनिक सहायक हूँ। मैं सक्रिय योजनाओं, सरकारी साक्ष्यों और सिस्टम सारांश में सहायता कर सकता हूँ।"
              : "Hello. I am the SwasthyaSetu Administrative Assistant. I can help you query active scheme metadata, verified evidence records, and platform governance summaries."
            : language === "kn"
            ? "ನಮಸ್ಕಾರ. ನಾನು ನಿಮ್ಮ ಸ್ವಾಸ್ಥ್ಯಸೇತು ಆರೋಗ್ಯ ಸಹಾಯಕ. ನಿಮ್ಮ ಕುಟುಂಬದ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು, ಅರ್ಹತೆಯ ಕಾರಣಗಳು ಮತ್ತು ಅಗತ್ಯ ದಾಖಲೆಗಳನ್ನು ತಿಳಿಯಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ."
            : language === "hi"
            ? "नमस्ते। मैं आपका स्वास्थ्यसेतु स्वास्थ्य सहायक हूँ। मैं आपके परिवार के लिए सरकारी स्वास्थ्य योजनाओं, पात्रता और आवश्यक दस्तावेज़ों को समझने में मदद करूँगा।"
            : "Namaste. I am your SwasthyaSetu Healthcare Assistant. I am here to help you understand your healthcare entitlements, explain why schemes apply to your family, and guide you on necessary documents.",
        timestamp: new Date().toISOString(),
        suggestedActions: userRole === "CITIZEN" ? quickActions : undefined,
      };
      setMessages([welcome]);

      if (initialPrompt) {
        handleSend(initialPrompt);
      }
    }
  }, [isOpen, userRole, language]);

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

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

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
        conversationId: conversationId || undefined,
        conversationHistory: historyPayload,
        language: language === "kn" || language === "hi" ? language : "en",
        schemeId,
        caseId,
      });

      if (res.success && res.data) {
        if (res.data.conversationId) {
          setConversationId(res.data.conversationId);
        }

        const botMsg: ChatEntry = {
          id: `bot_${Date.now()}`,
          role: "assistant",
          content: res.data.reply,
          groundingData: res.data.groundingData,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errorMsg: ChatEntry = {
          id: `err_${Date.now()}`,
          role: "assistant",
          content:
            language === "kn"
              ? "ಕ್ಷಮಿಸಿ, ಪ್ರತಿಕ್ರಿಯೆ ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
              : language === "hi"
              ? "क्षमा करें, उत्तर प्राप्त करने में असमर्थ। कृपया पुनः प्रयास करें।"
              : "I apologize, but I could not process your request at this moment. Please try asking again.",
          isError: true,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: ChatEntry = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content:
          language === "kn"
            ? "ಸರ್ವರ್ ಸಂಪರ್ಕದಲ್ಲಿ ದೋಷವಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ."
            : language === "hi"
            ? "सर्वर कनेक्शन में त्रुटि। कृपया अपना इंटरनेट कनेक्शन जांचें।"
            : "Network error occurred while contacting the assistant. Please verify your connection.",
        isError: true,
        timestamp: new Date().toISOString(),
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
      content:
        language === "kn"
          ? "ಸಂಭಾಷಣೆ ಮರುಹೊಂದಿಸಲಾಗಿದೆ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?"
          : language === "hi"
          ? "बातचीत रीसेट हो गई है। आज मैं आपकी क्या सहायता करूँ?"
          : "Conversation reset. How can I assist you with your healthcare entitlements today?",
      timestamp: new Date().toISOString(),
      suggestedActions: userRole === "CITIZEN" ? quickActions : undefined,
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
                      ? t("asha.workspaceTitle")
                      : userRole === "ADMIN"
                      ? t("admin.consoleTitle")
                      : t("assistant.drawerTitle")}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-800">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {t("status.verified")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t("assistant.drawerSubtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Language Selector */}
              <select
                aria-label="Select assistant language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-medium hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-teal-700 cursor-pointer"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="kn">ಕನ್ನಡ</option>
              </select>

              <button
                onClick={handleClearChat}
                title="Reset conversation"
                aria-label="Reset conversation"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onClose}
                aria-label="Close assistant"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
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
                  {msg.role === "user" ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <FormattedMessageContent content={msg.content} />
                  )}

                  {/* Verified Citations Box */}
                  {msg.groundingData &&
                    msg.groundingData.citedEvidence &&
                    msg.groundingData.citedEvidence.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                        <div className="text-[11px] font-bold text-teal-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-teal-700" />
                          <span>Official Gazette Citations</span>
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
                  <span>{t("common.loading")}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar (visible when conversation is short) */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
                {t("assistant.suggestedQueriesTitle")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickActions.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="text-xs bg-white border border-slate-200 hover:border-teal-700 hover:bg-teal-50/50 text-slate-700 px-2.5 py-1 rounded-md text-left font-medium transition-colors cursor-pointer"
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
                placeholder={t("assistant.inputPlaceholder")}
                rows={2}
                disabled={isLoading}
                className="flex-1 resize-none rounded-xl border border-slate-200 p-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-700 focus:border-teal-700 disabled:opacity-50"
              />
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || !inputValue.trim()}
                className="bg-teal-800 hover:bg-teal-900 text-white rounded-xl h-[42px] px-3.5 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label={t("assistant.sendBtn")}
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
