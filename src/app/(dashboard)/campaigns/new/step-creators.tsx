"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Search,
  Users,
  Sparkles,
  FolderOpen,
  Compass,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFollowers } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { CreatorList } from "@/lib/types/database";
import type { SelectedCreator, CreatorSource } from "./wizard-types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface StepCreatorsProps {
  creatorSource: CreatorSource | null;
  setCreatorSource: (source: CreatorSource) => void;
  selectedCreators: SelectedCreator[];
  toggleCreator: (creator: SelectedCreator) => void;
  isSelected: (id: string) => boolean;
  searchResults: SelectedCreator[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchLoading: boolean;
  searchCreators: (query: string) => void;
  lists: CreatorList[];
  selectedListId: string | null;
  setSelectedListId: (id: string) => void;
  totalEstimated: number;
  onBack: () => void;
  onNext: () => void;
}

/* ------------------------------------------------------------------ */
/*  Source tabs config                                                  */
/* ------------------------------------------------------------------ */

const SOURCE_TABS: {
  value: CreatorSource;
  label: string;
  icon: typeof Sparkles;
  description: string;
}[] = [
  {
    value: "recommendations",
    label: "AI Recommended",
    icon: Sparkles,
    description: "Best matches for your brand",
  },
  {
    value: "discovery",
    label: "Search",
    icon: Compass,
    description: "Find by handle or name",
  },
  {
    value: "saved_list",
    label: "Saved Lists",
    icon: FolderOpen,
    description: "Use your curated lists",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StepCreators({
  creatorSource,
  setCreatorSource,
  selectedCreators,
  toggleCreator,
  isSelected,
  searchResults,
  searchQuery,
  setSearchQuery,
  searchLoading,
  searchCreators,
  lists,
  selectedListId,
  setSelectedListId,
  totalEstimated,
  onBack,
  onNext,
}: StepCreatorsProps) {
  return (
    <div className="space-y-6">
      {/* 2-panel layout */}
      <div className="flex gap-4">
        {/* ── Left panel: Source + Results (60%) ── */}
        <div className="flex-[3] min-w-0 space-y-3">
          <Card className="overflow-hidden">
            <CardContent className="space-y-3">
              {/* Source tabs — compact inline row */}
              <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                {SOURCE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setCreatorSource(tab.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex-1 justify-center",
                        creatorSource === tab.value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Source-specific controls */}
              {creatorSource === "discovery" && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by handle or name (e.g., @neeshicorner, Priya)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") searchCreators(searchQuery);
                    }}
                    className="pl-9 h-8"
                  />
                </div>
              )}

              {creatorSource === "saved_list" && (
                <div className="flex flex-wrap gap-1.5">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => setSelectedListId(list.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        selectedListId === list.id
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-input text-muted-foreground hover:border-foreground/30",
                      )}
                    >
                      {list.name}
                    </button>
                  ))}
                  {lists.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">
                      No saved lists found. Create lists from the My Creators page.
                    </p>
                  )}
                </div>
              )}

              {/* Results list — tall scrollable area */}
              {creatorSource && (
                <ScrollArea className="max-h-[calc(100vh-340px)] min-h-[300px]">
                  <div className="space-y-0.5">
                    {searchLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : searchResults.length === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">
                        {creatorSource === "recommendations"
                          ? "No recommendations yet. Complete your brand profile for personalized matches."
                          : creatorSource === "discovery"
                            ? "Type a handle or name and press Enter to search."
                            : "Select a list to see creators."}
                      </p>
                    ) : (
                      searchResults.map((creator) => (
                        <button
                          key={creator.id}
                          type="button"
                          onClick={() => toggleCreator(creator)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                            isSelected(creator.id)
                              ? "bg-primary/5"
                              : "hover:bg-muted",
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors",
                              isSelected(creator.id)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input",
                            )}
                          >
                            {isSelected(creator.id) && (
                              <Check className="size-3" />
                            )}
                          </div>
                          <Avatar className="size-7">
                            {creator.avatar_url && (
                              <AvatarImage
                                src={creator.avatar_url}
                                alt={creator.handle}
                              />
                            )}
                            <AvatarFallback className="text-[10px]">
                              {creator.handle.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-handle truncate text-foreground text-sm">
                              @{creator.handle}
                            </p>
                            {creator.display_name && (
                              <p className="truncate text-xs text-muted-foreground">
                                {creator.display_name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                            {creator.followers != null && (
                              <span>{formatFollowers(creator.followers)}</span>
                            )}
                            {creator.tier && (
                              <Badge
                                variant="secondary"
                                className="capitalize text-[10px]"
                              >
                                {creator.tier}
                              </Badge>
                            )}
                            {creator.matchScore != null && (
                              <Badge className="text-[10px]">
                                {creator.matchScore}%
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}

              {/* Empty state when no source selected */}
              {!creatorSource && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="mb-3 size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Choose a source above to find creators
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can skip this step and add creators later
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right panel: Selected creators (40%) ── */}
        <div className="flex-[2] min-w-0">
          <div className="sticky top-4">
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Selected
                  </h3>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Users className="size-3" />
                    {selectedCreators.length}
                  </Badge>
                </div>

                {selectedCreators.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No creators selected yet
                  </p>
                ) : (
                  <ScrollArea className="max-h-[calc(100vh-420px)]">
                    <div className="space-y-1">
                      {selectedCreators.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 group"
                        >
                          <Avatar className="size-6 shrink-0">
                            {c.avatar_url && (
                              <AvatarImage src={c.avatar_url} alt={c.handle} />
                            )}
                            <AvatarFallback className="text-[9px]">
                              {c.handle.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-handle text-xs truncate text-foreground">
                              @{c.handle}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.followers != null
                                ? formatFollowers(c.followers)
                                : ""}
                              {c.tier ? ` \u00B7 ${c.tier}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCreator(c)}
                            className="opacity-0 group-hover:opacity-100 rounded-full p-0.5 hover:bg-muted transition-opacity"
                          >
                            <X className="size-3 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {/* Estimated total */}
                {totalEstimated > 0 && (
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Est. total</span>
                      <span className="font-semibold text-foreground">
                        {"\u20B9"}{totalEstimated.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button onClick={onNext} size="lg">
          Next: Review
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
