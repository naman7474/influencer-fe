"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/shared/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OutreachComposer } from "./outreach-composer";

function statusVariant(status: string): "outline" | "secondary" {
  return status === "replied" || status === "opened" || status === "delivered"
    ? "secondary"
    : "outline";
}

export function OutreachTab({
  campaignId,
  campaignName,
  brandName,
  creators,
  templates,
  messages,
}: {
  campaignId: string;
  campaignName: string;
  brandName: string;
  creators: Array<{
    id: string;
    handle: string;
    display_name: string | null;
    contact_email: string | null;
  }>;
  templates: Array<{
    id: string;
    name: string;
    channel: "email" | "whatsapp" | "instagram_dm";
    subject: string | null;
    body: string;
  }>;
  messages: Array<{
    id: string;
    channel: string;
    status: string;
    subject: string | null;
    created_at: string;
    creator?: {
      handle: string;
      display_name: string | null;
    };
  }>;
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [rows, setRows] = useState(messages);
  const [isRefreshing, startTransition] = useTransition();

  const refreshMessages = () => {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/v1/outreach/messages?campaign_id=${encodeURIComponent(campaignId)}&page=1&page_size=50`,
          { cache: "no-store" }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Unable to refresh outreach messages.");
        }
        setRows(payload.data.items ?? []);
      } catch (error) {
        router.refresh();
        toast.info(
          error instanceof Error
            ? `${error.message} Falling back to page refresh.`
            : "Refreshing outreach view."
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Outreach activity</p>
          <p className="text-sm text-muted-foreground">
            Queue email sends or track manual WhatsApp / Instagram DMs.
          </p>
        </div>
        <Button onClick={() => setComposerOpen(true)}>
          <MessageSquarePlus className="h-4 w-4" />
          Compose
        </Button>
      </div>

      {isRefreshing ? (
        <p className="text-xs text-muted-foreground">Refreshing outreach activity...</p>
      ) : null}

      <div className="rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Queued</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((message) => (
                <TableRow key={message.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">
                        {message.creator?.display_name ?? message.creator?.handle ?? "Unknown"}
                      </p>
                      {message.creator?.handle ? (
                        <p className="text-xs text-muted-foreground">@{message.creator.handle}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">
                    {message.channel.replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(message.status)}>{message.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate">
                    {message.subject || "Manual message"}
                  </TableCell>
                  <TableCell>
                    {new Date(message.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No outreach has been queued for this campaign yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <OutreachComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        campaignId={campaignId}
        campaignName={campaignName}
        brandName={brandName}
        creators={creators}
        templates={templates}
        onQueued={refreshMessages}
      />
    </div>
  );
}
