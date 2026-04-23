"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Loader2,
  Copy,
  Check,
  Plus,
  Link2,
  Film,
  Video,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalysisStatusBadge } from "./content-analysis/analysis-status-badge";
import { AnalysisScoreRing } from "./content-analysis/analysis-score-ring";
import { AnalysisDetailPanel } from "./content-analysis/analysis-detail-panel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ContentAnalysisSummary {
  status: string;
  overall_score: number | null;
  hook_strength_score: number | null;
  brand_mention_score: number | null;
  brief_compliance_score: number | null;
  guideline_compliance_score: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: Record<string, any> | null;
}

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
  analysis_status?: string;
  content_analyses?: ContentAnalysisSummary | null;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingLinks, setGeneratingLinks] = useState(false);

  // Analysis detail panel state
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [selectedCreatorHandle, setSelectedCreatorHandle] = useState<string>("");
  const [selectedSubStatus, setSelectedSubStatus] = useState<string>("");

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
    async (submissionId: string, action: string, feedback?: string) => {
      try {
        const res = await fetch(
          `/api/content-submissions/${submissionId}/review`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              feedback: feedback?.trim() || null,
            }),
          }
        );
        if (res.ok) {
          await fetchSubmissions();
        }
      } catch {
        // Silently fail
      }
    },
    [fetchSubmissions]
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
                  <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/30" onClick={(e) => e.stopPropagation()}>
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

                {/* Submission tile grid */}
                {creatorSubs.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {creatorSubs.map((sub) => (
                      <SubmissionTile
                        key={sub.id}
                        submission={sub}
                        onOpen={() => {
                          setSelectedSubmissionId(sub.id);
                          setSelectedCreatorHandle(c.creator.handle);
                          setSelectedSubStatus(sub.status);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  !isAdding && (
                    <p className="text-[10px] text-muted-foreground italic">
                      No content submitted yet
                    </p>
                  )
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Analysis Detail Panel ── */}
      <AnalysisDetailPanel
        submissionId={selectedSubmissionId}
        open={selectedSubmissionId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSubmissionId(null);
        }}
        creatorHandle={selectedCreatorHandle}
        submissionStatus={selectedSubStatus}
        onReview={async (action, feedback) => {
          if (selectedSubmissionId) {
            await handleReview(selectedSubmissionId, action, feedback);
            setSelectedSubmissionId(null);
          }
        }}
      />
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Submission tile (Instagram-style thumbnail)                        */
/* ------------------------------------------------------------------ */

function SubmissionTypeGlyph({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const t = type.toLowerCase();
  if (t.includes("reel") || t.includes("video"))
    return <Video className={className} />;
  if (t.includes("story")) return <Film className={className} />;
  if (t.includes("post") || t.includes("image"))
    return <ImageIcon className={className} />;
  return <FileText className={className} />;
}

function SubmissionTile({
  submission,
  onOpen,
}: {
  submission: ContentSubmission;
  onOpen: () => void;
}) {
  const analysisData = submission.content_analyses;
  const analysisStatus = analysisData?.status ?? submission.analysis_status;
  const statusLabel = submission.status.replace(/_/g, " ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group/tile relative block aspect-[4/5] w-full overflow-hidden rounded-lg border bg-muted text-left",
        "transition-all hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--muted) 0 4px, var(--card) 4px 10px)",
        }}
      >
        <SubmissionTypeGlyph
          type={submission.submission_type}
          className="size-7"
        />
        <span className="text-[10px] uppercase tracking-wider">
          {submission.submission_type}
        </span>
      </div>

      <div className="absolute left-1.5 top-1.5 z-10">
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-1.5 py-0.5 shadow-sm",
            statusColor(submission.status),
          )}
        >
          {statusLabel}
        </Badge>
      </div>

      {analysisStatus === "completed" &&
        analysisData?.overall_score != null && (
          <div className="absolute right-1.5 top-1.5 z-10">
            <AnalysisScoreRing
              score={analysisData.overall_score}
              size="sm"
            />
          </div>
        )}

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2">
        {submission.caption_text ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-white/90">
            {submission.caption_text}
          </p>
        ) : (
          <p className="text-[10px] italic text-white/60">No caption</p>
        )}
        {submission.compliance_check && (
          <div className="mt-1 flex items-center gap-1 text-[9px]">
            {submission.compliance_check.has_ad_disclosure != null && (
              <ComplianceDot
                ok={submission.compliance_check.has_ad_disclosure}
                label="#ad"
              />
            )}
            {submission.compliance_check.has_brand_tag != null && (
              <ComplianceDot
                ok={submission.compliance_check.has_brand_tag}
                label="tag"
              />
            )}
            {submission.compliance_check.has_discount_code != null && (
              <ComplianceDot
                ok={submission.compliance_check.has_discount_code}
                label="code"
              />
            )}
          </div>
        )}
      </div>

      {analysisStatus && analysisStatus !== "completed" && (
        <div className="absolute bottom-1.5 right-1.5 z-10">
          <AnalysisStatusBadge status={analysisStatus} />
        </div>
      )}
    </button>
  );
}

function ComplianceDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
        ok
          ? "bg-success/20 text-success"
          : "bg-destructive/20 text-destructive",
      )}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}
