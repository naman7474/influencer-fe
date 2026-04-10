"use client";

import { useState, useEffect } from "react";
import { Send, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: {
    id: string;
    brand_name: string;
    gmail_email: string | null;
    email_sender_name: string | null;
  };
  campaigns: Array<{ id: string; name: string }>;
  onSent: () => void;
  prefillCreator?: {
    id: string;
    handle: string;
    display_name: string | null;
    contact_email: string | null;
    avatar_url?: string | null;
  };
  prefillCampaignId?: string;
}

interface Template {
  id: string;
  name: string;
  category: string | null;
  subject: string | null;
  body: string;
}

interface CreatorSearchResult {
  id: string;
  handle: string;
  display_name: string | null;
  contact_email: string | null;
  avatar_url: string | null;
}

export function ComposeModal({
  open,
  onOpenChange,
  brand,
  campaigns,
  onSent,
  prefillCreator,
  prefillCampaignId,
}: Props) {
  const [creatorSearch, setCreatorSearch] = useState("");
  const [creatorResults, setCreatorResults] = useState<CreatorSearchResult[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<CreatorSearchResult | null>(
    prefillCreator ? { ...prefillCreator, avatar_url: prefillCreator.avatar_url ?? null } : null
  );
  const [campaignId, setCampaignId] = useState(prefillCampaignId || "none");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("none");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Reset when opening
  useEffect(() => {
    if (open) {
      if (prefillCreator) setSelectedCreator({ ...prefillCreator, avatar_url: prefillCreator.avatar_url ?? null });
      if (prefillCampaignId) setCampaignId(prefillCampaignId);
      setError("");
    }
  }, [open, prefillCreator, prefillCampaignId]);

  // Fetch templates
  useEffect(() => {
    async function fetchTemplates() {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    }
    if (open) fetchTemplates();
  }, [open]);

  // Search creators
  useEffect(() => {
    if (!creatorSearch || creatorSearch.length < 2) {
      setCreatorResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const res = await fetch(
        `/api/messages/threads?search=${encodeURIComponent(creatorSearch)}&limit=5`
      );
      if (res.ok) {
        const data = await res.json();
        const creators = (data.threads || []).map(
          (t: { creators: CreatorSearchResult }) => t.creators
        );
        setCreatorResults(creators);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [creatorSearch]);

  // Apply template
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "none") return;

    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    // If we have a creator, preview with merge fields resolved
    if (selectedCreator) {
      const res = await fetch(`/api/templates/${templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator_id: selectedCreator.id,
          campaign_id: campaignId !== "none" ? campaignId : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubject(data.subject || "");
        setBodyHtml(data.body || "");
        return;
      }
    }

    // Fallback: use raw template
    setSubject(template.subject || "");
    setBodyHtml(template.body);
  };

  const handleSend = async () => {
    if (!selectedCreator) {
      setError("Please select a creator.");
      return;
    }
    if (!selectedCreator.contact_email) {
      setError("This creator has no email address on file.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!bodyHtml.trim()) {
      setError("Message body is required.");
      return;
    }

    setSending(true);
    setError("");

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator_id: selectedCreator.id,
        campaign_id: campaignId !== "none" ? campaignId : undefined,
        subject,
        body_html: bodyHtml.includes("<") ? bodyHtml : `<p>${bodyHtml.replace(/\n/g, "<br/>")}</p>`,
        template_id: selectedTemplateId !== "none" ? selectedTemplateId : undefined,
        recipient_email: selectedCreator.contact_email,
      }),
    });

    if (res.ok) {
      // Reset form
      setSelectedCreator(null);
      setCampaignId("none");
      setSelectedTemplateId("none");
      setSubject("");
      setBodyHtml("");
      onSent();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to send.");
    }
    setSending(false);
  };

  const handleSaveDraft = async () => {
    if (!selectedCreator || !bodyHtml.trim()) return;

    const res = await fetch("/api/messages/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator_id: selectedCreator.id,
        campaign_id: campaignId !== "none" ? campaignId : undefined,
        subject,
        body_html: bodyHtml.includes("<") ? bodyHtml : `<p>${bodyHtml.replace(/\n/g, "<br/>")}</p>`,
        template_id: selectedTemplateId !== "none" ? selectedTemplateId : undefined,
        recipient_email: selectedCreator.contact_email,
      }),
    });

    if (res.ok) {
      onSent();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* To: Creator search */}
          <div className="space-y-1.5">
            <Label>To</Label>
            {selectedCreator ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50">
                <span className="text-sm font-medium">
                  @{selectedCreator.handle}
                </span>
                {selectedCreator.display_name && (
                  <span className="text-sm text-muted-foreground">
                    ({selectedCreator.display_name})
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {selectedCreator.contact_email || "No email"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setSelectedCreator(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search creator by handle..."
                  className="pl-9"
                  value={creatorSearch}
                  onChange={(e) => setCreatorSearch(e.target.value)}
                />
                {creatorResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-lg border bg-popover shadow-lg">
                    {creatorResults.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg"
                        onClick={() => {
                          setSelectedCreator(c);
                          setCreatorSearch("");
                          setCreatorResults([]);
                        }}
                      >
                        <span className="font-medium">@{c.handle}</span>
                        {c.display_name && (
                          <span className="text-muted-foreground ml-2">
                            {c.display_name}
                          </span>
                        )}
                        {!c.contact_email && (
                          <span className="text-destructive text-xs ml-2">
                            No email
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Campaign + Template selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Campaign (optional)</Label>
              <Select value={campaignId} onValueChange={(v) => setCampaignId(v ?? "none")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(v) => handleTemplateSelect(v ?? "none")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.category && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({t.category})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* From */}
          <div className="space-y-1.5">
            <Label>From</Label>
            <div className="px-3 py-2 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
              {brand.email_sender_name || "You"} &lt;{brand.gmail_email || "not connected"}&gt;
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label>Body</Label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="Write your message..."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-[200px] focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={sending}>
            Save as Draft
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="size-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
