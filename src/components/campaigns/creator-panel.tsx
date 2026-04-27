"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Copy,
  Check,
  Mail,
  ExternalLink,
  Send,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Loader2,
  Sparkles,
  CircleDot,
  CircleAlert,
  CircleCheck,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { formatFollowers, formatCurrency } from "@/lib/format";
import {
  updateCampaignCreatorStatus,
  type CampaignCreatorWithDetails,
} from "@/lib/queries/campaigns";
import type { CampaignUtmLink } from "@/lib/types/database";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CreatorStatusDropdown } from "@/components/campaigns/creator-status-dropdown";
import { InlineRateEditor } from "@/components/campaigns/inline-rate-editor";
import { BarterOrderForm } from "@/components/campaigns/barter-order-form";

const CONFIRMED_LIKE_STATUSES = ["confirmed", "content_live", "completed"];

interface ContentSubmissionRow {
  id: string;
  content_url: string | null;
  caption_text: string | null;
  status: string;
  feedback: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

interface ComplianceScanRow {
  id: string;
  has_ad_disclosure: boolean | null;
  has_brand_mention: boolean | null;
  has_product_visibility: boolean | null;
  has_discount_code: boolean | null;
  has_spoken_brand_mention: boolean | null;
  overall_pass: boolean;
  issues_found: string[];
  revision_draft: string | null;
  scanned_at: string;
}

interface MessageThreadPreviewRow {
  id: string;
  subject: string | null;
  outreach_status: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
}

interface LivePostMetrics {
  platform: "instagram" | "youtube";
  url: string | null;
  thumbnail: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  engagement_rate: number | null;
  posted_at: string | null;
}

interface BarterOrderRow {
  id: string;
  product_title: string | null;
  status: string | null;
  retail_value: number | null;
  shopify_draft_order_id: string | null;
  created_at: string;
}

interface SubmissionLinkInfo {
  submission_url: string | null;
  expires_at: string | null;
}

interface CreatorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  campaignCurrency: string;
  brandId: string;
  cc: CampaignCreatorWithDetails | null;
  onUpdated: (next: CampaignCreatorWithDetails) => void;
}

