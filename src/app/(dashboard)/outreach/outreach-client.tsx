"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Send,
  Search,
  Filter,
  Plus,
  Mail,
  MailOpen,
  MessageSquare,
  AlertCircle,
  Clock,
  Check,
  CheckCheck,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ComposeModal } from "./compose-modal";
import { MessageDetail } from "./message-detail";
import { MatchScoreChip } from "@/components/outreach/match-score-chip";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ThreadItem {
  id: string;
  subject: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: string | null;
  last_message_channel: string | null;
  unread_count: number;
  outreach_status: string;
  campaign_id: string | null;
  assigned_to_user_id: string | null;
  match_score: number | null;
  creators: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    contact_email: string | null;
  };
  campaigns: { id: string; name: string } | null;
}

type Member = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

interface Props {
  brand: {
    id: string;
    brand_name: string;
    gmail_connected: boolean;
    gmail_email: string | null;
    email_sender_name: string | null;
  };
  campaigns: Array<{ id: string; name: string }>;
}

/* ------------------------------------------------------------------ */
/*  Status Icons                                                       */
/* ------------------------------------------------------------------ */

function StatusIcon({ status }: { status: string }) {
  const dotColor = (() => {
    switch (status) {
      case "replied": return "bg-success";
      case "opened": return "bg-info";
      case "negotiating": return "bg-warning";
      case "bounced":
      case "failed": return "bg-destructive";
      case "sent":
      case "delivered": return "bg-muted-foreground";
      default: return "bg-muted-foreground/50";
    }
  })();
  return <span className={cn("size-2 rounded-full shrink-0", dotColor)} />;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    none: "New",
    draft: "Draft",
    queued: "Queued",
    sent: "Sent",
    delivered: "Delivered",
    opened: "Opened",
    replied: "Replied",
    bounced: "Bounced",
    failed: "Failed",
    negotiating: "Negotiating",
    confirmed: "Confirmed",
    declined: "Declined",
  };
  return labels[status] || status;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function OutreachClient({ brand, campaigns }: Props) {
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    searchParams.get("thread") || null
  );
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    fetch("/api/team/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => {});
  }, []);

  const memberById = new Map(members.map((m) => [m.user_id, m]));

  const [prefillCreator, setPrefillCreator] = useState<{
    id: string;
    handle: string;
    display_name: string | null;
    contact_email: string | null;
    avatar_url?: string | null;
  } | null>(null);

  // Deep-link from Discover / Creator profile: `?compose=1&creator_id=…`
  // opens the compose modal with that creator pre-selected.
  useEffect(() => {
    if (searchParams.get("compose") !== "1") return;
    const creatorId = searchParams.get("creator_id");
    if (!creatorId) {
      setComposeOpen(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("creators")
        .select("id, handle, display_name, contact_email, avatar_url")
        .eq("id", creatorId)
        .single();
      if (cancelled) return;
      const row = data as
        | {
            id: string;
            handle: string;
            display_name: string | null;
            contact_email: string | null;
            avatar_url: string | null;
          }
        | null;
      if (row) setPrefillCreator(row);
      setComposeOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (campaignFilter !== "all") params.set("campaign_id", campaignFilter);
    if (searchQuery) params.set("search", searchQuery);

    const res = await fetch(`/api/messages/threads?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setThreads(data.threads || []);
    }
    setLoading(false);
  }, [filter, campaignFilter, searchQuery]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  // Gmail not connected state
  if (!brand.gmail_connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="flex items-center justify-center size-16 rounded-full bg-muted">
          <MailOpen className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Connect Gmail to start</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Connect your Gmail account to send personalized outreach emails to creators directly from your own email address.
        </p>
        <Button onClick={() => (window.location.href = "/settings")}>
          <Mail className="size-4 mr-2" />
          Go to Settings
        </Button>
      </div>
    );
  }

  // Group threads by campaign
  const campaignGroups = new Map<string, ThreadItem[]>();
  const ungroupedThreads: ThreadItem[] = [];

  for (const thread of threads) {
    if (thread.campaigns) {
      const key = thread.campaigns.id;
      if (!campaignGroups.has(key)) {
        campaignGroups.set(key, []);
      }
      campaignGroups.get(key)!.push(thread);
    } else {
      ungroupedThreads.push(thread);
    }
  }

  return (
    <div className="-mx-4 -my-6 md:-mx-8 md:-my-6 flex h-[calc(100vh-56px)]">
      {/* ── Thread List Panel ──────────────────────────────────────── */}
      <div
        className={cn(
          "w-full md:w-[360px] lg:w-[380px] flex flex-col border-r shrink-0",
          selectedThreadId && "hidden md:flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h1 className="font-serif text-lg">Outreach</h1>
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <Plus className="size-4 mr-1" />
            Compose
          </Button>
        </div>

        {/* Filters */}
        <div className="px-3 py-2 space-y-2 border-b">
          <div className="flex gap-1">
            {["all", "unread", "sent", "drafts"].map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search creators..."
                className="pl-8 h-8 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {campaigns.length > 0 && (
              <Select value={campaignFilter} onValueChange={(v) => setCampaignFilter(v ?? "all")}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <Filter className="size-3 mr-1" />
                  <SelectValue placeholder="Campaign">
                    {(v) => {
                      if (v == null || v === "all") return "All campaigns";
                      return campaigns.find((c) => c.id === v)?.name ?? "All campaigns";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All campaigns</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Thread list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading conversations...
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Send className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start outreach from a campaign or compose a new message.
              </p>
            </div>
          ) : (
            <>
              {/* Campaign grouped threads */}
              {Array.from(campaignGroups.entries()).map(([campaignId, groupThreads]) => (
                <div key={campaignId}>
                  <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {groupThreads[0]?.campaigns?.name || "Campaign"}
                  </div>
                  {groupThreads.map((thread) => (
                    <ThreadListItem
                      key={thread.id}
                      thread={thread}
                      isActive={thread.id === selectedThreadId}
                      onClick={() => setSelectedThreadId(thread.id)}
                      memberById={memberById}
                    />
                  ))}
                </div>
              ))}

              {/* Ungrouped threads */}
              {ungroupedThreads.length > 0 && (
                <>
                  {campaignGroups.size > 0 && (
                    <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      All Conversations
                    </div>
                  )}
                  {ungroupedThreads.map((thread) => (
                    <ThreadListItem
                      key={thread.id}
                      thread={thread}
                      isActive={thread.id === selectedThreadId}
                      onClick={() => setSelectedThreadId(thread.id)}
                      memberById={memberById}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollArea>
      </div>

      {/* ── Message Detail Panel ───────────────────────────────────── */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          !selectedThreadId && "hidden md:flex"
        )}
      >
        {selectedThread ? (
          <MessageDetail
            threadId={selectedThread.id}
            brand={brand}
            onBack={() => setSelectedThreadId(null)}
            onThreadUpdate={fetchThreads}
          />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
            <MailOpen className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a conversation to view messages
            </p>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onOpenChange={(next) => {
          setComposeOpen(next);
          if (!next) setPrefillCreator(null);
        }}
        brand={brand}
        campaigns={campaigns}
        prefillCreator={prefillCreator ?? undefined}
        onSent={() => {
          setComposeOpen(false);
          setPrefillCreator(null);
          fetchThreads();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Thread List Item                                                   */
/* ------------------------------------------------------------------ */

function ThreadListItem({
  thread,
  isActive,
  onClick,
  memberById,
}: {
  thread: ThreadItem;
  isActive: boolean;
  onClick: () => void;
  memberById: Map<string, Member>;
}) {
  const isUnread = thread.unread_count > 0;
  const creator = thread.creators;
  const assignee = thread.assigned_to_user_id
    ? memberById.get(thread.assigned_to_user_id)
    : null;
  const channel = thread.last_message_channel;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
        isActive && "bg-accent/10 border-l-[3px] border-l-primary",
        isUnread && !isActive && "border-l-[3px] border-l-primary/60"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar size="sm" className="shrink-0 mt-0.5">
          {creator.avatar_url && (
            <AvatarImage src={creator.avatar_url} alt={creator.handle} />
          )}
          <AvatarFallback>
            {(creator.display_name || creator.handle).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-sm truncate", isUnread && "font-semibold")}>
              @{creator.handle}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <MatchScoreChip score={thread.match_score} size="xs" />
              <StatusIcon status={thread.outreach_status} />
              <span className="text-[11px] text-muted-foreground">
                {timeAgo(thread.last_message_at)}
              </span>
            </div>
          </div>

          {creator.display_name && (
            <p className="text-xs text-muted-foreground truncate">
              {creator.display_name}
            </p>
          )}

          {thread.last_message_preview && (
            <p
              className={cn(
                "text-xs mt-0.5 truncate",
                isUnread
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {thread.last_message_direction === "outbound" ? "You: " : ""}
              {thread.last_message_preview}
            </p>
          )}

          {(channel || assignee) && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {channel && (
                <span
                  className={cn(
                    "inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-md uppercase tracking-wide",
                    channel === "instagram_dm"
                      ? "bg-pink-500/10 text-pink-600 dark:text-pink-400"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  )}
                >
                  {channel === "instagram_dm" ? "IG" : "Email"}
                </span>
              )}
              {assignee && (
                <span className="inline-flex items-center text-[10px] text-muted-foreground">
                  · {assignee.display_name ?? assignee.email ?? "Assigned"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
