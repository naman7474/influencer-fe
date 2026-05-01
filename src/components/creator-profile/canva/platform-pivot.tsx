"use client";

import * as React from "react";

import type { SocialPlatform } from "@/lib/types/creator-detail";
import { formatFollowers } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PlatformPivotItem {
  platform: SocialPlatform;
  followers: number | null;
  available: boolean;
  // profileUrl + handle are not consumed here today — the visible profile
  // chip lives in the creator header. Kept on the type so the parent's
  // shared URL-construction logic continues to work and we have a hook
  // here if we ever want a per-tab CTA again.
  profileUrl?: string | null;
  handle?: string | null;
}

interface PlatformPivotProps {
  items: PlatformPivotItem[];
  active: SocialPlatform;
  onChange: (platform: SocialPlatform) => void;
}

const META: Record<
  SocialPlatform,
  { label: string; gradient: string; mark: string; markBg: string }
> = {
  instagram: {
    label: "Instagram",
    gradient: "var(--gradient-instagram)",
    mark: "IG",
    markBg: "var(--gradient-instagram)",
  },
  youtube: {
    label: "YouTube",
    gradient: "var(--gradient-youtube)",
    mark: "YT",
    markBg: "var(--yt)",
  },
};

export function PlatformPivot({ items, active, onChange }: PlatformPivotProps) {
  return (
    <div
      role="tablist"
      aria-label="Platform"
      className="grid border-b border-border"
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
    >
      {items.map((item, idx) => {
        const meta = META[item.platform];
        const isActive = active === item.platform;
        const disabled = !item.available;
        return (
          <button
            key={item.platform}
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => !disabled && onChange(item.platform)}
            className={cn(
              "relative px-5 py-4 text-left transition-colors",
              idx < items.length - 1 && "border-r border-border",
              isActive ? "bg-card" : "bg-muted/40",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {isActive && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{ background: meta.gradient }}
              />
            )}
            <div className="mb-1.5 flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-[22px] w-[22px] place-items-center rounded-md text-[9px] font-extrabold text-white shadow-sm"
                style={{ background: meta.markBg }}
              >
                {meta.mark}
              </span>
              <span
                className={cn(
                  "text-xs font-bold",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {meta.label}
              </span>
              {disabled && (
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  No data
                </span>
              )}
            </div>
            <div className="font-heading text-lg font-extrabold leading-none text-foreground">
              {item.followers != null ? formatFollowers(item.followers) : "—"}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              followers
            </div>
          </button>
        );
      })}
    </div>
  );
}
