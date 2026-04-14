"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { usePageContext } from "@/components/agent/page-context-provider";
import { AgentMarkdown } from "@/components/agent/markdown";
import {
  HighlightFocusProvider,
  useHighlightFocus,
} from "@/components/agent/highlight-focus-context";
import { HighlightPill } from "@/components/agent/highlight-pill";
import { HighlightsPanel } from "@/components/agent/highlights-panel";
import {
  extractHighlights,
  findHighlightByHandle,
  indexHighlights,
  type Highlight,
} from "@/lib/agent/highlights";
import {
  loadChatHistory,
  loadSessions,
  createSession,
  deleteSession,
  type ChatSession,
} from "@/lib/agent/load-chat-history";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Trash2,
  Bot,
  User,
  Loader2,
  Search,
  Mail,
  ArrowUp,
  Handshake,
  TrendingUp,
  Target,
  BarChart3,
  MessageSquare,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Tool name → friendly label mapping (in-flight state) ── */

const TOOL_LABELS: Record<string, { label: string }> = {
  creator_search: { label: "Searching creators" },
  get_creator_details: { label: "Loading creator profile" },
  lookalike_finder: { label: "Finding similar creators" },
  warm_lead_detector: { label: "Detecting warm leads" },
  competitor_mapper: { label: "Mapping competitor creators" },
  geo_opportunity_finder: { label: "Finding geo opportunities" },
  audience_overlap_check: { label: "Checking audience overlap" },
  outreach_drafter: { label: "Drafting outreach email" },
  propose_outreach: { label: "Submitting for approval" },
  rate_benchmarker: { label: "Benchmarking rates" },
  counter_offer_generator: { label: "Generating counter-offer" },
  deal_memo_generator: { label: "Creating deal memo" },
  budget_optimizer: { label: "Analyzing budget" },
  roi_calculator: { label: "Calculating ROI" },
  campaign_overview: { label: "Loading campaigns" },
  campaign_builder: { label: "Building campaign" },
  campaign_status_manager: { label: "Updating campaign status" },
  content_tracker: { label: "Tracking content" },
  brief_generator: { label: "Generating brief" },
  discount_code_generator: { label: "Creating discount codes" },
  gifting_order_creator: { label: "Creating gifting order" },
  relationship_scorer: { label: "Scoring relationship" },
  ambassador_identifier: { label: "Identifying ambassadors" },
  churn_predictor: { label: "Predicting churn risk" },
  reengagement_recommender: { label: "Finding re-engagement targets" },
};

/* ── Capability cards for empty state ───────────────────── */

const capabilities = [
  {
    icon: Search,
    title: "Discover Creators",
    description:
      "Search by niche, location, tier, language, or engagement metrics",
    color:
      "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40",
    prompts: [
      "Find beauty micro-influencers who speak Tamil",
      "Show me top-performing fitness creators",
      "Find creators similar to @neeshicorner",
    ],
  },
  {
    icon: Mail,
    title: "Outreach & Email",
    description:
      "Draft personalized emails and submit for approval before sending",
    color:
      "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/40",
    prompts: [
      "Draft outreach to @creator for our Diwali campaign",
      "Write a follow-up email for creators who haven't replied",
    ],
  },
  {
    icon: Handshake,
    title: "Negotiate Deals",
    description:
      "Get market rates, generate counter-offers, and create deal memos",
    color:
      "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40",
    prompts: [
      "What's the going rate for macro influencers?",
      "Creator is asking 50K — generate a counter-offer",
      "Create a deal memo for the agreed terms",
    ],
  },
  {
    icon: BarChart3,
    title: "Campaign Analytics",
    description:
      "Track ROI, budget usage, content submissions, and performance",
    color:
      "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40",
    prompts: [
      "How are my active campaigns performing?",
      "What's the ROI on my last campaign?",
      "Show me budget breakdown by creator",
    ],
  },
  {
    icon: Target,
    title: "Campaign Management",
    description:
      "Create campaigns, generate briefs, assign discount codes, send gifts",
    color:
      "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/40",
    prompts: [
      "Create a new summer collection campaign",
      "Generate a content brief for @creator",
      "Create discount codes for all campaign creators",
    ],
  },
  {
    icon: TrendingUp,
    title: "Relationship Intelligence",
    description:
      "Score creator loyalty, predict churn, find re-engagement opportunities",
    color:
      "text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/40",
    prompts: [
      "Which creators are at risk of churning?",
      "Show me relationship health with @creator",
      "Who are my best ambassador candidates?",
    ],
  },
];

/* ── Page entry — wraps inner in HighlightFocusProvider ──── */

export default function AgentPage() {
  return (
    <HighlightFocusProvider>
      <AgentPageInner />
    </HighlightFocusProvider>
  );
}

/* ── Main page — has access to useHighlightFocus ────────── */

