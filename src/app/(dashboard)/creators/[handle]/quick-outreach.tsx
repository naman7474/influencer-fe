"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renderTemplate } from "@/lib/outreach/render-template";
import type { OutreachChannel, OutreachTemplate } from "@/types/api";

type CreatorTarget = {
  id: string;
  handle: string;
  displayName: string;
  contactEmail: string | null;
};

export function QuickOutreachDialog({
  open,
  onOpenChange,
  creator,
  brandName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: CreatorTarget;
  brandName: string;
}) {
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;

    const loadTemplates = async () => {
      setIsLoading(true);
      const response = await fetch("/api/v1/outreach/templates");
      const payload = await response.json();

      if (!response.ok) {
        if (!isCancelled) {
          toast.error(payload.error?.message ?? "Unable to load templates.");
        }
        setIsLoading(false);
        return;
      }

      const nextTemplates = (payload.data?.templates ?? []) as OutreachTemplate[];
      if (isCancelled) {
        return;
      }

      setTemplates(nextTemplates);
      setIsLoading(false);

      if (nextTemplates.length > 0) {
        const firstTemplate = nextTemplates[0];
        setTemplateId(firstTemplate.id);
        setChannel(firstTemplate.channel);
        setSubject(firstTemplate.subject ?? "");
        setBody(firstTemplate.body);
        return;
      }

      setTemplateId("");
      setChannel("email");
      setSubject("");
      setBody(`Hi {{creator_name}},\n\nWould love to explore a partnership with ${brandName}.\n\nBest,\n${brandName}`);
    };

    void loadTemplates();

    return () => {
      isCancelled = true;
    };
  }, [brandName, open]);

  const applyTemplate = (
    template: OutreachTemplate | null,
    templateSource = templates
  ) => {
    if (!template) {
      setTemplateId("");
      setChannel("email");
      setSubject("");
      if (!body.trim()) {
        setBody(
          `Hi {{creator_name}},\n\nWould love to explore a partnership with ${brandName}.\n\nBest,\n${brandName}`
        );
      }
      return;
    }

    const nextTemplate =
      templateSource.find((item) => item.id === template.id) ?? template;

    setTemplateId(nextTemplate.id);
    setChannel(nextTemplate.channel);
    setSubject(nextTemplate.subject ?? "");
    setBody(nextTemplate.body);
  };

  const previewSubject = useMemo(() => {
    if (channel !== "email") {
      return "";
    }

    return renderTemplate(subject, {
      creator_name: creator.displayName,
      brand_name: brandName,
      handle: creator.handle,
      campaign_name: "",
      utm_link: "",
    });
  }, [brandName, channel, creator.displayName, creator.handle, subject]);

  const previewBody = useMemo(
    () =>
      renderTemplate(body, {
        creator_name: creator.displayName,
        brand_name: brandName,
        handle: creator.handle,
        campaign_name: "",
        utm_link: "",
      }),
    [body, brandName, creator.displayName, creator.handle]
  );

  const handleSubmit = () => {
    if (channel === "email" && !creator.contactEmail) {
      toast.error("No contact email is available for this creator.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/v1/outreach/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creator_ids: [creator.id],
          template_id: templateId || undefined,
          channel,
          subject: channel === "email" ? subject : null,
          body,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error?.message ?? "Unable to queue outreach.");
        return;
      }

      if (channel !== "email") {
        await navigator.clipboard.writeText(previewBody);
      }

      onOpenChange(false);
      toast.success(
        channel === "email"
          ? "Outreach queued."
          : "Manual outreach queued and copied."
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reach out to @{creator.handle}</DialogTitle>
          <DialogDescription>
            Pick a template, adjust the message, and queue outreach without
            leaving the profile.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Template</span>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={templateId}
                  onChange={(event) => {
                    const nextTemplate = templates.find(
                      (item) => item.id === event.target.value
                    );
                    applyTemplate(nextTemplate ?? null);
                  }}
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
                    setChannel(event.target.value as OutreachChannel)
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
                  placeholder="Partnership opportunity"
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

            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Delivery</p>
              <p className="mt-1 text-muted-foreground">
                {channel === "email"
                  ? creator.contactEmail
                    ? `Email will send to ${creator.contactEmail}.`
                    : "No contact email on file for this creator."
                  : "Manual channels are queued for tracking and copied to your clipboard."}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={isPending || isLoading || !body.trim()}
              >
                {channel === "email" ? "Send outreach" : "Copy message"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div className="mt-4 space-y-3 rounded-xl bg-background p-4">
              <p className="text-sm font-medium text-foreground">
                {creator.displayName}
                <span className="ml-1 text-muted-foreground">
                  @{creator.handle}
                </span>
              </p>
              {channel === "email" ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">Subject:</span>{" "}
                  {previewSubject || "No subject"}
                </div>
              ) : null}
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                {previewBody || "Start typing to preview your message."}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
