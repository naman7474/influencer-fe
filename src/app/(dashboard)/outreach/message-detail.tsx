"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Send,
  User,
  ExternalLink,
  Eye,
  Clock,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ThreadAssignee } from "@/components/outreach/thread-assignee";
import { MatchScoreChip } from "@/components/outreach/match-score-chip";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  channel: string;
  direction?: "outbound" | "inbound";
  sender_name: string | null;
  sent_by_user_id?: string | null;
  from_email: string | null;
  recipient_email: string | null;
  resend_message_id: string | null;
  gmail_thread_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  open_count: number;
  created_at: string;
}

interface Reply {
  id: string;
  from_email: string | null;
  subject: string | null;
  text_content: string | null;
  html_content: string | null;
  received_at: string;
}

interface ThreadData {
  thread: {
    id: string;
    subject: string | null;
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
      city: string | null;
      followers: number | null;
      tier: string | null;
    };
    campaigns: { id: string; name: string } | null;
  };
  messages: Message[];
  replies: Reply[];
}

interface Props {
  threadId: string;
  brand: {
    id: string;
    brand_name: string;
    gmail_connected: boolean;
    gmail_email: string | null;
    email_sender_name: string | null;
  };
  onBack: () => void;
  onThreadUpdate: () => void;
}

export function MessageDetail({ threadId, brand, onBack, onThreadUpdate }: Props) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchThread() {
      setLoading(true);
      const res = await fetch(`/api/messages/threads/${threadId}`);
      if (res.ok) {
        const threadData = await res.json();
        setData(threadData);

        // Mark as read
        if (threadData.thread.unread_count > 0) {
          await fetch(`/api/messages/threads/${threadId}/read`, {
            method: "POST",
          });
          onThreadUpdate();
        }
      }
      setLoading(false);
    }
    fetchThread();
  }, [threadId, onThreadUpdate]);

  useEffect(() => {
    // Scroll to bottom when messages load
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !data) return;
    setSending(true);

    const creator = data.thread.creators;
    const latestMessage = data.messages[data.messages.length - 1];

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator_id: creator.id,
        campaign_id: data.thread.campaign_id,
        subject: `Re: ${data.thread.subject || ""}`,
        body_html: `<p>${replyText.replace(/\n/g, "<br/>")}</p>`,
        recipient_email: creator.contact_email,
        thread_id: threadId,
        gmail_thread_id: latestMessage?.gmail_thread_id,
        reply_to_message_id: latestMessage?.resend_message_id,
      }),
    });

    if (res.ok) {
      setReplyText("");
      // Refresh thread
      const refreshRes = await fetch(`/api/messages/threads/${threadId}`);
      if (refreshRes.ok) {
        setData(await refreshRes.json());
      }
      onThreadUpdate();
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-sm text-muted-foreground">Thread not found</p>
      </div>
    );
  }

  const { thread, messages, replies } = data;
  const creator = thread.creators;

  // Merge messages and replies into chronological timeline
  type TimelineItem =
    | { type: "outbound"; data: Message }
    | { type: "inbound"; data: Reply };

  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({
      type: "outbound" as const,
      data: m,
      time: new Date(m.sent_at || m.created_at).getTime(),
    })),
    ...replies.map((r) => ({
      type: "inbound" as const,
      data: r,
      time: new Date(r.received_at).getTime(),
    })),
  ].sort((a, b) => a.time - b.time);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" />
        </Button>

        <Avatar size="sm">
          {creator.avatar_url && (
            <AvatarImage src={creator.avatar_url} alt={creator.handle} />
          )}
          <AvatarFallback>
            {(creator.display_name || creator.handle).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">@{creator.handle}</span>
            {creator.tier && (
              <Badge variant="secondary" className="text-[10px] py-0">
                {creator.tier}
              </Badge>
            )}
            <MatchScoreChip score={thread.match_score} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {creator.display_name && <span>{creator.display_name}</span>}
            {creator.city && (
              <>
                <span>·</span>
                <span>{creator.city}</span>
              </>
            )}
            {thread.campaigns && (
              <>
                <span>·</span>
                <span>Campaign: {thread.campaigns.name}</span>
              </>
            )}
          </div>
        </div>

        <ThreadAssignee
          threadId={thread.id}
          initialAssigneeId={thread.assigned_to_user_id}
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(`/creator/${creator.handle}`, "_blank")}
        >
          <User className="size-4 mr-1" />
          Profile
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-4 max-w-2xl mx-auto">
          {timeline.map((item, i) => {
            if (item.type === "outbound") {
              const msg = item.data;
              return (
                <div key={`msg-${msg.id}`} className="flex justify-end">
                  <div className="max-w-[80%]">
                    {msg.subject && (
                      <p className="text-[10px] font-medium text-muted-foreground mb-1 text-right px-1">
                        {msg.subject}
                      </p>
                    )}
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-br-sm px-4 py-3">
                      <div
                        className="text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: msg.body
                            .replace(/<img[^>]*track[^>]*>/gi, "")
                            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""),
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1 justify-end text-[10px] text-muted-foreground px-1">
                      {msg.channel === "instagram_dm" && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                          IG
                        </Badge>
                      )}
                      <span className="font-medium">
                        {msg.sender_name ?? "You"}
                      </span>
                      <span>·</span>
                      <span>
                        {msg.sent_at
                          ? new Date(msg.sent_at).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "Draft"}
                      </span>
                      {(msg.status === "sent" || msg.status === "delivered") && (
                        <CheckCheck className="size-3 text-primary" />
                      )}
                      {msg.opened_at && (
                        <>
                          <Eye className="size-3 text-blue-500" />
                          <span>
                            {msg.open_count} open{msg.open_count !== 1 && "s"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              const reply = item.data;
              return (
                <div key={`reply-${reply.id}`} className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <Avatar size="sm">
                        {creator.avatar_url && (
                          <AvatarImage src={creator.avatar_url} alt={creator.handle} />
                        )}
                        <AvatarFallback className="text-[8px]">
                          {(creator.display_name || creator.handle).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] font-medium">@{creator.handle}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(reply.received_at).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="bg-muted/60 border rounded-2xl rounded-bl-sm px-4 py-3">
                      <div
                        className="text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: reply.html_content || reply.text_content || "",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            }
          })}

          {timeline.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No messages yet. Start the conversation below.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Reply Composer */}
      <div className="border-t px-4 py-3 shrink-0">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={
              creator.contact_email
                ? `Reply to @${creator.handle}...`
                : "No email address on file"
            }
            disabled={!creator.contact_email}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm min-h-[40px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSendReply();
              }
            }}
          />
          <Button
            size="icon"
            disabled={!replyText.trim() || sending || !creator.contact_email}
            onClick={handleSendReply}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
