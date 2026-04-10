"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  RotateCcw,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Plus,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ContentSubmission {
  id: string;
  campaign_id: string;
  campaign_creator_id: string;
  creator_id: string;
  submission_type: string;
  content_url: string | null;
  caption_text: string | null;
  compliance_check: {
    has_ad_disclosure?: boolean;
    has_brand_tag?: boolean;
    has_discount_code?: boolean | null;
  } | null;
  status: string;
  feedback: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

interface SubmissionLink {
  campaign_creator_id: string;
  creator_id: string;
  has_token: boolean;
  submission_url: string | null;
  expires_at: string | null;
}

interface ContentTabProps {
  campaignId: string;
  creators: Array<{
    id: string;
    creator_id: string;
    creator: { handle: string; display_name: string | null };
    content_status?: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_COLUMNS = [
  { key: "brief_sent", label: "Brief Sent" },
  { key: "in_progress", label: "In Progress" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "live", label: "Live" },
] as const;

function statusColor(status: string): string {
  const map: Record<string, string> = {
    submitted: "bg-info/10 text-info",
    approved: "badge-active",
    revision_requested: "bg-warning/10 text-warning",
    rejected: "bg-destructive/10 text-destructive",
    brief_sent: "bg-muted text-muted-foreground",
    in_progress: "bg-primary/10 text-primary",
    live: "badge-active",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ContentTab({ campaignId, creators }: ContentTabProps) {
  const [submissions, setSubmissions] = useState<ContentSubmission[]>([]);
  const [submissionLinks, setSubmissionLinks] = useState<SubmissionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingLinks, setGeneratingLinks] = useState(false);

  // Manual add state
  const [addingForCreatorId, setAddingForCreatorId] = useState<string | null>(
    null
  );
  const [manualUrl, setManualUrl] = useState("");
  const [manualCaption, setManualCaption] = useState("");
  const [manualType, setManualType] = useState<"draft" | "final">("final");
  const [submittingManual, setSubmittingManual] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/content`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const fetchSubmissionLinks = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/submission-links`
      );
      if (res.ok) {
        const data = await res.json();
        setSubmissionLinks(data.links ?? []);
      }
    } catch {
      // Silently fail
    }
  }, [campaignId]);

  useEffect(() => {
    fetchSubmissions();
    fetchSubmissionLinks();
  }, [fetchSubmissions, fetchSubmissionLinks]);

  const handleGenerateLinks = useCallback(async () => {
    setGeneratingLinks(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/submission-links`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        setSubmissionLinks(data.links ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setGeneratingLinks(false);
    }
  }, [campaignId]);

  const handleReview = useCallback(
    async (submissionId: string, action: string) => {
      setSubmittingReview(true);
      try {
        const res = await fetch(
          `/api/content-submissions/${submissionId}/review`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              feedback: reviewFeedback.trim() || null,
            }),
          }
        );
        if (res.ok) {
          await fetchSubmissions();
          setReviewingId(null);
          setReviewFeedback("");
        }
      } catch {
        // Silently fail
      } finally {
        setSubmittingReview(false);
      }
    },
    [reviewFeedback, fetchSubmissions]
  );

  const handleManualSubmit = useCallback(
    async (campaignCreatorId: string) => {
      if (!manualUrl && !manualCaption) return;
      setSubmittingManual(true);
      try {
        const res = await fetch("/api/content-submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignCreatorId,
            contentUrl: manualUrl.trim() || null,
            captionText: manualCaption.trim() || null,
            submissionType: manualType,
          }),
        });
        if (res.ok) {
          await fetchSubmissions();
          setAddingForCreatorId(null);
          setManualUrl("");
          setManualCaption("");
          setManualType("final");
        }
      } catch {
        // Silently fail
      } finally {
        setSubmittingManual(false);
      }
    },
    [manualUrl, manualCaption, manualType, fetchSubmissions]
  );

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading content...
        </div>
      </div>
    );
  }

  // Build kanban data — count all submissions per creator
  const kanbanData = STATUS_COLUMNS.map((col) => {
    const items = creators
      .filter((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentStatus = (c as any).content_status ?? "brief_pending";
        return contentStatus === col.key;
      })
      .map((c) => {
        const creatorSubs = submissions.filter(
          (s) => s.campaign_creator_id === c.id
        );
        return { ...c, submissions: creatorSubs };
      });
    return { ...col, items };
  });

  // Check if any links exist
  const hasLinks = submissionLinks.some((l) => l.has_token);

  return (
    <div className="space-y-6">
      {/* ── Submission Links Section ── */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Influencer Submission Links
            </h3>
            <Button
              size="sm"
              onClick={handleGenerateLinks}
              disabled={generatingLinks}
            >
              {generatingLinks ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <Link2 className="size-3.5 mr-1" />
              )}
              {hasLinks ? "Regenerate Links" : "Generate Links"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Generate unique submission links for each influencer. They can
            submit multiple videos through the same link.
          </p>
          {hasLinks && (
            <div className="space-y-2">
              {creators.map((c) => {
                const link = submissionLinks.find(
                  (l) => l.campaign_creator_id === c.id
                );
                if (!link?.submission_url) return null;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        @{c.creator.handle}
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {link.submission_url}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        copyToClipboard(link.submission_url!, c.id)
                      }
                    >
                      {copiedId === c.id ? (
                        <Check className="size-3 text-success" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Kanban View ── */}
      <div className="grid grid-cols-5 gap-3">
        {kanbanData.map((col) => (
          <div key={col.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {col.label}
              </h4>
              <Badge variant="secondary" className="text-[10px]">
                {col.items.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {col.items.map((item) => (
                <Card
                  key={item.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-3 space-y-1">
                    <p className="font-handle text-xs">
                      @{item.creator.handle}
                    </p>
                    {item.submissions.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[9px]",
                            statusColor(item.submissions[0].status)
                          )}
                        >
                          {item.submissions[0].status.replace("_", " ")}
                        </Badge>
                        {item.submissions.length > 1 && (
                          <Badge
                            variant="secondary"
                            className="text-[9px]"
                          >
                            {item.submissions.length} videos
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {col.items.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-[10px] text-muted-foreground">Empty</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── All Submissions List ── */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              All Submissions
              {submissions.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({submissions.length})
                </span>
              )}
            </h3>
          </div>

          {/* Per-creator grouped submissions + manual add */}
          {creators.map((c) => {
            const creatorSubs = submissions.filter(
              (s) => s.campaign_creator_id === c.id
            );
            const isAdding = addingForCreatorId === c.id;

            return (
              <div key={c.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-handle text-sm">
                    @{c.creator.handle}
                  </span>
                  <div className="flex items-center gap-2">
                    {creatorSubs.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {creatorSubs.length} submission
                        {creatorSubs.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setAddingForCreatorId(isAdding ? null : c.id);
                        setManualUrl("");
                        setManualCaption("");
                      }}
                    >
                      <Plus className="size-3 mr-1" />
                      Add Content
                    </Button>
                  </div>
                </div>

                {/* Manual add form */}
                {isAdding && (
                  <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium">
                      Manually add content URL
                    </p>
                    <input
                      type="url"
                      placeholder="https://instagram.com/reel/..."
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      className="w-full rounded border bg-background px-2 py-1.5 text-xs"
                    />
                    <textarea
                      placeholder="Caption text (optional)..."
                      value={manualCaption}
                      onChange={(e) => setManualCaption(e.target.value)}
                      rows={2}
                      className="w-full rounded border bg-background px-2 py-1.5 text-xs resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name={`manual-type-${c.id}`}
                          checked={manualType === "draft"}
                          onChange={() => setManualType("draft")}
                          className="accent-primary"
                        />
                        Draft
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name={`manual-type-${c.id}`}
                          checked={manualType === "final"}
                          onChange={() => setManualType("final")}
                          className="accent-primary"
                        />
                        Final
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={
                          submittingManual || (!manualUrl && !manualCaption)
                        }
                        onClick={() => handleManualSubmit(c.id)}
                      >
                        {submittingManual && (
                          <Loader2 className="size-3 animate-spin mr-1" />
                        )}
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setAddingForCreatorId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Existing submissions */}
                {creatorSubs.map((sub) => {
                  const isReviewing = reviewingId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      className="rounded border bg-background p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="size-3.5 text-muted-foreground" />
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px]",
                              statusColor(sub.status)
                            )}
                          >
                            {sub.status.replace("_", " ")}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {sub.submission_type}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(sub.submitted_at).toLocaleDateString(
                              "en-IN",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        </div>
                        {sub.content_url && (
                          <a
                            href={sub.content_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-info hover:text-info/80"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Caption preview */}
                      {sub.caption_text && (
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {sub.caption_text}
                        </p>
                      )}

                      {/* Compliance checks */}
                      {sub.compliance_check && (
                        <div className="flex flex-wrap gap-2">
                          <ComplianceBadge
                            label="#ad"
                            ok={sub.compliance_check.has_ad_disclosure}
                          />
                          <ComplianceBadge
                            label="Brand tag"
                            ok={sub.compliance_check.has_brand_tag}
                          />
                          {sub.compliance_check.has_discount_code !== null && (
                            <ComplianceBadge
                              label="Discount code"
                              ok={sub.compliance_check.has_discount_code}
                            />
                          )}
                        </div>
                      )}

                      {/* Review actions */}
                      {sub.status === "submitted" && (
                        <div className="pt-1">
                          {isReviewing ? (
                            <div className="space-y-2">
                              <textarea
                                placeholder="Feedback (optional)..."
                                value={reviewFeedback}
                                onChange={(e) =>
                                  setReviewFeedback(e.target.value)
                                }
                                rows={2}
                                className="w-full rounded border bg-background px-2 py-1 text-xs resize-none"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    handleReview(sub.id, "approve")
                                  }
                                  disabled={submittingReview}
                                >
                                  {submittingReview ? (
                                    <Loader2 className="size-3 animate-spin mr-1" />
                                  ) : (
                                    <CheckCircle className="size-3 mr-1" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    handleReview(
                                      sub.id,
                                      "revision_requested"
                                    )
                                  }
                                  disabled={submittingReview}
                                >
                                  <RotateCcw className="size-3 mr-1" />
                                  Request Revision
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-destructive"
                                  onClick={() =>
                                    handleReview(sub.id, "reject")
                                  }
                                  disabled={submittingReview}
                                >
                                  <XCircle className="size-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setReviewingId(sub.id)}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Feedback display */}
                      {sub.feedback && sub.status !== "submitted" && (
                        <p className="text-xs text-muted-foreground italic">
                          Feedback: {sub.feedback}
                        </p>
                      )}
                    </div>
                  );
                })}

                {creatorSubs.length === 0 && !isAdding && (
                  <p className="text-[10px] text-muted-foreground italic">
                    No content submitted yet
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceBadge({
  label,
  ok,
}: {
  label: string;
  ok?: boolean | null;
}) {
  if (ok === null || ok === undefined) return null;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[9px]",
        ok
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {ok ? "\u2713" : "\u2717"} {label}
    </Badge>
  );
}
