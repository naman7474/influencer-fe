"use client";

import * as React from "react";
import {
  Send,
  Search,
  Loader2,
  X,
  Mail,
  AlertCircle,
  Sparkles,
  AtSign,
  Users,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface PrefillCreator {
  id: string;
  handle: string;
  display_name: string | null;
  contact_email: string | null;
  avatar_url?: string | null;
}

interface SelectedCreator {
  id: string;
  handle: string;
  display_name: string | null;
  contact_email: string | null;
  avatar_url: string | null;
}

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
  prefillCreator?: PrefillCreator;
  prefillCampaignId?: string;
}

interface Template {
  id: string;
  name: string;
  category: string | null;
  subject: string | null;
  body: string;
}

interface CampaignCreatorRow {
  id: string; // campaign_creators.id
  status: string;
  creator: SelectedCreator;
}

type ComposeMode = "single" | "bulk";

export function ComposeModal({
  open,
  onOpenChange,
  brand,
  campaigns,
  onSent,
  prefillCreator,
  prefillCampaignId,
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [mode, setMode] = React.useState<ComposeMode>("single");
  const [selectedCreator, setSelectedCreator] =
    React.useState<SelectedCreator | null>(null);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<SelectedCreator[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [campaignId, setCampaignId] = React.useState("none");
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [templateId, setTemplateId] = React.useState("none");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const [error, setError] = React.useState("");

  // Bulk-mode state
  const [campaignCreators, setCampaignCreators] = React.useState<
    CampaignCreatorRow[]
  >([]);
  const [campaignCreatorsLoading, setCampaignCreatorsLoading] =
    React.useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = React.useState<Set<string>>(
    new Set(),
  );

  // Reset on open with prefill values applied; clear on close.
  React.useEffect(() => {
    if (!open) return;
    setError("");
    if (prefillCreator) {
      setSelectedCreator({
        id: prefillCreator.id,
        handle: prefillCreator.handle,
        display_name: prefillCreator.display_name,
        contact_email: prefillCreator.contact_email,
        avatar_url: prefillCreator.avatar_url ?? null,
      });
      setMode("single");
    }
    if (prefillCampaignId) setCampaignId(prefillCampaignId);
  }, [open, prefillCreator, prefillCampaignId]);

  // Bulk mode: load creators on the picked campaign.
  React.useEffect(() => {
    if (mode !== "bulk") return;
    if (campaignId === "none") {
      setCampaignCreators([]);
      return;
    }
    let cancelled = false;
    setCampaignCreatorsLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("campaign_creators")
          .select(
            "id, status, creators!inner (id, handle, display_name, contact_email, avatar_url)",
          )
          .eq("campaign_id", campaignId);
        if (cancelled) return;
        const rows = (data ?? []) as unknown as Array<{
          id: string;
          status: string;
          creators: SelectedCreator;
        }>;
        const mapped: CampaignCreatorRow[] = rows.map((r) => ({
          id: r.id,
          status: r.status,
          creator: r.creators,
        }));
        setCampaignCreators(mapped);
        // Default-select all creators with email and not declined.
        const next = new Set<string>();
        for (const cc of mapped) {
          if (cc.creator.contact_email && cc.status !== "declined") {
            next.add(cc.creator.id);
          }
        }
        setSelectedBulkIds(next);
      } catch (err) {
        console.error("campaign creators fetch:", err);
        if (!cancelled) setCampaignCreators([]);
      } finally {
        if (!cancelled) setCampaignCreatorsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, campaignId, supabase]);

  // Fetch templates once when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/templates");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTemplates((data.templates as Template[]) ?? []);
      } catch (err) {
        console.error("templates fetch:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Real creator search (against `creators` table — not just existing threads).
  // Routed through a server endpoint so it bypasses any browser-side RLS
  // surprises and consistently authenticates.
  React.useEffect(() => {
    if (selectedCreator) return;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/creators/search?q=${encodeURIComponent(q)}&limit=8`,
        );
        if (!res.ok) {
          if (!cancelled) setResults([]);
          return;
        }
        const data = (await res.json()) as { creators: SelectedCreator[] };
        if (cancelled) return;
        setResults(data.creators ?? []);
      } catch (err) {
        console.error("creator search:", err);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, selectedCreator]);

  const applyTemplate = async (id: string) => {
    setTemplateId(id);
    if (id === "none") return;
    const tmpl = templates.find((t) => t.id === id);
    if (!tmpl) return;

    if (selectedCreator) {
      try {
        const res = await fetch(`/api/templates/${id}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creator_id: selectedCreator.id,
            campaign_id: campaignId !== "none" ? campaignId : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSubject(data.subject ?? tmpl.subject ?? "");
          setBody(data.body ?? tmpl.body);
          return;
        }
      } catch (err) {
        console.error("template preview:", err);
      }
    }
    setSubject(tmpl.subject ?? "");
    setBody(tmpl.body);
  };

  const resetForm = () => {
    setSelectedCreator(null);
    setSearch("");
    setResults([]);
    setCampaignId("none");
    setTemplateId("none");
    setSubject("");
    setBody("");
    setError("");
    setSelectedBulkIds(new Set());
    setCampaignCreators([]);
  };

  const eligibleBulkRows = campaignCreators.filter(
    (cc) => cc.creator.contact_email,
  );
  const bulkSelectedCount = selectedBulkIds.size;

  const toggleBulkRow = (creatorId: string) => {
    setSelectedBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });
  };

  const toggleAllBulk = () => {
    if (selectedBulkIds.size === eligibleBulkRows.length) {
      setSelectedBulkIds(new Set());
      return;
    }
    setSelectedBulkIds(new Set(eligibleBulkRows.map((r) => r.creator.id)));
  };

  const handleBulkSend = async () => {
    if (campaignId === "none") {
      setError("Pick a campaign first.");
      return;
    }
    if (selectedBulkIds.size === 0) {
      setError("Select at least one creator.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!body.trim()) {
      setError("Message body is required.");
      return;
    }

    const html = wrapHtml(body);
    const recipients = campaignCreators
      .filter(
        (cc) =>
          selectedBulkIds.has(cc.creator.id) && cc.creator.contact_email,
      )
      .map((cc) => ({
        creator_id: cc.creator.id,
        recipient_email: cc.creator.contact_email!,
        subject,
        body_html: html,
        template_id: templateId !== "none" ? templateId : undefined,
      }));

    if (recipients.length === 0) {
      setError("None of the selected creators have an email on file.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/messages/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, recipients }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Bulk send failed");
      }
      const data = (await res.json()) as {
        summary: {
          total: number;
          sent: number;
          failed: number;
          skipped: number;
          rate_limited: number;
        };
        results?: Array<{
          creator_id: string;
          status: string;
          reason?: string;
        }>;
      };
      const { sent, failed, skipped, rate_limited } = data.summary;
      const parts: string[] = [`Sent ${sent}`];
      if (skipped) parts.push(`skipped ${skipped}`);
      if (failed) parts.push(`failed ${failed}`);
      if (rate_limited) parts.push(`rate-limited ${rate_limited}`);
      const firstFailure = data.results?.find(
        (r) => r.status === "failed" && r.reason,
      );
      const summaryLine = parts.join(" · ");
      if (sent === 0) {
        toast.error(
          firstFailure?.reason
            ? `${summaryLine}. ${firstFailure.reason}`
            : summaryLine,
        );
      } else if (failed > 0 && firstFailure?.reason) {
        toast.success(`${summaryLine}. First failure: ${firstFailure.reason}`);
      } else {
        toast.success(summaryLine);
      }
      resetForm();
      onSent();
    } catch (err) {
      console.error("bulk send:", err);
      setError(err instanceof Error ? err.message : "Bulk send failed");
    } finally {
      setSending(false);
    }
  };

  const ensureValid = (): string | null => {
    if (!selectedCreator) return "Pick a creator first.";
    if (!selectedCreator.contact_email) return "This creator has no email on file.";
    if (!subject.trim()) return "Subject is required.";
    if (!body.trim()) return "Message body is required.";
    return null;
  };

  const wrapHtml = (raw: string): string =>
    raw.includes("<") ? raw : `<p>${raw.replace(/\n/g, "<br/>")}</p>`;

  const handleSend = async () => {
    const validationError = ensureValid();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator_id: selectedCreator!.id,
          campaign_id: campaignId !== "none" ? campaignId : undefined,
          subject,
          body_html: wrapHtml(body),
          template_id: templateId !== "none" ? templateId : undefined,
          recipient_email: selectedCreator!.contact_email,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send");
      }
      toast.success("Email sent");
      resetForm();
      onSent();
    } catch (err) {
      console.error("send:", err);
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedCreator) {
      setError("Pick a creator first.");
      return;
    }
    if (!body.trim()) {
      setError("Add a message before saving.");
      return;
    }
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/messages/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator_id: selectedCreator.id,
          campaign_id: campaignId !== "none" ? campaignId : undefined,
          subject,
          body_html: wrapHtml(body),
          template_id: templateId !== "none" ? templateId : undefined,
          recipient_email: selectedCreator.contact_email,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save draft");
      }
      toast.success("Draft saved");
      resetForm();
      onSent();
    } catch (err) {
      console.error("draft:", err);
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setDrafting(false);
    }
  };

  const initials = (s: SelectedCreator) =>
    (s.display_name ?? s.handle).slice(0, 2).toUpperCase();

  const senderLine =
    brand.email_sender_name || brand.brand_name || "You";
  const senderEmail = brand.gmail_email ?? "Gmail not connected";
  const gmailReady = !!brand.gmail_email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-[640px]">
        <DialogHeader className="flex-col gap-3 border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-md"
              style={{ background: "var(--gradient-canva)" }}
            >
              <Mail className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-base font-extrabold leading-tight text-foreground">
                New outreach
              </DialogTitle>
              <p className="truncate text-xs text-muted-foreground">
                Sent from <b className="text-foreground">{senderLine}</b>{" "}
                · <span className="font-mono">{senderEmail}</span>
              </p>
            </div>
          </div>
          <div
            role="tablist"
            aria-label="Compose mode"
            className="inline-flex self-start overflow-hidden rounded-xl border border-border bg-muted/40"
          >
            <ModeTab
              active={mode === "single"}
              onClick={() => setMode("single")}
              icon={<User className="size-3.5" />}
              label="One creator"
            />
            <ModeTab
              active={mode === "bulk"}
              onClick={() => {
                setMode("bulk");
                setSelectedCreator(null);
              }}
              icon={<Users className="size-3.5" />}
              label="Multiple (campaign)"
            />
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-5">
          {/* TO — creator picker (single) or multi-select (bulk) */}
          {mode === "single" ? (
            <Field label="To">
              {selectedCreator ? (
                <SelectedCreatorPill
                  creator={selectedCreator}
                  initials={initials(selectedCreator)}
                  onClear={() => setSelectedCreator(null)}
                />
              ) : (
                <CreatorSearch
                  value={search}
                  onChange={setSearch}
                  results={results}
                  searching={searching}
                  onPick={(c) => {
                    setSelectedCreator(c);
                    setSearch("");
                    setResults([]);
                  }}
                />
              )}
              {selectedCreator && !selectedCreator.contact_email && (
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  <AlertCircle className="size-3.5 shrink-0" />
                  We don&apos;t have an email for @{selectedCreator.handle}.
                  Save as draft and message via DM, or update the creator&apos;s
                  contact email first.
                </div>
              )}
            </Field>
          ) : (
            <Field
              label={
                campaignId === "none"
                  ? "To"
                  : `To · ${bulkSelectedCount} of ${eligibleBulkRows.length} selected`
              }
            >
              <BulkRecipientList
                campaignPicked={campaignId !== "none"}
                loading={campaignCreatorsLoading}
                rows={campaignCreators}
                selectedIds={selectedBulkIds}
                onToggleRow={toggleBulkRow}
                onToggleAll={toggleAllBulk}
              />
            </Field>
          )}

          {/* Toolbar — campaign + template */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Campaign (optional)">
              <Select
                value={campaignId}
                onValueChange={(v) => setCampaignId(v ?? "none")}
              >
                <SelectTrigger className="h-9 w-full min-w-0 rounded-xl">
                  <SelectValue placeholder="None">
                    {(v) => {
                      if (v == null || v === "none") return "None";
                      return campaigns.find((c) => c.id === v)?.name ?? "None";
                    }}
                  </SelectValue>
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
            </Field>
            <Field label="Template">
              <Select
                value={templateId}
                onValueChange={(v) => applyTemplate(v ?? "none")}
              >
                <SelectTrigger className="h-9 w-full min-w-0 rounded-xl">
                  <SelectValue placeholder="No template">
                    {(v) => {
                      if (v == null || v === "none") return "No template";
                      const t = templates.find((tmpl) => tmpl.id === v);
                      if (!t) return "No template";
                      return t.category ? `${t.name} · ${t.category}` : t.name;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.category ? ` · ${t.category}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* SUBJECT */}
          <Field label="Subject">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this email about?"
              className="h-10 rounded-xl"
            />
          </Field>

          {/* BODY */}
          <Field label="Message">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              className="min-h-[200px] w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-canva-purple focus:outline-none focus:ring-2 focus:ring-canva-purple/20"
            />
            {templates.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Tip: pick a template above to auto-fill subject + body with
                merge fields resolved for{" "}
                {selectedCreator
                  ? `@${selectedCreator.handle}`
                  : "the chosen creator"}
                .
              </p>
            )}
          </Field>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              {error}
            </div>
          )}

          {!gmailReady && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <Sparkles className="size-3.5 shrink-0" />
              Connect Gmail in Settings to send. You can still save drafts
              meanwhile.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-muted/40 px-6 py-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={sending || drafting}
          >
            Cancel
          </Button>
          {mode === "single" && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={sending || drafting || !selectedCreator}
            >
              {drafting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Save as draft
            </Button>
          )}
          {mode === "single" ? (
            <Button
              onClick={handleSend}
              disabled={sending || drafting || !gmailReady}
              className="text-white shadow-md hover:opacity-95"
              style={{ background: "var(--gradient-canva)" }}
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Send
            </Button>
          ) : (
            <Button
              onClick={handleBulkSend}
              disabled={
                sending ||
                !gmailReady ||
                campaignId === "none" ||
                bulkSelectedCount === 0
              }
              className="text-white shadow-md hover:opacity-95"
              style={{ background: "var(--gradient-canva)" }}
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Send to {bulkSelectedCount}{" "}
              {bulkSelectedCount === 1 ? "creator" : "creators"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors",
        active
          ? "text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      style={active ? { background: "var(--gradient-canva)" } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

function BulkRecipientList({
  campaignPicked,
  loading,
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
}: {
  campaignPicked: boolean;
  loading: boolean;
  rows: CampaignCreatorRow[];
  selectedIds: Set<string>;
  onToggleRow: (creatorId: string) => void;
  onToggleAll: () => void;
}) {
  if (!campaignPicked) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-canva-purple/30 bg-canva-purple-soft px-3 py-3 text-xs text-canva-purple">
        <Sparkles className="size-3.5 shrink-0" />
        Pick a campaign below — we&apos;ll list its creators here so you can
        choose who to message.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-6 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading creators…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
        No creators on this campaign yet.
      </div>
    );
  }
  const eligible = rows.filter((r) => r.creator.contact_email);
  const allSelected =
    eligible.length > 0 && selectedIds.size === eligible.length;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleAll}
          disabled={eligible.length === 0}
          aria-label="Select all"
        />
        <span className="flex-1">
          {allSelected ? "All selected" : "Select all with email"}
        </span>
        <span className="text-muted-foreground/70">
          {selectedIds.size}/{eligible.length}
        </span>
      </div>
      <ul className="max-h-[260px] overflow-y-auto">
        {rows.map((cc) => {
          const c = cc.creator;
          const hasEmail = !!c.contact_email;
          const checked = selectedIds.has(c.id);
          return (
            <li
              key={cc.id}
              className={cn(
                "flex items-center gap-2.5 border-b border-border/60 px-3 py-2 text-sm transition-colors last:border-b-0",
                hasEmail
                  ? "cursor-pointer hover:bg-canva-purple-soft"
                  : "cursor-not-allowed opacity-60",
              )}
              onClick={() => hasEmail && onToggleRow(c.id)}
            >
              <Checkbox
                checked={checked}
                disabled={!hasEmail}
                onCheckedChange={() => hasEmail && onToggleRow(c.id)}
                aria-label={`Select @${c.handle}`}
                onClick={(e) => e.stopPropagation()}
              />
              <Avatar className="size-7 shrink-0">
                {c.avatar_url && <AvatarImage src={c.avatar_url} alt={c.handle} />}
                <AvatarFallback className="bg-canva-purple-soft text-[10px] text-canva-purple">
                  {(c.display_name ?? c.handle).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-foreground">
                  {c.display_name ?? c.handle}
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-handle shrink-0">@{c.handle}</span>
                  {hasEmail ? (
                    <>
                      <span className="shrink-0 text-muted-foreground/50">
                        ·
                      </span>
                      <span className="truncate">{c.contact_email}</span>
                    </>
                  ) : (
                    <span className="shrink-0 text-warning">no email</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold capitalize text-muted-foreground">
                {cc.status.replace(/_/g, " ")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SelectedCreatorPill({
  creator,
  initials,
  onClear,
}: {
  creator: SelectedCreator;
  initials: string;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <Avatar className="size-9 shrink-0">
        {creator.avatar_url && (
          <AvatarImage src={creator.avatar_url} alt={creator.handle} />
        )}
        <AvatarFallback className="bg-canva-purple-soft text-canva-purple">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate font-heading text-sm font-extrabold text-foreground">
          {creator.display_name ?? creator.handle}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-handle shrink-0">@{creator.handle}</span>
          <span className="shrink-0 text-muted-foreground/50">·</span>
          <span className="inline-flex min-w-0 flex-1 items-center gap-1">
            <AtSign className="size-3 shrink-0" />
            <span className="truncate">
              {creator.contact_email ?? "no email on file"}
            </span>
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Change creator"
        className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function CreatorSearch({
  value,
  onChange,
  results,
  searching,
  onPick,
}: {
  value: string;
  onChange: (next: string) => void;
  results: SelectedCreator[];
  searching: boolean;
  onPick: (c: SelectedCreator) => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search creators by handle or name..."
        className="h-10 rounded-xl pl-9"
        autoFocus
      />
      {value.trim().length >= 2 && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
          {searching ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">
              No creators match &ldquo;{value.trim()}&rdquo;
            </div>
          ) : (
            <ul className="max-h-[280px] overflow-y-auto py-1">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-canva-purple-soft",
                    )}
                  >
                    <Avatar className="size-8 shrink-0">
                      {c.avatar_url && (
                        <AvatarImage src={c.avatar_url} alt={c.handle} />
                      )}
                      <AvatarFallback className="bg-canva-purple-soft text-[10px] text-canva-purple">
                        {(c.display_name ?? c.handle).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-foreground">
                        {c.display_name ?? c.handle}
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="font-handle shrink-0">@{c.handle}</span>
                        {c.contact_email && (
                          <>
                            <span className="shrink-0 text-muted-foreground/50">
                              ·
                            </span>
                            <span className="truncate">{c.contact_email}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!c.contact_email && (
                      <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                        no email
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
