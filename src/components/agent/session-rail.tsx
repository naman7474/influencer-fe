"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/agent/load-chat-history";

/* ── Types ─────────────────────────────────────────────── */

interface SessionRailProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  pendingApprovalCount?: number;
}

/* ── Helpers ───────────────────────────────────────────── */

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupSessions(sessions: ChatSession[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; sessions: ChatSession[] }[] = [
    { label: "Today", sessions: [] },
    { label: "Last 7 days", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.updated_at);
    if (d >= today) groups[0].sessions.push(s);
    else if (d >= weekAgo) groups[1].sessions.push(s);
    else groups[2].sessions.push(s);
  }

  return groups.filter((g) => g.sessions.length > 0);
}

/* ── Component ─────────────────────────────────────────── */

export function SessionRail({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  collapsed,
  onToggleCollapsed,
  pendingApprovalCount = 0,
}: SessionRailProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, search]);

  const groups = useMemo(() => groupSessions(filtered), [filtered]);

  /* ── Collapsed strip ── */
  if (collapsed) {
    return (
      <div
        className="w-12 shrink-0 flex flex-col items-center py-3 gap-2 border-r"
        style={{ background: "var(--card)" }}
      >
        <button
          onClick={onToggleCollapsed}
          className="h-8 w-8 grid place-items-center rounded-md transition-colors hover:bg-surface-2"
          style={{ color: "var(--fg-dim)" }}
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onNewChat}
          className="h-8 w-8 grid place-items-center rounded-md transition-colors hover:bg-surface-2"
          style={{ color: "var(--fg-dim)" }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  /* ── Expanded rail ── */
  return (
    <div
      className="w-[232px] shrink-0 flex flex-col border-r"
      style={{ background: "var(--card)" }}
    >
      {/* Header */}
      <div className="h-10 px-3 flex items-center gap-2 border-b">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
        <span className="text-[12.5px] font-semibold">Marketing Agent</span>
        <div className="flex-1" />
        <button
          onClick={onToggleCollapsed}
          className="h-6 w-6 grid place-items-center rounded-md transition-colors hover:bg-surface-2"
          style={{ color: "var(--fg-faint)" }}
        >
          <PanelLeftClose className="h-3 w-3" />
        </button>
      </div>

      {/* New Chat */}
      <div className="p-2">
        <button
          onClick={onNewChat}
          className="w-full h-8 px-2 rounded-md flex items-center gap-2 text-[12.5px] font-medium border transition-colors hover:bg-surface-2"
          style={{ color: "var(--foreground)", background: "var(--card)" }}
        >
          <Plus className="h-3 w-3" />
          <span>New chat</span>
          <div className="flex-1" />
          <kbd className="text-[10px] font-mono px-1 py-0.5 rounded border bg-card" style={{ color: "var(--fg-dim)" }}>
            ⌘N
          </kbd>
        </button>
      </div>

      {/* Search */}
      <div className="px-2 pb-2">
        <div
          className="h-7 px-2 rounded-md flex items-center gap-1.5 text-[11.5px]"
          style={{
            background: "var(--surface-2)",
            color: "var(--fg-faint)",
          }}
        >
          <Search className="h-3 w-3 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="flex-1 bg-transparent text-[11.5px] focus:outline-none placeholder:text-[var(--fg-faint)]"
            style={{ color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* Pending approvals */}
      {pendingApprovalCount > 0 && (
        <div className="px-2 pb-2">
          <div
            className="rounded-md px-2 py-1.5"
            style={{
              background: "var(--amber-soft)",
              border: "1px solid var(--amber)",
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[11px] font-medium"
              style={{ color: "var(--amber)" }}
            >
              <Clock className="h-2.5 w-2.5" />
              {pendingApprovalCount} approval{pendingApprovalCount === 1 ? "" : "s"} waiting
            </div>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto agent-scroll">
        {groups.map((group) => (
          <div key={group.label}>
            <div
              className="px-3 pb-1 pt-2 text-[10px] font-mono uppercase tracking-wider"
              style={{ color: "var(--fg-faint)" }}
            >
              {group.label}
            </div>
            {group.sessions.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(session)}
                onKeyDown={(e) => e.key === "Enter" && onSelectSession(session)}
                className={cn(
                  "w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors group cursor-pointer",
                  activeSessionId === session.id
                    ? "bg-surface-2"
                    : "hover:bg-surface-2"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[12px] truncate"
                    style={{
                      color:
                        activeSessionId === session.id
                          ? "var(--foreground)"
                          : "var(--muted-foreground)",
                      fontWeight: activeSessionId === session.id ? 500 : 400,
                    }}
                  >
                    {session.title}
                  </div>
                </div>
                <span
                  className="text-[10px] font-mono shrink-0 group-hover:hidden"
                  style={{ color: "var(--fg-faint)" }}
                >
                  {formatRelativeDate(session.updated_at)}
                </span>
                <button
                  className="h-5 w-5 hidden group-hover:grid place-items-center rounded shrink-0 transition-colors hover:bg-surface-3"
                  style={{ color: "var(--fg-faint)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ))}

        {sessions.length === 0 && (
          <p
            className="px-3 py-6 text-[11px] text-center"
            style={{ color: "var(--fg-faint)" }}
          >
            No previous chats
          </p>
        )}
      </div>

      {/* Footer spacer */}
      <div className="h-2 border-t" />
    </div>
  );
}
