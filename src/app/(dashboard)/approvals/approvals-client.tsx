"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Send,
  XCircle,
} from "lucide-react";

interface ApprovalItem {
  id: string;
  action_type: string;
  title: string | null;
  description: string | null;
  status: string;
  payload: Record<string, unknown> | null;
  creator_id: string | null;
  campaign_id: string | null;
  message_id: string | null;
  created_at: string;
  approved_at: string | null;
  creator?: { handle: string; full_name: string | null } | null;
}

interface ApprovalsClientProps {
  brandId: string;
}

export function ApprovalsClient({ brandId }: ApprovalsClientProps) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [pendingCount, setPendingCount] = useState(0);

  const loadItems = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/approvals?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setPendingCount(data.pending_count ?? 0);
      }
    } catch {
      // Error handled
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems(filter);
  }, [filter, loadItems]);

  // Realtime subscription for new approvals
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("approvals-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_queue",
          filter: `brand_id=eq.${brandId}`,
        },
        () => {
          loadItems(filter);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [brandId, filter, loadItems]);

  return (
    <Tabs value={filter} onValueChange={setFilter}>
      <TabsList variant="line" className="mb-6">
        <TabsTrigger value="pending" className="gap-1.5">
          <Clock className="size-3.5" />
          Pending
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
              {pendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="approved" className="gap-1.5">
          <CheckCircle2 className="size-3.5" />
          Approved
        </TabsTrigger>
        <TabsTrigger value="rejected" className="gap-1.5">
          <XCircle className="size-3.5" />
          Rejected
        </TabsTrigger>
      </TabsList>

      <TabsContent value={filter}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Clock className="mx-auto size-10 mb-3 opacity-20" />
              <p className="font-medium">No {filter} items</p>
              <p className="text-sm mt-1">
                {filter === "pending"
                  ? "When your AI agent proposes actions, they'll appear here for review."
                  : `No ${filter} items to show.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
                onAction={() => loadItems(filter)}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

/* ── Single approval card ──────────────────────────────── */

function ApprovalCard({
  item,
  onAction,
}: {
  item: ApprovalItem;
  onAction: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const payload = item.payload || {};

  async function handleApprove() {
    setActing(true);
    try {
      await fetch(`/api/agent/approvals/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      onAction();
    } catch {
      // Error handled
    }
    setActing(false);
  }

  async function handleReject() {
    setActing(true);
    try {
      await fetch(`/api/agent/approvals/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason || undefined }),
      });
      setRejectOpen(false);
      onAction();
    } catch {
      // Error handled
    }
    setActing(false);
  }

  const actionIcon =
    item.action_type === "send_outreach" ? (
      <Send className="size-4" />
    ) : (
      <Mail className="size-4" />
    );

  const statusBadge =
    item.status === "approved" ? (
      <Badge variant="secondary" className="text-success">
        <CheckCircle2 className="size-3 mr-1" />
        Approved
      </Badge>
    ) : item.status === "rejected" ? (
      <Badge variant="secondary" className="text-destructive">
        <XCircle className="size-3 mr-1" />
        Rejected
      </Badge>
    ) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/30 text-amber-600">
              {actionIcon}
            </div>
            <div>
              <CardTitle className="text-sm">
                {item.title || "Agent Action"}
              </CardTitle>
              <CardDescription className="text-xs">
                {item.creator?.handle && `@${item.creator.handle}`}
                {item.creator?.handle && " · "}
                {new Date(item.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </CardDescription>
            </div>
          </div>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent>
        {item.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {item.description}
          </p>
        )}

        {/* Outreach preview */}
        {item.action_type === "send_outreach" && !!payload.subject && (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm mb-3">
            <p className="font-medium">{String(payload.subject)}</p>
            {!!payload.body_preview && (
              <p className="text-muted-foreground mt-1 text-xs line-clamp-3">
                {String(payload.body_preview)}
              </p>
            )}
          </div>
        )}

        {/* Action buttons for pending items */}
        {item.status === "pending" && (
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={acting}
            >
              {acting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve & Send
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectOpen(true)}
              disabled={acting}
            >
              <XCircle className="size-3.5" />
              Reject
            </Button>
          </div>
        )}

        {/* Reject dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Action</DialogTitle>
              <DialogDescription>
                Optionally provide a reason. The agent learns from rejections
                to make better proposals in the future.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Tone is too formal, try a casual approach"
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={acting}
              >
                {acting ? "Rejecting..." : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
