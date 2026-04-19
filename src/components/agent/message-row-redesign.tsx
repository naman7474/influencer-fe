"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  ChevronRight,
  ChevronDown,
  Clock,
  X,
  Edit3,
  ArrowUpRight,
  Users,
  UserCircle,
  Target,
  Mail,
  Gauge,
  Handshake,
  FileText,
  Wallet,
  TrendingUp,
  Eye,
  Heart,
  Sparkles,
} from "lucide-react";
import { AgentMarkdown } from "@/components/agent/markdown";
import { TOOL_LABELS } from "@/components/agent/tool-labels";
import type { Highlight, HighlightKind } from "@/lib/agent/highlights";
import { useHighlightFocus } from "./highlight-focus-context";

/* ── Kind → icon mapping ───────────────────────────────── */

const KIND_ICON: Record<HighlightKind, LucideIcon> = {
  creators_found: Users,
  creator_profile: UserCircle,
  campaign_created: Target,
  campaign_overview: Target,
  outreach_drafted: Mail,
  approval_pending: Clock,
  rate_benchmark: Gauge,
  negotiation: Handshake,
  deal_memo: FileText,
  budget: Wallet,
  roi: TrendingUp,
  content_tracked: Eye,
  brief_generated: FileText,
  relationship_insight: Heart,
  generic: Sparkles,
};

/* ── Thinking indicator ────────────────────────────────── */

export function ThinkingIndicator() {
  return (
    <div className="assistant-block is-active">
      <div
        className="flex items-center gap-2 text-[12.5px]"
        style={{ color: "var(--fg-dim)" }}
      >
        <span className="flex gap-1">
          <span
            className="dot-pulse h-1 w-1 rounded-full"
            style={{ background: "var(--primary)" }}
          />
          <span
            className="dot-pulse h-1 w-1 rounded-full"
            style={{ background: "var(--primary)" }}
          />
          <span
            className="dot-pulse h-1 w-1 rounded-full"
            style={{ background: "var(--primary)" }}
          />
        </span>
        <span className="thinking-cursor">Thinking</span>
      </div>
    </div>
  );
}

/* ── Message row ───────────────────────────────────────── */

interface MessageRowProps {
  message: UIMessage;
  highlightById: Map<string, Highlight>;
  isLastAssistant?: boolean;
  isStreaming?: boolean;
  onOpenArtifact?: (highlightId: string) => void;
  activeArtifactId?: string | null;
}

export function MessageRowRedesign({
  message,
  highlightById,
  isLastAssistant = false,
  isStreaming = false,
  onOpenArtifact,
  activeArtifactId,
}: MessageRowProps) {
  const isUser = message.role === "user";

  /* ── User message ── */
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] text-[13.5px] px-3.5 py-2 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            lineHeight: 1.55,
          }}
        >
          {message.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("")}
        </div>
      </div>
    );
  }

  /* ── Assistant message ── */
  const isActive = isLastAssistant && isStreaming;

  return (
    <div className={`assistant-block ${isActive ? "is-active" : ""}`}>
      <div className="flex flex-col gap-2.5">
        {message.parts.map((part, i) => {
          /* Text */
          if (part.type === "text" && part.text.trim()) {
            return (
              <div
                key={i}
                className="text-[13.5px]"
                style={{ color: "var(--foreground)", lineHeight: 1.65 }}
              >
                <AgentMarkdown content={part.text} />
              </div>
            );
          }

          /* Tool invocations */
          const toolPart = part as unknown as Record<string, unknown>;
          if (toolPart.toolCallId) {
            const toolState = toolPart.state as string;
            const typeStr =
              typeof toolPart.type === "string" ? toolPart.type : "";
            const toolName =
              (toolPart.toolName as string | undefined) ??
              (typeStr.startsWith("tool-") ? typeStr.slice(5) : "");
            const toolCallId = String(toolPart.toolCallId);

            /* In-flight */
            const isInFlight =
              toolState === "input-streaming" ||
              toolState === "input-available" ||
              toolState === "approval-requested" ||
              toolState === "call" ||
              toolState === "partial-call";

            if (isInFlight) {
              return (
                <ToolStepRunning
                  key={toolCallId}
                  toolName={toolName}
                />
              );
            }

            /* Error */
            if (
              toolState === "output-error" ||
              toolState === "output-denied"
            ) {
              const errorText = String(
                toolPart.errorText ?? "Tool failed"
              );
              return (
                <div
                  key={toolCallId}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
                  style={{
                    background: "var(--danger-soft)",
                    border: "1px solid var(--danger)",
                    color: "var(--danger)",
                  }}
                >
                  <X className="h-3 w-3" />
                  <span>
                    {toolName.replace(/_/g, " ")} — {errorText}
                  </span>
                </div>
              );
            }

            /* Completed */
            const isComplete =
              toolState === "output-available" ||
              toolState === "result" ||
              toolState === "output";
            if (isComplete) {
              const highlight = highlightById.get(toolCallId);
              if (highlight) {
                // Show approval banner for outreach drafts, campaigns, and pending approvals
                const needsApproval =
                  highlight.kind === "approval_pending" ||
                  highlight.kind === "outreach_drafted" ||
                  highlight.kind === "campaign_created";
                // Only show after agent finishes streaming
                const showApproval = needsApproval && !isStreaming;
                const approvalLabel =
                  highlight.kind === "campaign_created"
                    ? "Approve & activate"
                    : "Approve & send";
                return (
                  <div key={toolCallId} className="flex flex-col gap-2">
                    <ArtifactRefCard
                      highlight={highlight}
                      onOpen={onOpenArtifact}
                      isActive={activeArtifactId === highlight.id}
                    />
                    {showApproval && (
                      <ApprovalBanner
                        approvalId={String(highlight.toolOutput.approval_id ?? highlight.id)}
                        title={highlight.title}
                        primaryLabel={approvalLabel}
                        onOpen={() => onOpenArtifact?.(highlight.id)}
                      />
                    )}
                  </div>
                );
              }
              /* No highlight — show completed step */
              return (
                <ToolStepDone key={toolCallId} toolName={toolName} />
              );
            }
          }
          return null;
        })}
      </div>
    </div>
  );
}

