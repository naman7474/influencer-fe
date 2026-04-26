"use client";

import * as React from "react";

import type { SocialPlatform } from "@/lib/types/creator-detail";
import { cn } from "@/lib/utils";

export type DeepTabId = "content" | "performance" | "audience" | "brand";

interface TabsStripProps {
  active: DeepTabId;
  onChange: (tab: DeepTabId) => void;
  platform: SocialPlatform;
}

const TABS: { id: DeepTabId; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "performance", label: "Performance" },
  { id: "audience", label: "Audience" },
  { id: "brand", label: "Brand match" },
];

const ACCENT: Record<SocialPlatform, string> = {
  instagram: "var(--ig)",
  youtube: "var(--yt)",
};

export function TabsStrip({ active, onChange, platform }: TabsStripProps) {
  const accent = ACCENT[platform];
  return (
    <div
      role="tablist"
      aria-label="Profile section"
      className="-mb-px flex gap-1 border-b border-border"
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative px-[18px] py-2.5 text-[13px] font-bold transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            style={
              isActive
                ? { boxShadow: `inset 0 -3px 0 ${accent}` }
                : undefined
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
