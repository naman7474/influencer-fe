"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  BookOpen,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Filter,
  Search,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────── */

interface KnowledgeItem {
  id: string;
  knowledge_type: string;
  fact: string;
  confidence: number;
  evidence_count: number;
  reinforced_count: number;
  contradicted_count: number;
  last_reinforced_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EpisodeItem {
  id: string;
  episode_type: string;
  summary: string;
  details: Record<string, unknown> | null;
  creator_id: string | null;
  campaign_id: string | null;
  outcome: string | null;
  created_at: string;
}

/* ── Knowledge type styling ─────────────────────────────── */

const KNOWLEDGE_TYPES: Record<string, { label: string; color: string }> = {
  rate_benchmark: { label: "Rate Benchmark", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  niche_insight: { label: "Niche Insight", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  brand_preference: { label: "Brand Preference", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  outreach_pattern: { label: "Outreach Pattern", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  negotiation_strategy: { label: "Negotiation Strategy", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  creator_insight: { label: "Creator Insight", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  timing_pattern: { label: "Timing Pattern", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  content_performance: { label: "Content Performance", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
};

const EPISODE_TYPES: Record<string, { label: string; color: string }> = {
  outreach_drafted: { label: "Outreach Drafted", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  outreach_approved: { label: "Outreach Approved", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  creator_search: { label: "Creator Search", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  recommendation_given: { label: "Recommendation", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  campaign_advice: { label: "Campaign Advice", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  rate_benchmark: { label: "Rate Benchmark", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
};

const OUTCOME_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  positive: { icon: TrendingUp, color: "text-green-600" },
  negative: { icon: TrendingDown, color: "text-red-600" },
  neutral: { icon: Minus, color: "text-muted-foreground" },
  pending: { icon: Clock, color: "text-amber-600" },
};

/* ── Confidence bar ─────────────────────────────────────── */

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? "bg-green-500"
      : pct >= 60
        ? "bg-blue-500"
        : pct >= 40
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

/* ── Relative time helper ───────────────────────────────── */

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/* ── Main Page ──────────────────────────────────────────── */

export default function MemoryPage() {
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [knowledgeFilter, setKnowledgeFilter] = useState("all");
  const [episodeFilter, setEpisodeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/agent/memory?tab=knowledge")
      .then((r) => r.json())
      .then((data) => setKnowledge(data.knowledge || []))
      .finally(() => setLoadingKnowledge(false));

    fetch("/api/agent/memory?tab=episodes")
      .then((r) => r.json())
      .then((data) => setEpisodes(data.episodes || []))
      .finally(() => setLoadingEpisodes(false));
  }, []);

  const filteredKnowledge = knowledge.filter((item) => {
    if (knowledgeFilter !== "all" && item.knowledge_type !== knowledgeFilter) return false;
    if (searchQuery && !item.fact.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredEpisodes = episodes.filter((item) => {
    if (episodeFilter !== "all" && item.episode_type !== episodeFilter) return false;
    if (searchQuery && !item.summary.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Stats
  const avgConfidence = knowledge.length
    ? Math.round(
        (knowledge.reduce((s, k) => s + k.confidence, 0) / knowledge.length) * 100
      )
    : 0;
  const highConfidence = knowledge.filter((k) => k.confidence >= 0.8).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Agent Memory
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything your agent has learned and remembers. Knowledge improves over time as the agent gains experience.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Knowledge Facts</span>
            </div>
            <p className="text-2xl font-bold mt-1">{knowledge.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Episodes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{episodes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-500" />
              <span className="text-xs text-muted-foreground">Avg Confidence</span>
            </div>
            <p className="text-2xl font-bold mt-1">{avgConfidence}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">High Confidence</span>
            </div>
            <p className="text-2xl font-bold mt-1">{highConfidence}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="knowledge">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="knowledge" className="gap-1.5">
            <Lightbulb className="size-3.5" />
            Knowledge ({knowledge.length})
          </TabsTrigger>
          <TabsTrigger value="episodes" className="gap-1.5">
            <BookOpen className="size-3.5" />
            Episodes ({episodes.length})
          </TabsTrigger>
        </TabsList>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={knowledgeFilter} onValueChange={(val) => setKnowledgeFilter(val as string)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(KNOWLEDGE_TYPES).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingKnowledge ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredKnowledge.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="No knowledge yet"
              description="Your agent learns from conversations. Start chatting and it will build knowledge over time."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filteredKnowledge.map((item) => {
                const typeMeta = KNOWLEDGE_TYPES[item.knowledge_type] || {
                  label: item.knowledge_type,
                  color: "bg-gray-100 text-gray-700",
                };
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px] px-1.5 py-0", typeMeta.color)}
                          >
                            {typeMeta.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(item.created_at)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{item.fact}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                      <div className="flex-1">
                        <ConfidenceBar value={item.confidence} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          {item.reinforced_count} reinforced
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          {item.contradicted_count} contradicted
                        </span>
                        <span>
                          {item.evidence_count} evidence
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Episodes Tab */}
        <TabsContent value="episodes" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={episodeFilter} onValueChange={(val) => setEpisodeFilter(val as string)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(EPISODE_TYPES).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingEpisodes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEpisodes.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No episodes yet"
              description="Episodes are created when the agent takes significant actions like searching creators or drafting outreach."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredEpisodes.map((item) => {
                const typeMeta = EPISODE_TYPES[item.episode_type] || {
                  label: item.episode_type,
                  color: "bg-gray-100 text-gray-700",
                };
                const outcomeStyle = item.outcome
                  ? OUTCOME_STYLES[item.outcome] || OUTCOME_STYLES.neutral
                  : null;
                const OutcomeIcon = outcomeStyle?.icon;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border bg-background p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge
                          variant="secondary"
                          className={cn("text-[10px] px-1.5 py-0", typeMeta.color)}
                        >
                          {typeMeta.label}
                        </Badge>
                        {outcomeStyle && OutcomeIcon && (
                          <OutcomeIcon className={cn("h-3 w-3", outcomeStyle.color)} />
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {timeAgo(item.created_at)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{item.summary}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────── */

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