/* ── Tool step: running ────────────────────────────────── */

function ToolStepRunning({ toolName }: { toolName: string }) {
  const info = TOOL_LABELS[toolName];
  const label = info?.label || toolName.replace(/_/g, " ");

  return (
    <div className="flex items-start gap-2.5 py-0.5">
      {/* Spinner */}
      <div className="mt-[3px] shrink-0">
        <div
          className="h-3 w-3 rounded-full relative"
          style={{ background: "var(--indigo-soft)" }}
        >
          <div
            className="absolute inset-0 rounded-full border-2 animate-spin"
            style={{
              borderColor: "transparent",
              borderTopColor: "var(--primary)",
            }}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span
            className="text-[12.5px] font-medium"
            style={{ color: "var(--foreground)" }}
          >
            {label}
          </span>
          <span
            className="font-mono text-[10.5px] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--surface-2)",
              color: "var(--fg-faint)",
            }}
          >
            {toolName}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Tool step: done ───────────────────────────────────── */

function ToolStepDone({ toolName }: { toolName: string }) {
  const info = TOOL_LABELS[toolName];
  const label = info?.label || toolName.replace(/_/g, " ");

  return (
    <div className="flex items-start gap-2.5 py-0.5">
      <div className="mt-[3px] shrink-0">
        <div
          className="h-3 w-3 rounded-full grid place-items-center"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <Check
            className="h-2 w-2"
            style={{ color: "var(--fg-dim)" }}
          />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className="text-[12.5px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          {label}
        </span>
        <span
          className="font-mono text-[10.5px] px-1.5 py-0.5 rounded"
          style={{
            background: "var(--surface-2)",
            color: "var(--fg-faint)",
          }}
        >
          {toolName}
        </span>
      </div>
    </div>
  );
}

/* ── Artifact reference card ───────────────────────────── */

function ArtifactRefCard({
  highlight,
  onOpen,
  isActive,
}: {
  highlight: Highlight;
  onOpen?: (id: string) => void;
  isActive?: boolean;
}) {
  const Icon = KIND_ICON[highlight.kind] ?? Sparkles;
  const kindLabel: Record<string, string> = {
    creators_found: "Creator list",
    creator_profile: "Creator profile",
    outreach_drafted: "Email draft",
    rate_benchmark: "Rate benchmark",
    negotiation: "Counter-offer",
    deal_memo: "Deal memo",
    campaign_created: "Campaign spec",
    campaign_overview: "Campaign overview",
    budget: "Budget analysis",
    roi: "ROI report",
    content_tracked: "Content tracker",
    brief_generated: "Brief",
    relationship_insight: "Relationship insight",
    approval_pending: "Approval",
    generic: "Document",
  };

  return (
    <button
      onClick={() => onOpen?.(highlight.id)}
      className="group flex items-center gap-3 text-left transition-all w-full"
      style={{
        background: isActive ? "var(--indigo-soft)" : "var(--card)",
        border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div
        className="h-9 w-9 rounded-md grid place-items-center shrink-0"
        style={{
          background: isActive ? "var(--card)" : "var(--surface-2)",
          border: "1px solid var(--border)",
          color: isActive ? "var(--accent-fg)" : "var(--muted-foreground)",
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-medium truncate"
            style={{
              color: isActive ? "var(--accent-fg)" : "var(--foreground)",
            }}
          >
            {highlight.title}
          </span>
        </div>
        <div
          className="text-[11.5px] font-mono mt-0.5"
          style={{ color: "var(--fg-faint)" }}
        >
          {kindLabel[highlight.kind] || "Document"} · open in canvas
        </div>
      </div>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: "var(--fg-faint)" }}
      />
    </button>
  );
}

/* ── Approval banner (inline in chat) ─────────────────── */

function ApprovalBanner({
  approvalId,
  title,
  primaryLabel = "Approve & send",
  onOpen,
}: {
  approvalId: string;
  title: string;
  primaryLabel?: string;
  onOpen?: () => void;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: "var(--amber-soft)",
        border: "1px solid var(--amber)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3 w-3" style={{ color: "var(--amber)" }} />
        <span className="text-[12px] font-medium" style={{ color: "var(--amber)" }}>
          Awaiting your approval
        </span>
        <span className="text-[11px] font-mono truncate flex-1" style={{ color: "var(--fg-dim)" }}>
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="h-7 px-2.5 rounded-md text-[12px] font-medium flex items-center gap-1.5"
          style={{ background: "var(--foreground)", color: "var(--background)" }}
        >
          {primaryLabel}
          <kbd className="text-[10px] font-mono ml-1 opacity-60">⌘↵</kbd>
        </button>
        <button
          className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border"
          style={{ color: "var(--foreground)", background: "var(--card)" }}
        >
          <Edit3 className="h-3 w-3" /> Edit
        </button>
        <button
          className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border"
          style={{ color: "var(--danger)", background: "var(--card)" }}
        >
          Reject
        </button>
        <div className="flex-1" />
        {onOpen && (
          <button
            onClick={onOpen}
            className="h-7 px-2 rounded-md text-[11px] font-mono flex items-center gap-1 transition-colors hover:bg-surface-2"
            style={{ color: "var(--fg-dim)" }}
          >
            Open in canvas <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