export function CreatorPanel({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  campaignCurrency,
  brandId,
  cc,
  onUpdated,
}: CreatorPanelProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const [submission, setSubmission] = React.useState<ContentSubmissionRow | null>(null);
  const [scan, setScan] = React.useState<ComplianceScanRow | null>(null);
  const [thread, setThread] = React.useState<MessageThreadPreviewRow | null>(null);
  const [trackingLink, setTrackingLink] = React.useState<CampaignUtmLink | null>(null);
  const [submissionLink, setSubmissionLink] =
    React.useState<SubmissionLinkInfo | null>(null);
  const [submissionLinkLoading, setSubmissionLinkLoading] = React.useState(false);
  const [submissionCopied, setSubmissionCopied] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [reviewBusy, setReviewBusy] = React.useState<null | "approve" | "reject" | "revision_requested">(null);
  const [feedbackDraft, setFeedbackDraft] = React.useState("");
  const [showRevisionForm, setShowRevisionForm] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [barterOrders, setBarterOrders] = React.useState<BarterOrderRow[]>([]);
  const [showBarterForm, setShowBarterForm] = React.useState(false);
  const [barterFormKey, setBarterFormKey] = React.useState(0);
  const [livePost, setLivePost] = React.useState<LivePostMetrics | null>(null);

  const creatorId = cc?.creator_id;
  const creator = cc?.creator;

  // Fetch panel data when the sheet opens for a creator.
  React.useEffect(() => {
    if (!open || !cc || !creatorId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSubmission(null);
      setScan(null);
      setThread(null);
      setTrackingLink(null);
      setSubmissionLink(null);
      setSubmissionCopied(false);
      setShowRevisionForm(false);
      setFeedbackDraft("");
      setBarterOrders([]);
      setShowBarterForm(false);
      setLivePost(null);

      const [subRes, threadRes, linkRes, ccTokenRes] = await Promise.all([
        supabase
          .from("content_submissions")
          .select("id, content_url, caption_text, status, feedback, submitted_at, reviewed_at")
          .eq("campaign_id", campaignId)
          .eq("creator_id", creatorId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("message_threads")
          .select(
            "id, subject, outreach_status, last_message_at, last_message_preview",
          )
          .eq("creator_id", creatorId)
          .eq("campaign_id", campaignId)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("campaign_utm_links")
          .select("*")
          .eq("campaign_id", campaignId)
          .eq("creator_id", creatorId)
          .maybeSingle(),
        supabase
          .from("campaign_creators")
          .select("id, submission_token, submission_token_expires_at")
          .eq("id", cc.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      const subRow = subRes.data as ContentSubmissionRow | null;
      setSubmission(subRow);
      setThread(threadRes.data as MessageThreadPreviewRow | null);
      setTrackingLink(linkRes.data as CampaignUtmLink | null);

      const tokenRow = ccTokenRes.data as
        | { id: string; submission_token: string | null; submission_token_expires_at: string | null }
        | null;
      if (tokenRow?.submission_token) {
        const base =
          typeof window !== "undefined" ? window.location.origin : "";
        setSubmissionLink({
          submission_url: `${base}/submit/${tokenRow.id}/${tokenRow.submission_token}`,
          expires_at: tokenRow.submission_token_expires_at,
        });
      }

      if (subRow?.id) {
        const { data: scanRow } = await supabase
          .from("compliance_scans")
          .select(
            "id, has_ad_disclosure, has_brand_mention, has_product_visibility, has_discount_code, has_spoken_brand_mention, overall_pass, issues_found, revision_draft, scanned_at",
          )
          .eq("content_submission_id", subRow.id)
          .order("scanned_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) setScan(scanRow as ComplianceScanRow | null);
      }

      // Live post metrics — match the submission URL against creator posts/videos.
      const isLiveStatus =
        cc.status === "content_live" || cc.status === "completed";
      if (isLiveStatus && subRow?.content_url) {
        const url = subRow.content_url;
        const igMatch = url.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/);
        const ytMatch = url.match(
          /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]+)/,
        );

        if (igMatch) {
          const shortcode = igMatch[1];
          const { data: postRow } = await supabase
            .from("posts")
            .select(
              "url, shortcode, likes, num_comments, video_view_count, video_play_count, thumbnail_url, date_posted, engagement_rate",
            )
            .eq("creator_id", creatorId)
            .eq("shortcode", shortcode)
            .maybeSingle();
          if (!cancelled && postRow) {
            const r = postRow as {
              url: string | null;
              likes: number | null;
              num_comments: number | null;
              video_view_count: number | null;
              video_play_count: number | null;
              thumbnail_url: string | null;
              date_posted: string | null;
              engagement_rate: number | null;
            };
            setLivePost({
              platform: "instagram",
              url: r.url,
              thumbnail: r.thumbnail_url,
              views: r.video_view_count ?? r.video_play_count ?? null,
              likes: r.likes,
              comments: r.num_comments,
              engagement_rate: r.engagement_rate,
              posted_at: r.date_posted,
            });
          }
        } else if (ytMatch) {
          const videoId = ytMatch[1];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: ytRow } = await (supabase as any)
            .from("youtube_videos")
            .select(
              "url, video_id, view_count, like_count, comment_count, thumbnail_url, published_at",
            )
            .eq("creator_id", creatorId)
            .eq("video_id", videoId)
            .maybeSingle();
          if (!cancelled && ytRow) {
            const r = ytRow as {
              url: string | null;
              view_count: number | null;
              like_count: number | null;
              comment_count: number | null;
              thumbnail_url: string | null;
              published_at: string | null;
            };
            const eng =
              r.view_count && r.view_count > 0
                ? ((r.like_count ?? 0) + (r.comment_count ?? 0)) /
                  r.view_count
                : null;
            setLivePost({
              platform: "youtube",
              url: r.url,
              thumbnail: r.thumbnail_url,
              views: r.view_count,
              likes: r.like_count,
              comments: r.comment_count,
              engagement_rate: eng,
              posted_at: r.published_at,
            });
          }
        }
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cc, creatorId, campaignId, supabase]);

  // Fetch barter orders for this creator on this campaign.
  const fetchBarterOrders = React.useCallback(async () => {
    if (!cc) return;
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/gifting`);
      if (!res.ok) return;
      const data = (await res.json()) as { gifts?: Array<BarterOrderRow & { campaign_creator_id?: string; creator_id?: string }> };
      const all = data.gifts ?? [];
      const mine = all.filter(
        (g) => g.campaign_creator_id === cc.id || g.creator_id === cc.creator_id,
      );
      setBarterOrders(mine);
    } catch (err) {
      console.error("fetch barter orders:", err);
    }
  }, [cc, campaignId]);

  React.useEffect(() => {
    if (!open || !cc) return;
    fetchBarterOrders();
  }, [open, cc, fetchBarterOrders]);

  // Auto-create the tracking link when status is confirmed-or-later.
  const isConfirmedLike = cc ? CONFIRMED_LIKE_STATUSES.includes(cc.status) : false;
  React.useEffect(() => {
    if (!open || !cc || !isConfirmedLike || trackingLink) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/campaigns/${campaignId}/creators/${cc.creator_id}/tracking-link`,
          { method: "POST" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { link?: CampaignUtmLink };
        if (!cancelled && data.link) setTrackingLink(data.link);
      } catch (err) {
        console.error("auto tracking-link:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cc, isConfirmedLike, trackingLink, campaignId]);

  const handleStatusChange = (next: string) => {
    if (!cc) return;
    onUpdated({ ...cc, status: next });
  };

  const handleSaveRate = async (raw: string) => {
    if (!cc) return;
    const rate = raw.trim() === "" ? null : parseFloat(raw);
    if (raw.trim() !== "" && (Number.isNaN(rate!) || (rate ?? 0) < 0)) return;
    try {
      await updateCampaignCreatorStatus(supabase, cc.id, cc.status, rate);
      onUpdated({ ...cc, agreed_rate: rate });
    } catch (err) {
      console.error("rate save:", err);
      toast.error("Failed to save rate");
    }
  };

  const reviewSubmission = async (
    action: "approve" | "reject" | "revision_requested",
    feedback?: string,
  ) => {
    if (!submission || !cc) return;
    setReviewBusy(action);
    try {
      const res = await fetch(`/api/content-submissions/${submission.id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback: feedback ?? null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Review failed");
      }
      const newStatus =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "revision_requested";
      setSubmission({ ...submission, status: newStatus, feedback: feedback ?? null, reviewed_at: new Date().toISOString() });
      toast.success(
        action === "approve"
          ? "Approved"
          : action === "reject"
            ? "Rejected"
            : "Revision requested",
      );

      // For revision_requested, also queue a draft message to the creator with the feedback.
      if (action === "revision_requested" && feedback?.trim()) {
        try {
          const messageRes = await fetch("/api/messages/compose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              creator_id: cc.creator_id,
              campaign_id: campaignId,
              subject: `Revision requested · ${campaignName}`,
              body_html: feedback.replace(/\n/g, "<br/>"),
            }),
          });
          if (messageRes.ok) {
            toast.message("Draft message queued in Outreach");
          }
        } catch (err) {
          console.error("queue revision message:", err);
        }
        setShowRevisionForm(false);
        setFeedbackDraft("");
      }
    } catch (err) {
      console.error("review submission:", err);
      toast.error(err instanceof Error ? err.message : "Review failed");
    } finally {
      setReviewBusy(null);
    }
  };

  const copyTrackingLink = async () => {
    if (!trackingLink?.full_url) return;
    await navigator.clipboard.writeText(trackingLink.full_url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  const ensureSubmissionLink = async () => {
    if (!cc) return;
    setSubmissionLinkLoading(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/creators/${cc.creator_id}/submission-link`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { link?: SubmissionLinkInfo };
      if (data.link) setSubmissionLink(data.link);
    } catch (err) {
      console.error("submission-link:", err);
      toast.error("Couldn't create submission link");
    } finally {
      setSubmissionLinkLoading(false);
    }
  };

  const copySubmissionLink = async () => {
    if (!submissionLink?.submission_url) return;
    await navigator.clipboard.writeText(submissionLink.submission_url);
    setSubmissionCopied(true);
    setTimeout(() => setSubmissionCopied(false), 1500);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:!max-w-none"
        style={{ width: "min(100vw, max(50vw, 640px))" }}
      >
        <SheetHeader className="flex-row items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
          {creator ? (
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Avatar className="size-12 shrink-0 ring-2 ring-card shadow-sm">
                {creator.avatar_url && (
                  <AvatarImage src={creator.avatar_url} alt={creator.handle} />
                )}
                <AvatarFallback className="bg-canva-purple-soft text-canva-purple">
                  {creator.handle.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <SheetTitle className="font-heading text-base font-extrabold leading-tight text-foreground">
                  <Link
                    href={`/creator/${creator.handle}`}
                    className="block truncate hover:underline"
                  >
                    {creator.display_name ?? creator.handle}
                  </Link>
                </SheetTitle>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-handle truncate">@{creator.handle}</span>
                  {creator.followers != null && (
                    <span className="shrink-0">· {formatFollowers(creator.followers)}</span>
                  )}
                  {creator.tier && (
                    <span className="shrink-0 capitalize">· {creator.tier}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <SheetTitle>Creator</SheetTitle>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {!cc ? null : (
            <div className="flex flex-col gap-4 p-5">
              {/* Status + match + rate */}
              <Section title="Pipeline">
                <div className="flex flex-wrap items-center gap-3">
                  <CreatorStatusDropdown
                    campaignCreatorId={cc.id}
                    currentStatus={cc.status}
                    onStatusChange={handleStatusChange}
                  />
                  {cc.match_score_at_assignment != null && (
                    <span className="text-xs text-muted-foreground">
                      Match{" "}
                      <span className="font-bold text-foreground">
                        {Math.round(cc.match_score_at_assignment)}%
                      </span>
                    </span>
                  )}
                  <div className="ml-auto">
                    <InlineRateEditor
                      value={cc.agreed_rate}
                      currency={campaignCurrency}
                      onSave={handleSaveRate}
                    />
                  </div>
                </div>
              </Section>

              {/* Tracking link */}
              {isConfirmedLike && (
                <Section
                  title="Tracking link"
                  badge={
                    <span className="rounded-full bg-canva-purple-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canva-purple">
                      Auto-generated
                    </span>
                  }
                >
                  <TrackingLinkCard
                    link={trackingLink}
                    campaignCurrency={campaignCurrency}
                    onCopy={copyTrackingLink}
                    linkCopied={linkCopied}
                  />
                </Section>
              )}

              {/* Barter order */}
              {isConfirmedLike && creator && (
                <Section
                  title="Barter order"
                  badge={
                    barterOrders.length > 0 ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                        {barterOrders.length} sent
                      </span>
                    ) : undefined
                  }
                >
                  {barterOrders.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {barterOrders.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-foreground">
                              {o.product_title ?? "Barter item"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {o.status ?? "draft"}
                              {o.retail_value != null
                                ? ` · ${formatCurrency(o.retail_value, campaignCurrency)}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {showBarterForm ? (
                    <div className="mt-3 rounded-lg border border-border bg-card p-3">
                      <BarterOrderForm
                        key={barterFormKey}
                        campaignId={campaignId}
                        campaignCreatorId={cc.id}
                        creatorId={cc.creator_id}
                        creatorHandle={creator.handle}
                        creatorName={creator.display_name}
                        brandId={brandId}
                        currency={campaignCurrency}
                        hideRecipient
                        onSuccess={() => {
                          setShowBarterForm(false);
                          setBarterFormKey((k) => k + 1);
                          fetchBarterOrders();
                          toast.success("Barter order created");
                        }}
                        onCancel={() => setShowBarterForm(false)}
                      />
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setShowBarterForm(true)}
                    >
                      <Send className="size-3.5" />
                      {barterOrders.length > 0
                        ? "Send another barter order"
                        : "Send barter order"}
                    </Button>
                  )}
                </Section>
              )}

              {/* Submission link (brand → creator upload portal) */}
              <Section
                title="Submission link"
                badge={
                  submissionLink ? (
                    <span className="rounded-full bg-canva-purple-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canva-purple">
                      Active
                    </span>
                  ) : undefined
                }
              >
                <SubmissionLinkCard
                  link={submissionLink}
                  loading={submissionLinkLoading}
                  copied={submissionCopied}
                  onGenerate={ensureSubmissionLink}
                  onCopy={copySubmissionLink}
                />
              </Section>

              {/* Content performance (live metrics) */}
              {(cc.status === "content_live" || cc.status === "completed") && (
                <Section title="Content performance">
                  {livePost ? (
                    <div className="flex gap-3 rounded-lg border border-border bg-card p-3">
                      {livePost.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={livePost.thumbnail}
                          alt=""
                          className="size-20 shrink-0 rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="size-20 shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {livePost.platform}
                          {livePost.url && (
                            <a
                              href={livePost.url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-auto inline-flex items-center gap-1 text-canva-purple hover:underline"
                            >
                              <ExternalLink className="size-3" />
                              Open
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <Stat
                            label="Views"
                            value={
                              livePost.views != null
                                ? formatFollowers(livePost.views)
                                : "--"
                            }
                          />
                          <Stat
                            label="Likes"
                            value={
                              livePost.likes != null
                                ? formatFollowers(livePost.likes)
                                : "--"
                            }
                          />
                          <Stat
                            label="Comments"
                            value={
                              livePost.comments != null
                                ? formatFollowers(livePost.comments)
                                : "--"
                            }
                          />
                          <Stat
                            label="Engagement"
                            value={
                              livePost.engagement_rate != null
                                ? `${(livePost.engagement_rate <= 1
                                    ? livePost.engagement_rate * 100
                                    : livePost.engagement_rate
                                  ).toFixed(1)}%`
                                : "--"
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyHint
                      icon={<Sparkles className="size-4" />}
                      text="Metrics will appear once the post is detected on the creator's feed."
                    />
                  )}
                </Section>
              )}

              {/* Content submission */}
              <Section title="Content submission">
                {loading ? (
                  <SkeletonCard />
                ) : submission ? (
                  <SubmissionCard
                    submission={submission}
                    scan={scan}
                    reviewBusy={reviewBusy}
                    onApprove={() => reviewSubmission("approve")}
                    onReject={() => reviewSubmission("reject")}
                    onRequestRevision={() => setShowRevisionForm(true)}
                  />
                ) : (
                  <EmptyHint
                    icon={<Sparkles className="size-4" />}
                    text="No submission yet. Once the creator uploads, the post and compliance scan will surface here."
                  />
                )}

                {showRevisionForm && submission && (
                  <RevisionForm
                    value={feedbackDraft}
                    setValue={setFeedbackDraft}
                    busy={reviewBusy === "revision_requested"}
                    onCancel={() => {
                      setShowRevisionForm(false);
                      setFeedbackDraft("");
                    }}
                    onSubmit={() => {
                      if (!feedbackDraft.trim()) {
                        toast.error("Add a note before sending");
                        return;
                      }
                      reviewSubmission("revision_requested", feedbackDraft);
                    }}
                    revisionDraft={scan?.revision_draft ?? null}
                  />
                )}
              </Section>

              {/* Outreach summary */}
              <Section title="Outreach">
                <OutreachCard thread={thread} creatorHandle={creator?.handle ?? ""} creatorId={cc.creator_id} campaignId={campaignId} />
              </Section>

              {/* Deliverables */}
              {cc.content_deliverables && cc.content_deliverables.length > 0 && (
                <Section title="Deliverables">
                  <div className="flex flex-wrap gap-1.5">
                    {cc.content_deliverables.map((d) => (
                      <span
                        key={d}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold capitalize text-muted-foreground"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="flex h-24 animate-pulse items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
      <span className="text-canva-purple">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function TrackingLinkCard({
  link,
  campaignCurrency,
  onCopy,
  linkCopied,
}: {
  link: CampaignUtmLink | null;
  campaignCurrency: string;
  onCopy: () => void;
  linkCopied: boolean;
}) {
  if (!link) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-canva-purple/40 bg-canva-purple-soft px-4 py-3 text-xs text-canva-purple">
        <Loader2 className="size-3.5 animate-spin" />
        Generating link...
      </div>
    );
  }
  const url = link.full_url ?? "";
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-canva-purple/30 p-3"
      style={{ background: "var(--gradient-canva-soft)" }}
    >
      <p className="text-[11px] leading-snug text-foreground/80">
        Share this link with the creator. Every click and order attributed
        through it lands here under <b>orders</b> and <b>revenue</b>.
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <span className="truncate font-mono text-[11px] text-foreground" title={url}>
          {url || "—"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          aria-label="Copy link"
        >
          {linkCopied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
            aria-label="Open link"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Clicks" value={String(link.click_count ?? 0)} />
        <Stat label="Orders" value={String(link.orders_attributed ?? 0)} />
        <Stat
          label="Revenue"
          value={formatCurrency(
            link.revenue_attributed ?? 0,
            campaignCurrency,
          )}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-2.5 py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-heading text-sm font-extrabold leading-tight text-foreground">
        {value}
      </div>
    </div>
  );
}

function SubmissionCard({
  submission,
  scan,
  reviewBusy,
  onApprove,
  onReject,
  onRequestRevision,
}: {
  submission: ContentSubmissionRow;
  scan: ComplianceScanRow | null;
  reviewBusy: null | "approve" | "reject" | "revision_requested";
  onApprove: () => void;
  onReject: () => void;
  onRequestRevision: () => void;
}) {
  const statusPillCls: Record<string, string> = {
    submitted: "bg-info/15 text-info",
    approved: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
    revision_requested: "bg-warning/15 text-warning",
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground">Submitted</div>
          <div className="text-xs text-foreground">
            {new Date(submission.submitted_at).toLocaleString()}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            statusPillCls[submission.status] ?? "bg-muted text-muted-foreground",
          )}
        >
          {submission.status.replace(/_/g, " ")}
        </span>
      </div>

      {submission.content_url && (
        <a
          href={submission.content_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-canva-purple-soft hover:text-canva-purple"
        >
          <ExternalLink className="size-3.5" />
          View post
        </a>
      )}

      {submission.caption_text && (
        <p className="line-clamp-3 text-xs leading-snug text-muted-foreground">
          “{submission.caption_text}”
        </p>
      )}

      {scan ? (
        <ComplianceList scan={scan} />
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Compliance scan running…
        </div>
      )}

      {submission.feedback && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-foreground">
          <div className="mb-1 font-bold text-warning">Last feedback</div>
          <p className="leading-snug">{submission.feedback}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onApprove}
          disabled={reviewBusy != null || submission.status === "approved"}
          className="flex-1"
          style={{ background: "var(--gradient-canva)" }}
        >
          {reviewBusy === "approve" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ThumbsUp className="size-3.5" />
          )}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestRevision}
          disabled={reviewBusy != null}
          className="flex-1"
        >
          <RefreshCw className="size-3.5" />
          Suggest revision
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={reviewBusy != null || submission.status === "rejected"}
          className="text-destructive hover:bg-destructive/10"
        >
          {reviewBusy === "reject" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ThumbsDown className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function ComplianceList({ scan }: { scan: ComplianceScanRow }) {
  const checks: { label: string; ok: boolean | null }[] = [
    { label: "Ad disclosure", ok: scan.has_ad_disclosure },
    { label: "Brand mention", ok: scan.has_brand_mention },
    { label: "Product visibility", ok: scan.has_product_visibility },
    { label: "Discount code", ok: scan.has_discount_code },
    { label: "Spoken brand mention", ok: scan.has_spoken_brand_mention },
  ];
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-xs font-bold">
        {scan.overall_pass ? (
          <CircleCheck className="size-4 text-success" />
        ) : (
          <CircleAlert className="size-4 text-warning" />
        )}
        <span className={scan.overall_pass ? "text-success" : "text-warning"}>
          {scan.overall_pass ? "Compliance passed" : "Issues to review"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5 text-[11px]">
            {c.ok === true ? (
              <CircleCheck className="size-3 text-success" />
            ) : c.ok === false ? (
              <CircleAlert className="size-3 text-destructive" />
            ) : (
              <CircleDot className="size-3 text-muted-foreground" />
            )}
            <span className="text-foreground">{c.label}</span>
          </div>
        ))}
      </div>
      {scan.issues_found && scan.issues_found.length > 0 && (
        <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground">
          {scan.issues_found.slice(0, 3).map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RevisionForm({
  value,
  setValue,
  busy,
  onCancel,
  onSubmit,
  revisionDraft,
}: {
  value: string;
  setValue: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  revisionDraft: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-warning/30 bg-warning/5 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-warning">
        Suggest revision
      </div>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          revisionDraft ??
          "Describe what should change. The note becomes a draft message to the creator."
        }
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-canva-purple focus:outline-none focus:ring-2 focus:ring-canva-purple/20"
      />
      {revisionDraft && (
        <button
          type="button"
          onClick={() => setValue(revisionDraft)}
          className="self-start text-[11px] font-bold text-canva-purple hover:underline"
        >
          Use AI suggestion
        </button>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={busy}>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Send to creator
        </Button>
      </div>
    </div>
  );
}

function SubmissionLinkCard({
  link,
  loading,
  copied,
  onGenerate,
  onCopy,
}: {
  link: SubmissionLinkInfo | null;
  loading: boolean;
  copied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  if (!link?.submission_url) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-3">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Generate a token-protected upload link the creator can use to send
          their post + caption. We&apos;ll auto-run the compliance scan once
          they submit.
        </p>
        <Button size="sm" onClick={onGenerate} disabled={loading} className="self-start">
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Generate submission link
        </Button>
      </div>
    );
  }
  const url = link.submission_url;
  const expiry = link.expires_at
    ? new Date(link.expires_at).toLocaleDateString()
    : null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] leading-snug text-muted-foreground">
        Share this link. The creator uploads through it — no login needed.
        {expiry ? ` Expires ${expiry}.` : ""}
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <span className="truncate font-mono text-[11px] text-foreground" title={url}>
          {url}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          aria-label="Copy submission link"
        >
          {copied ? (
            <Check className="size-3.5 text-success" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          aria-label="Open submission link"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function OutreachCard({
  thread,
  creatorHandle,
  creatorId,
  campaignId,
}: {
  thread: MessageThreadPreviewRow | null;
  creatorHandle: string;
  creatorId: string;
  campaignId: string;
}) {
  if (!thread) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <span>No outreach yet for this campaign.</span>
        <Button
          size="xs"
          variant="outline"
          render={
            <Link
              href={`/outreach?compose=1&creator_id=${creatorId}&campaign_id=${campaignId}`}
            />
          }
        >
          <Mail className="size-3.5" />
          Reach out
        </Button>
      </div>
    );
  }
  const statusLabel = (thread.outreach_status ?? "open").replace(/_/g, " ");
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="rounded-full bg-canva-purple-soft px-2 py-0.5 font-bold capitalize text-canva-purple">
          {statusLabel}
        </span>
        {thread.last_message_at && (
          <span className="text-muted-foreground">
            {new Date(thread.last_message_at).toLocaleString()}
          </span>
        )}
      </div>
      {thread.subject && (
        <div className="text-xs font-bold text-foreground">{thread.subject}</div>
      )}
      {thread.last_message_preview && (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">
          {thread.last_message_preview}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="xs"
          variant="outline"
          render={<Link href={`/outreach?thread=${thread.id}`} />}
        >
          Open thread
        </Button>
        <Button
          size="xs"
          variant="ghost"
          render={
            <Link
              href={`/outreach?compose=1&creator_id=${creatorId}&campaign_id=${campaignId}`}
            />
          }
        >
          <Send className="size-3.5" />
          Send follow-up
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          @{creatorHandle}
        </span>
      </div>
    </div>
  );
}
