"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { usePageContext } from "@/components/agent/page-context-provider";
import {
  HighlightFocusProvider,
  useHighlightFocus,
} from "@/components/agent/highlight-focus-context";
import {
  extractHighlights,
  findHighlightByHandle,
  indexHighlights,
} from "@/lib/agent/highlights";
import {
  loadChatHistory,
  loadSessions,
  createSession,
  deleteSession,
  type ChatSession,
} from "@/lib/agent/load-chat-history";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SessionRail } from "@/components/agent/session-rail";
import { EmptyStateRedesign } from "@/components/agent/empty-state-redesign";
import { ChatInputRedesign } from "@/components/agent/chat-input-redesign";
import {
  MessageRowRedesign,
  ThinkingIndicator,
} from "@/components/agent/message-row-redesign";
import { ArtifactCanvas } from "@/components/agent/artifact-canvas";
import { HighlightsPanel } from "@/components/agent/highlights-panel";
import {
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react";

/* ── Page entry ────────────────────────────────────────── */

export default function AgentPage() {
  return (
    <HighlightFocusProvider>
      <AgentPageInner />
    </HighlightFocusProvider>
  );
}

/* ── Main orchestrator ─────────────────────────────────── */

function AgentPageInner() {
  const { pageContext } = usePageContext();
  const { setHandleResolver, focusId } = useHighlightFocus();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  // Artifact canvas state
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

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
    [pageContext.path, pageContext.data]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";
  const [historyLoaded, setHistoryLoaded] = useState(false);

  /* ── Highlights derivation ───────────────────────────── */

  const highlights = useMemo(() => extractHighlights(messages), [messages]);
  const highlightById = useMemo(
    () => indexHighlights(highlights),
    [highlights]
  );

  // Focused artifact highlight
  const focusedHighlight = activeArtifactId
    ? highlightById.get(activeArtifactId) ?? null
    : null;

  // Register handle resolver for @handle deep-linking
  useEffect(() => {
    setHandleResolver((handle: string) => {
      const h = findHighlightByHandle(highlights, handle);
      return h?.id ?? null;
    });
    return () => setHandleResolver(null);
  }, [highlights, setHandleResolver]);

  // When a highlight is focused via @handle click, open the canvas
  useEffect(() => {
    if (!focusId) return;
    const isMobile =
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 1024px)").matches;
    if (isMobile) {
      setMobileSheetOpen(true);
    } else {
      setActiveArtifactId(focusId);
    }
  }, [focusId]);

  // Always collapse rail when canvas opens
  useEffect(() => {
    if (activeArtifactId) {
      setRailCollapsed(true);
    }
  }, [activeArtifactId]);

  // Auto-open canvas when a new artifact appears (highlights are newest-first)
  const prevHighlightCountRef = useRef(0);
  useEffect(() => {
    const prevCount = prevHighlightCountRef.current;
    const newCount = highlights.length;
    prevHighlightCountRef.current = newCount;

    // Only auto-open when a new highlight is added (not on initial load / session switch)
    if (newCount > prevCount && prevCount > 0 && highlights.length > 0) {
      const latest = highlights[0]; // newest-first
      const isMobile =
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width: 1024px)").matches;
      if (isMobile) {
        setActiveArtifactId(latest.id);
        setMobileSheetOpen(true);
      } else {
        setActiveArtifactId(latest.id);
      }
    }
  }, [highlights]);

  // Auto-open the last artifact when loading previous chat history
  const didAutoOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      historyLoaded &&
      activeSessionId &&
      highlights.length > 0 &&
      didAutoOpenRef.current !== activeSessionId
    ) {
      didAutoOpenRef.current = activeSessionId;
      const latest = highlights[0];
      const isMobile =
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width: 1024px)").matches;
      if (isMobile) {
        setActiveArtifactId(latest.id);
        setMobileSheetOpen(true);
      } else {
        setActiveArtifactId(latest.id);
      }
    }
  }, [historyLoaded, activeSessionId, highlights]);

  // Pending approval count for the rail badge
  const pendingApprovalCount = useMemo(
    () => highlights.filter((h) => h.kind === "approval_pending").length,
    [highlights]
  );

  /* ── Session / chat plumbing ─────────────────────────── */

  useEffect(() => {
    if (!sessionsLoaded) {
      loadSessions().then((s) => {
        setSessions(s);
        setSessionsLoaded(true);
      });
    }
  }, [sessionsLoaded]);

  useEffect(() => {
    if (activeSessionId && !historyLoaded) {
      loadChatHistory(activeSessionId).then((history) => {
        if (history.length > 0) {
          setMessages(history);
        }
        setHistoryLoaded(true);
      });
    } else if (!activeSessionId) {
      setHistoryLoaded(true);
    }
  }, [activeSessionId, historyLoaded, setMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ⌘K to focus input, ⌘N for new chat
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleNewChat = useCallback(() => {
    sessionIdRef.current = null;
    setActiveSessionId(null);
    setMessages([]);
    setHistoryLoaded(false);
    setActiveArtifactId(null);
    prevHighlightCountRef.current = 0;
    didAutoOpenRef.current = null;
    inputRef.current?.focus();
  }, [setMessages]);

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      if (session.id === activeSessionId) return;
      setActiveSessionId(session.id);
      setMessages([]);
      setHistoryLoaded(false);
      setActiveArtifactId(null);
      prevHighlightCountRef.current = 0;
      didAutoOpenRef.current = null;
    },
    [activeSessionId, setMessages]
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
      if (inputRef.current) inputRef.current.style.height = "auto";
    },
    [input, isLoading, sendMessage]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  const hasMessages = messages.length > 0;

  // Find the last assistant message index for is-active border
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div
      className="flex overflow-hidden"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {/* Session rail */}
      <div className="hidden md:flex">
        <SessionRail
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          collapsed={railCollapsed}
          onToggleCollapsed={() => setRailCollapsed((c) => !c)}
          pendingApprovalCount={pendingApprovalCount}
        />
      </div>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--background)" }}>
        {/* Top bar */}
        <div
          className="h-10 px-4 flex items-center gap-2 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span
            className="text-[12px] truncate flex-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            {activeSessionId
              ? sessions.find((s) => s.id === activeSessionId)?.title || "Chat"
              : "New Chat"}
          </span>
          {activeArtifactId && (
            <span
              className="text-[10.5px] font-mono px-1.5 py-0.5 rounded hidden lg:inline"
              style={{
                background: "var(--surface-2)",
                color: "var(--fg-faint)",
              }}
            >
              canvas open
            </span>
          )}
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto agent-scroll">
          {!hasMessages ? (
            <EmptyStateRedesign onSend={handleSend} />
          ) : (
            <div
              className="mx-auto max-w-[840px] px-4 py-4 flex flex-col"
              style={{ gap: 20 }}
            >
              {messages.map((message, idx) => (
                <MessageRowRedesign
                  key={message.id}
                  message={message}
                  highlightById={highlightById}
                  isLastAssistant={idx === lastAssistantIdx}
                  isStreaming={isLoading}
                  onOpenArtifact={(id) => {
                    const isMobile =
                      typeof window !== "undefined" &&
                      !window.matchMedia("(min-width: 1024px)").matches;
                    if (isMobile) {
                      setActiveArtifactId(id);
                      setMobileSheetOpen(true);
                    } else {
                      setActiveArtifactId(id);
                    }
                  }}
                  activeArtifactId={activeArtifactId}
                />
              ))}

              {isLoading &&
                !messages.some(
                  (m) =>
                    m.role === "assistant" &&
                    m.parts.some(
                      (p) =>
                        (p.type === "text" && p.text.length > 0) ||
                        (p.type === ("tool-invocation" as string))
                    )
                ) && <ThinkingIndicator />}
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInputRedesign
          input={input}
          onInputChange={handleInputChange}
          onKeyDown={onKeyDown}
          onSend={() => handleSend()}
          isLoading={isLoading}
          inputRef={inputRef}
        />
      </div>

      {/* Artifact canvas (desktop) */}
      {focusedHighlight && (
        <div className="hidden lg:flex">
          <ArtifactCanvas
            highlight={focusedHighlight}
            onClose={() => setActiveArtifactId(null)}
            onSend={(text) => handleSend(text)}
          />
        </div>
      )}

      {/* Artifact canvas (mobile bottom sheet) */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[70vh] p-0 flex flex-col rounded-t-xl"
        >
          <SheetTitle className="sr-only">Artifact</SheetTitle>
          {focusedHighlight ? (
            <ArtifactCanvas
              highlight={focusedHighlight}
              onClose={() => {
                setMobileSheetOpen(false);
                setActiveArtifactId(null);
              }}
              onSend={(text) => handleSend(text)}
            />
          ) : (
            <HighlightsPanel
              highlights={highlights}
              onClose={() => setMobileSheetOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
