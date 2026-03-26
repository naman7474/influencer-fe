"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/shared/toast";
import { renderTemplate } from "@/lib/outreach/render-template";

type ComposerCreator = {
  id: string;
  handle: string;
  display_name: string | null;
  contact_email: string | null;
};

type ComposerTemplate = {
  id: string;
  name: string;
  channel: "email" | "whatsapp" | "instagram_dm";
  subject: string | null;
  body: string;
};

export function OutreachComposer({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  brandName,
  creators,
  templates,
  onQueued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  brandName: string;
  creators: ComposerCreator[];
  templates: ComposerTemplate[];
  onQueued: () => void;
}) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [channel, setChannel] = useState<"email" | "whatsapp" | "instagram_dm">(
    templates[0]?.channel ?? "email"
  );
  const [subject, setSubject] = useState<string>(templates[0]?.subject ?? "");
  const [body, setBody] = useState<string>(templates[0]?.body ?? "");
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const previewCreator = creators.find((creator) => creator.id === selectedCreatorIds[0]) ?? creators[0];

  const previewBody = previewCreator
    ? renderTemplate(body, {
        creator_name: previewCreator.display_name ?? previewCreator.handle,
        brand_name: brandName,
        handle: previewCreator.handle,
        campaign_name: campaignName,
        utm_link: "",
      })
    : body;

  const toggleCreator = (creatorId: string) => {
    setSelectedCreatorIds((current) =>
      current.includes(creatorId)
        ? current.filter((id) => id !== creatorId)
        : [...current, creatorId]
    );
  };

  const handleTemplateChange = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    const nextTemplate = templates.find((template) => template.id === nextTemplateId);
    if (!nextTemplate) {
      return;
    }
    setChannel(nextTemplate.channel);
    setSubject(nextTemplate.subject ?? "");
    setBody(nextTemplate.body);
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const response = await fetch("/api/v1/outreach/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          creator_ids: selectedCreatorIds,
          template_id: templateId || undefined,
          channel,
          subject,
          body,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error?.message ?? "Unable to queue outreach.");
        return;
      }

      if (channel !== "email" && previewBody && selectedCreatorIds.length === 1) {
        await navigator.clipboard.writeText(previewBody);
      }
      onQueued();
      onOpenChange(false);
      toast.success(
        channel === "email"
          ? "Outreach queued."
          : selectedCreatorIds.length === 1
            ? "Manual outreach queued and message copied."
            : "Manual outreach queued."
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Compose outreach</DialogTitle>
          <DialogDescription>
            Personalize a template, choose a channel, and queue outreach for one or more creators.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Template</span>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={templateId}
                  onChange={(event) => handleTemplateChange(event.target.value)}
                >
                  <option value="">Custom</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Channel</span>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={channel}
                  onChange={(event) =>
                    setChannel(event.target.value as "email" | "whatsapp" | "instagram_dm")
                  }
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram_dm">Instagram DM</option>
                </select>
              </label>
            </div>

            {channel === "email" ? (
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Subject</span>
                <input
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
            ) : null}

            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Message</span>
              <textarea
                className="min-h-44 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus-visible:border-ring"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Creators</p>
              <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border bg-muted/30 p-3">
                {creators.map((creator) => (
                  <label
                    key={creator.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm"
                  >
                    <span>
                      {creator.display_name ?? creator.handle}
                      <span className="ml-1 text-muted-foreground">@{creator.handle}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedCreatorIds.includes(creator.id)}
                      onChange={() => toggleCreator(creator.id)}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={isPending || !selectedCreatorIds.length || !body.trim()}>
                {channel === "email" ? "Send" : "Copy message"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              <p className="mt-3 text-sm font-medium text-foreground">
                {previewCreator
                  ? `${previewCreator.display_name ?? previewCreator.handle} (@${previewCreator.handle})`
                  : "Select a creator"}
              </p>
              {channel === "email" ? (
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {previewCreator ? renderTemplate(subject, {
                    creator_name: previewCreator.display_name ?? previewCreator.handle,
                    brand_name: brandName,
                    handle: previewCreator.handle,
                    campaign_name: campaignName,
                    utm_link: "",
                  }) : subject}
                </p>
              ) : null}
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-background px-4 py-4 text-sm text-foreground">
                {previewBody}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
