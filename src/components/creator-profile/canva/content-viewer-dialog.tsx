"use client";

import * as React from "react";
import { ExternalLink, Heart, MessageCircle, Eye, Calendar } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFollowers } from "@/lib/format";
import type { ContentItem } from "@/lib/types/creator-detail";

interface ContentViewerDialogProps {
  item: ContentItem | null;
  onClose: () => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function igEmbedSrc(item: ContentItem): string | null {
  if (item.kind !== "ig_post") return null;
  if (item.shortcode) return `https://www.instagram.com/p/${item.shortcode}/embed`;
  if (item.url) {
    const m = item.url.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/);
    if (m) return `https://www.instagram.com/p/${m[1]}/embed`;
  }
  return null;
}

function ytEmbedSrc(item: ContentItem): string | null {
  if (item.kind !== "yt_video") return null;
  if (item.video_id) return `https://www.youtube.com/embed/${item.video_id}`;
  return null;
}

export function ContentViewerDialog({ item, onClose }: ContentViewerDialogProps) {
  const open = item != null;

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  if (!item) {
    return (
      <Dialog open={false} onOpenChange={handleOpenChange}>
        <DialogContent className="sr-only">
          <DialogTitle>Content viewer</DialogTitle>
        </DialogContent>
      </Dialog>
    );
  }

  const isIg = item.kind === "ig_post";
  const isShort = item.kind === "yt_video" && item.is_short;
  const embed = isIg ? igEmbedSrc(item) : ytEmbedSrc(item);
  // YT Shorts are vertical (9:16); regular YT is 16:9; IG posts are ~1:1.2.
  const embedAspect = isIg ? "1 / 1.2" : isShort ? "9 / 16" : "16 / 9";
  // Shorts get a narrow dialog with vertical stacking (embed top, metadata
  // below) to mirror YouTube's native Shorts viewer. IG and regular YT use
  // the wider horizontal split.
  //
  // The sm: prefix is REQUIRED — the shadcn Dialog ships `sm:max-w-sm`
  // baked into its base styles (~384px). Without `sm:` here, tailwind-merge
  // applies our value at the base breakpoint only and the dialog clamps
  // to 384px from sm: upward.
  const dialogMaxW = isShort ? "sm:max-w-md" : isIg ? "sm:max-w-3xl" : "sm:max-w-5xl";
  const externalUrl = item.url ?? null;
  const title = isIg
    ? item.description?.split("\n")[0] ?? "Instagram post"
    : item.title ?? "YouTube video";
  const caption = isIg ? item.description : item.description;
  const date = isIg ? item.date_posted : item.published_at;
  const views = isIg
    ? item.video_view_count ?? item.video_play_count ?? null
    : item.view_count;
  const likes = isIg ? item.likes : item.like_count;
  const comments = isIg ? item.num_comments : item.comment_count;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`${dialogMaxW} max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0`}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div
          className={
            isShort
              ? "flex flex-1 flex-col overflow-y-auto"
              : "flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden"
          }
        >
          {/* Embed / preview */}
          <div
            className={
              isShort
                ? "bg-black flex items-center justify-center"
                : "bg-black flex items-center justify-center md:w-3/5 md:flex-shrink-0"
            }
          >
            {embed ? (
              <div
                className="relative w-full mx-auto"
                style={{
                  aspectRatio: embedAspect,
                  maxWidth: isShort ? "300px" : undefined,
                }}
              >
                <iframe
                  src={embed}
                  title={title}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : item.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnail_url}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-white/60">
                No preview available
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
            <div className="font-heading text-base font-extrabold leading-snug text-foreground">
              {title}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {formatDate(date)}
                </span>
              )}
              {views != null && (
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5" />
                  {formatFollowers(views)}
                </span>
              )}
              {likes != null && (
                <span className="inline-flex items-center gap-1">
                  <Heart className="size-3.5" />
                  {formatFollowers(likes)}
                </span>
              )}
              {comments != null && (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3.5" />
                  {formatFollowers(comments)}
                </span>
              )}
            </div>

            {caption && (
              <p className="whitespace-pre-wrap text-sm text-foreground/90">
                {caption}
              </p>
            )}

            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <ExternalLink className="size-3.5" />
                Open on {isIg ? "Instagram" : "YouTube"}
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
