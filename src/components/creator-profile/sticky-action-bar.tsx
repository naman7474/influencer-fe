"use client";

import { useState } from "react";
import {
  UserPlus,
  Bookmark,
  Mail,
  Share2,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import type { Creator } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/* ------------------------------------------------------------------ */
/*  Tier config                                                        */
/* ------------------------------------------------------------------ */

const TIER_LABELS: Record<string, string> = {
  nano: "Nano",
  micro: "Micro",
  mid: "Mid-tier",
  macro: "Macro",
  mega: "Mega",
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface StickyActionBarProps {
  creator: Creator;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StickyActionBar({ creator }: StickyActionBarProps) {
  const [emailCopied, setEmailCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyEmail = async () => {
    if (!creator.contact_email) return;
    await navigator.clipboard.writeText(creator.contact_email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const handleShareProfile = async () => {
    const url = `${window.location.origin}/creator/${creator.handle}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const tierLabel = TIER_LABELS[creator.tier ?? "nano"] ?? "Nano";

  return (
    <div className="sticky bottom-0 z-30 border-t bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-6 py-2.5">
        {/* Left: identity anchor */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="size-7 shrink-0">
            {creator.avatar_url && (
              <AvatarImage
                src={creator.avatar_url}
                alt={creator.handle}
              />
            )}
            <AvatarFallback className="text-[10px]">
              {(creator.display_name ?? creator.handle)
                .charAt(0)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-handle text-sm text-muted-foreground truncate">
            @{creator.handle}
          </span>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {tierLabel}
          </Badge>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Add to Campaign */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm">
                  <UserPlus className="size-3.5" />
                  <span className="hidden sm:inline">Add to Campaign</span>
                  <ChevronDown className="size-3" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <span className="text-muted-foreground">
                  No campaigns yet
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Create New Campaign</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save to List */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Bookmark className="size-3.5" />
                  <span className="hidden sm:inline">Save to List</span>
                  <ChevronDown className="size-3" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <span className="text-muted-foreground">No lists yet</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Create New List</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Copy Email */}
          {creator.contact_email && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopyEmail}
              className="size-8"
            >
              {emailCopied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Mail className="size-3.5" />
              )}
            </Button>
          )}

          {/* Share Profile */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleShareProfile}
            className="size-8"
          >
            {linkCopied ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Share2 className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
