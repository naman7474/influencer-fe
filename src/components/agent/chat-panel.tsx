"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { usePageContext } from "./page-context-provider";
import { ToolResultCard } from "./tool-cards";
import { AgentMarkdown } from "./markdown";
import { loadChatHistory } from "@/lib/agent/load-chat-history";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Trash2, X, Bot, User, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const { pageContext } = usePageContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent/chat",
        body: {
          pageContext: pageContext.path,
          pageData: pageContext.data,
        },
      }),
    [pageContext.path, pageContext.data]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Load chat history from DB when panel opens
  useEffect(() => {
    if (isOpen && !historyLoaded) {
      loadChatHistory().then((history) => {
        if (history.length > 0) setMessages(history);
        setHistoryLoaded(true);
      });
    }
  }, [isOpen, historyLoaded, setMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleClear = () => {
    setMessages([]);
    setHistoryLoaded(false);
    fetch("/api/agent/conversations", { method: "DELETE" });
  };

  const handleSend = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || isLoading) return;
    sendMessage({ text: msg });
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[400px] max-w-[90vw] p-0 flex flex-col"
      >
        <SheetTitle className="sr-only">AI Agent Chat</SheetTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-primary/10">
              <Sparkles className="h-4 w-4 text-[var(--accent-primary,#6366F1)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Marketing Agent</h3>
              <p className="text-xs text-muted-foreground">
                {pageContext.pageType !== "other"
                  ? `Viewing: ${pageContext.pageType.replace("_", " ")}`
                  : "Ready to help"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-8 w-8"
              title="Clear conversation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Sparkles className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">Hi! I&apos;m your marketing agent.</p>
              <p className="text-xs mt-1 max-w-[240px]">
                Ask me to find creators, draft outreach, check rates, or analyze campaigns.
              </p>
              <div className="mt-4 space-y-2 w-full max-w-[260px]">
                {[
                  "Find fitness creators in Mumbai",
                  "What's the going rate for micro-influencers?",
                  "How are my active campaigns performing?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="w-full rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
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
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary,#6366F1)] focus:ring-offset-1 max-h-[120px]"
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
      </SheetContent>
    </Sheet>
  );
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