function AgentPageInner() {
  const { pageContext } = usePageContext();
  const { setHandleResolver, focusId } = useHighlightFocus();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  // Highlights panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const userClosedPanelRef = useRef(false);

  // Ref so the transport always reads the latest session ID at request time
  const sessionIdRef = useRef<string | null>(null);
  // eslint-disable-next-line react-hooks/refs -- intentional: keeps ref synced so the transport body callback always sees the current session
  sessionIdRef.current = activeSessionId;

  const transport = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- ref is read at request time inside the body callback, not during render
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

  /* ── Highlights derivation ─────────────────────────────── */

  const highlights = useMemo(() => extractHighlights(messages), [messages]);
  const highlightById = useMemo(
    () => indexHighlights(highlights),
    [highlights]
  );

  // Register handle resolver so <HandlePill> in markdown can deep-link.
  useEffect(() => {
    setHandleResolver((handle: string) => {
      const h = findHighlightByHandle(highlights, handle);
      return h?.id ?? null;
    });
    return () => setHandleResolver(null);
  }, [highlights, setHandleResolver]);

  // Auto-open panel when first highlight lands (unless user already closed it).
  useEffect(() => {
    if (highlights.length > 0 && !panelOpen && !userClosedPanelRef.current) {
      setPanelOpen(true);
    }
  }, [highlights.length, panelOpen]);

  // Clicking a breadcrumb in chat or an @handle focuses a highlight — make sure
  // the panel is open so the flash is visible. On mobile we open the sheet
  // instead of the desktop side rail.
  useEffect(() => {
    if (!focusId) return;
    const isMobile =
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 1024px)").matches;
    if (isMobile) {
      setMobileSheetOpen(true);
    } else {
      setPanelOpen(true);
      userClosedPanelRef.current = false;
    }
  }, [focusId]);

  // When the actions panel opens, collapse the sessions sidebar to give the
  // chat column breathing room. The user can manually reopen it.
  useEffect(() => {
    if (panelOpen) setSidebarOpen(false);
  }, [panelOpen]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    userClosedPanelRef.current = true;
  }, []);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    userClosedPanelRef.current = false;
  }, []);

  /* ── Session / chat plumbing (unchanged) ───────────────── */

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNewChat = useCallback(() => {
    sessionIdRef.current = null;
    setActiveSessionId(null);
    setMessages([]);
    setHistoryLoaded(false);
    userClosedPanelRef.current = false;
    setPanelOpen(false);
    inputRef.current?.focus();
  }, [setMessages]);

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      if (session.id === activeSessionId) return;
      setActiveSessionId(session.id);
      setMessages([]);
      setHistoryLoaded(false);
      userClosedPanelRef.current = false;
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
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const hasMessages = messages.length > 0;
  const highlightCount = highlights.length;

  return (
    <div
      className="-mx-4 -mt-6 -mb-6 md:-mx-8 flex overflow-hidden"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {/* ── Session sidebar ─────────────────────────────── */}
      {sidebarOpen && (
        <div className="w-64 shrink-0 border-r bg-muted/30 flex flex-col">
          <div className="flex items-center justify-between px-3 py-3 border-b">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Chats
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNewChat}
                title="New chat"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSidebarOpen(false)}
                title="Close sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <button
              onClick={handleNewChat}
              className={cn(
                "w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-muted transition-colors",
                !activeSessionId && "bg-muted font-medium"
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">New Chat</span>
            </button>

            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2.5 hover:bg-muted transition-colors cursor-pointer",
                  activeSessionId === session.id && "bg-muted font-medium"
                )}
                onClick={() => handleSelectSession(session)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{session.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatRelativeDate(session.updated_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  title="Delete chat"
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
        </div>
      )}

      {/* ── Chat area (middle column) ───────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top bar — controls for sidebars */}
        <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2">
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarOpen(true)}
              title="Open sessions"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </Button>
          )}
          <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
            {activeSessionId
              ? sessions.find((s) => s.id === activeSessionId)?.title ||
                "Chat"
              : "New Chat"}
          </span>
          {/* Desktop: panel open/close */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hidden lg:inline-flex"
            onClick={panelOpen ? closePanel : openPanel}
            title={panelOpen ? "Close actions" : "Open actions"}
          >
            {panelOpen ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <EmptyState onSend={handleSend} />
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
              {messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  highlightById={highlightById}
                />
              ))}

              {isLoading &&
                !messages.some(
                  (m) =>
                    m.role === "assistant" &&
                    m.parts.some(
                      (p) =>
                        (p.type === "text" && p.text.length > 0) ||
                        (p.type === "tool-invocation" as string)
                    )
                ) && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t bg-background/80 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl px-6 py-4">
            <div className="relative flex items-end gap-3 rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all px-4 py-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={onKeyDown}
                placeholder="Ask anything about your creators, campaigns, or outreach..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground max-h-[160px]"
                style={{ minHeight: "24px" }}
                disabled={isLoading}
              />
              <Button
                type="button"
                size="icon"
                disabled={isLoading || !input.trim()}
                onClick={() => handleSend()}
                className="h-8 w-8 shrink-0 rounded-lg"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 select-none">
              Enter to send &middot; Shift+Enter for new line &middot; {"\u2318"}K to focus
            </p>
          </div>
        </div>

        {/* Mobile floating actions button */}
        {highlightCount > 0 && (
          <button
            onClick={() => setMobileSheetOpen(true)}
            className="lg:hidden absolute bottom-24 right-4 flex items-center gap-2 rounded-full border bg-background shadow-lg px-3.5 py-2 text-xs font-medium hover:bg-muted transition-colors z-10"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {highlightCount} action{highlightCount === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {/* ── Highlights panel (desktop right rail) ───────── */}
      {panelOpen && (
        <div className="hidden lg:flex w-[380px] shrink-0 border-l flex-col">
          <HighlightsPanel highlights={highlights} onClose={closePanel} />
        </div>
      )}

      {/* ── Highlights bottom sheet (mobile) ────────────── */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[70vh] p-0 flex flex-col rounded-t-xl"
        >
          <SheetTitle className="sr-only">Actions</SheetTitle>
          <HighlightsPanel
            highlights={highlights}
            onClose={() => setMobileSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
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

/* ── Empty state with capability cards ──────────────────── */

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center px-6 pt-12 pb-6 max-w-4xl mx-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-5">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-xl font-bold mb-1">Marketing Agent</h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-lg text-center leading-relaxed">
        Your AI co-pilot for influencer marketing. I can discover creators,
        draft outreach, negotiate deals, manage campaigns, and track performance.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full mb-8">
        {capabilities.map((cap, idx) => {
          const Icon = cap.icon;
          const isExpanded = expandedIdx === idx;
          return (
            <div
              key={cap.title}
              className={cn(
                "group rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md",
                isExpanded
                  ? "ring-2 ring-primary/20 shadow-md"
                  : "hover:border-primary/30"
              )}
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    cap.color
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{cap.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Try asking
                  </p>
                  {cap.prompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSend(prompt);
                      }}
                      className="w-full flex items-center gap-2 rounded-lg bg-muted/50 hover:bg-muted px-3 py-2 text-left text-xs transition-colors group/btn"
                    >
                      <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 group-hover/btn:text-primary transition-colors" />
                      <span className="text-foreground/80 group-hover/btn:text-foreground transition-colors">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-2xl">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center mb-3">
          Quick start
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Find beauty micro-influencers who speak Tamil",
            "How are my active campaigns performing?",
            "What's the market rate for macro influencers?",
            "Which creators are at risk of churning?",
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSend(prompt)}
              className="rounded-full border px-3.5 py-1.5 text-xs hover:bg-muted hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Typing indicator ─────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="rounded-2xl bg-muted px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

/* ── Tool call indicator (shown while tool is executing) ── */

function ToolCallIndicator({ toolName }: { toolName: string }) {
  const info = TOOL_LABELS[toolName];
  const label = info?.label || toolName.replace(/_/g, " ");
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-xs w-fit">
      <Loader2 className="h-3 w-3 animate-spin text-primary" />
      <span className="text-primary font-medium">{label}</span>
    </div>
  );
}

/* ── Message row ────────────────────────────────────────── */

function MessageRow({
  message,
  highlightById,
}: {
  message: UIMessage;
  highlightById: Map<string, Highlight>;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-3 flex-row-reverse max-w-[80%]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <div className="rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-4 py-2.5 text-sm">
            <div className="whitespace-pre-wrap break-words">
              {message.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { type: "text"; text: string }).text)
                .join("")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mt-0.5">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text.trim()) {
            return (
              <div key={i} className="text-sm leading-relaxed">
                <AgentMarkdown content={part.text} />
              </div>
            );
          }

          const toolPart = part as unknown as Record<string, unknown>;
          if (toolPart.toolCallId) {
            const toolState = toolPart.state as string;
            const typeStr = typeof toolPart.type === "string" ? toolPart.type : "";
            const toolName =
              (toolPart.toolName as string | undefined) ??
              (typeStr.startsWith("tool-") ? typeStr.slice(5) : "");
            const toolCallId = String(toolPart.toolCallId);

            // In-flight states (Vercel AI SDK v6 + legacy aliases)
            const isInFlight =
              toolState === "input-streaming" ||
              toolState === "input-available" ||
              toolState === "approval-requested" ||
              toolState === "call" ||
              toolState === "partial-call";
            if (isInFlight) {
              return (
                <ToolCallIndicator
                  key={toolCallId}
                  toolName={toolName}
                />
              );
            }

            // Errored tool — surface a subdued error pill
            if (toolState === "output-error" || toolState === "output-denied") {
              const errorText = String(toolPart.errorText ?? "Tool failed");
              return (
                <div
                  key={toolCallId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>
                    {toolName.replace(/_/g, " ")} — {errorText}
                  </span>
                </div>
              );
            }

            // Completed
            const isComplete =
              toolState === "output-available" ||
              toolState === "result" ||
              toolState === "output";
            if (isComplete) {
              const highlight = highlightById.get(toolCallId);
              if (highlight) {
                return (
                  <HighlightPill
                    key={toolCallId}
                    id={highlight.id}
                    kind={highlight.kind}
                    title={highlight.title}
                    subtitle={highlight.subtitle}
                  />
                );
              }
              return (
                <div
                  key={toolCallId}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{toolName.replace(/_/g, " ")}</span>
                </div>
              );
            }
          }
          return null;
        })}
      </div>
    </div>
  );
}
