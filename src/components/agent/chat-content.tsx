"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { usePageContext } from "./page-context-provider";
import { ToolResultCard } from "./tool-cards";
import { AgentMarkdown } from "./markdown";
import {
  loadChatHistory,
  loadSessions,
  createSession,
  deleteSession,
  type ChatSession,
} from "@/lib/agent/load-chat-history";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Send,
  Trash2,
  X,
  Bot,
  User,
  Loader2,
  MessageSquare,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatContentProps {
  isVisible: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function ChatContent({ isVisible, onClose, showCloseButton = true }: ChatContentProps) {
  const { pageContext } = usePageContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  // Ref so the transport always reads the latest session ID at request time
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = activeSessionId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent/chat",
        body: () => ({
          pageContext: pageContext.path,
          pageData: pageContext.data,
          sessionId: sessionIdRef.current,
        }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageContext.path, pageContext.data]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Load sessions when panel becomes visible
  useEffect(() => {
    if (isVisible && !sessionsLoaded) {
      loadSessions().then((s) => {
        setSessions(s);
        setSessionsLoaded(true);
      });
    }
  }, [isVisible, sessionsLoaded]);

  // Load chat history when active session changes
  useEffect(() => {
    if (isVisible && activeSessionId && !historyLoaded) {
      loadChatHistory(activeSessionId).then((history) => {
        if (history.length > 0) setMessages(history);
        setHistoryLoaded(true);
      });
    } else if (!activeSessionId) {
      setHistoryLoaded(true);
    }
  }, [isVisible, activeSessionId, historyLoaded, setMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current && !showSessionList) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isVisible, showSessionList]);

  const handleNewChat = useCallback(() => {
    sessionIdRef.current = null;
    setActiveSessionId(null);
    setMessages([]);
    setHistoryLoaded(false);
    setShowSessionList(false);
    inputRef.current?.focus();
  }, [setMessages]);

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      setActiveSessionId(session.id);
      setMessages([]);
      setHistoryLoaded(false);
      setShowSessionList(false);
    },
    [setMessages]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    },
    [activeSessionId, handleNewChat]
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = text ?? input.trim();
      if (!msg || isLoading) return;

      // Create session before first message
      if (!sessionIdRef.current) {
        const title = msg.length > 60 ? msg.slice(0, 57) + "..." : msg;
        const session = await createSession(title);
        if (session) {
          sessionIdRef.current = session.id;
          setActiveSessionId(session.id);
          setSessions((prev) => [session, ...prev]);
        }
      }

      sendMessage({ text: msg });
      setInput("");
    },
    [input, isLoading, sendMessage]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Illaya</h3>
            <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
              {activeSessionId
                ? sessions.find((s) => s.id === activeSessionId)?.title || "Chat"
                : "New Chat"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSessionList(!showSessionList)}
            className="h-7 w-7"
            title="Chat history"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            className="h-7 w-7"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {showCloseButton && onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Session list overlay */}
      {showSessionList ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 border-b border-border">
            <button
              onClick={() => setShowSessionList(false)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              Back to chat
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className={cn(
              "w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-muted transition-colors border-b border-border",
              !activeSessionId && "bg-muted font-medium"
            )}
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            New Chat
          </button>

          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 hover:bg-muted transition-colors cursor-pointer border-b border-border/50",
                activeSessionId === session.id && "bg-muted font-medium"
              )}
              onClick={() => handleSelectSession(session)}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-xs truncate">{session.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatRelativeDate(session.updated_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {sessionsLoaded && sessions.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              No previous chats
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">Hi! I&apos;m Illaya, your marketing agent.</p>
                <p className="text-xs mt-1 max-w-[220px]">
                  Ask me to find creators, draft outreach, or analyze campaigns.
                </p>
                <div className="mt-4 space-y-2 w-full max-w-[240px]">
                  {[
                    "Find fitness creators in Mumbai",
                    "What's the rate for micro-influencers?",
                    "How are my campaigns performing?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isLoading && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask anything..."
                rows={1}
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 max-h-[120px]"
                style={{
                  height: "auto",
                  minHeight: "36px",
                }}
                disabled={isLoading}
              />
              <Button
                type="button"
                size="icon"
                disabled={isLoading || !input.trim()}
                onClick={() => handleSend()}
                className="h-9 w-9 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Date formatting helper ────────────────────────────── */

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/* ── Tool label mapping ─────────────────────────────────── */

const SIDEBAR_TOOL_LABELS: Record<string, string> = {
  creator_search: "Searching creators",
  get_creator_details: "Loading profile",
  lookalike_finder: "Finding lookalikes",
  outreach_drafter: "Drafting outreach",
  propose_outreach: "Submitting for approval",
  rate_benchmarker: "Benchmarking rates",
  counter_offer_generator: "Generating counter-offer",
  deal_memo_generator: "Creating deal memo",
  budget_optimizer: "Analyzing budget",
  roi_calculator: "Calculating ROI",
  campaign_overview: "Loading campaigns",
  content_tracker: "Tracking content",
};

/* ── Message bubble with parts rendering ──────────────── */

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex gap-2 flex-row-reverse">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="rounded-lg rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-sm max-w-[85%]">
          <div className="whitespace-pre-wrap break-words">
            {message.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text.trim()) {
            return (
              <div key={i} className="rounded-lg bg-muted px-3 py-2 text-xs break-words w-fit max-w-[95%]">
                <AgentMarkdown content={part.text} />
              </div>
            );
          }
          const toolPart = part as unknown as Record<string, unknown>;
          if (toolPart.toolCallId) {
            const toolState = toolPart.state as string;
            const toolName = toolPart.toolName as string;

            if (toolState === "call" || toolState === "partial-call") {
              const label = SIDEBAR_TOOL_LABELS[toolName] || toolName.replace(/_/g, " ");
              return (
                <div key={String(toolPart.toolCallId)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/10 w-fit text-[11px]">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-primary font-medium">{label}</span>
                </div>
              );
            }

            if (toolState === "result" || toolState === "output") {
              return (
                <ToolResultCard
                  key={String(toolPart.toolCallId)}
                  tool={toolPart}
                  compact
                />
              );
            }
          }
          return null;
        })}
      </div>
    </div>
  );
}
