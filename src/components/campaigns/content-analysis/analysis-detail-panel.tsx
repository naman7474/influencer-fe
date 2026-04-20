"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  MessageSquare,
  ClipboardCheck,
  Shield,
  Languages,
  Layers,
  Globe,
  Megaphone,
  Volume2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Loader2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AnalysisScoreRing } from "./analysis-score-ring";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalysisData = Record<string, any>;

interface ContentAnalysis {
  id: string;
  status: string;
  error_message: string | null;
  transcript_text: string | null;
  detected_language: string | null;
  hook_text: string | null;
  is_likely_music: boolean;
  overall_score: number | null;
  analysis: AnalysisData | null;
  analysis_model: string | null;
}

interface AnalysisDetailPanelProps {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorHandle?: string;
  onReview?: (action: string, feedback: string) => void;
  submissionStatus?: string;
}

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { key: "hook_strength", label: "Hook Strength", icon: Zap },
  { key: "brand_mention", label: "Brand Mention", icon: MessageSquare },
  { key: "brief_compliance", label: "Brief Compliance", icon: ClipboardCheck },
  { key: "guideline_compliance", label: "Guideline Compliance", icon: Shield },
  { key: "language_tone", label: "Language & Tone", icon: Languages },
  { key: "content_depth", label: "Content Depth", icon: Layers },
  { key: "cultural_signals", label: "Cultural Signals", icon: Globe },
  { key: "cta_effectiveness", label: "CTA Effectiveness", icon: Megaphone },
  { key: "production_quality", label: "Production Quality", icon: Volume2 },
] as const;

function tierColor(tier: string): string {
  const map: Record<string, string> = {
    exceptional: "bg-success/10 text-success",
    strong: "bg-success/10 text-success",
    adequate: "bg-warning/10 text-warning",
    needs_work: "bg-destructive/10 text-destructive",
    poor: "bg-destructive/10 text-destructive",
  };
  return map[tier] ?? "bg-muted text-muted-foreground";
}

function recColor(rec: string): string {
  const map: Record<string, string> = {
    approve: "bg-success/10 text-success",
    approve_with_notes: "bg-success/10 text-success",
    revision_requested: "bg-warning/10 text-warning",
    reject: "bg-destructive/10 text-destructive",
  };
  return map[rec] ?? "bg-muted text-muted-foreground";
}

function scoreBarColor(score: number): string {
  if (score >= 75) return "bg-success";
  if (score >= 50) return "bg-warning";
  return "bg-destructive";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AnalysisDetailPanel({
  submissionId,
  open,
  onOpenChange,
  creatorHandle,
  onReview,
  submissionStatus,
}: AnalysisDetailPanelProps) {
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [showTranscript, setShowTranscript] = useState(false);
  const [retriggerLoading, setRetriggerLoading] = useState(false);

  useEffect(() => {
    if (!submissionId || !open) {
      setAnalysis(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchAnalysis() {
      try {
        const res = await fetch(
          `/api/content-submissions/${submissionId}/analysis`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAnalysis(data.analysis ?? null);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAnalysis();

    // Poll if analysis is in progress
    const interval = setInterval(async () => {
      if (
        analysis?.status &&
        !["completed", "failed", "skipped"].includes(analysis.status)
      ) {
        try {
          const res = await fetch(
            `/api/content-submissions/${submissionId}/analysis`
          );
          if (res.ok && !cancelled) {
            const data = await res.json();
            setAnalysis(data.analysis ?? null);
          }
        } catch {
          // Silently fail
        }
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, open]);

  function toggleCategory(key: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleRetrigger() {
    if (!submissionId) return;
    setRetriggerLoading(true);
    try {
      await fetch(`/api/content-submissions/${submissionId}/analysis`, {
        method: "POST",
      });
      // Refetch
      const res = await fetch(
        `/api/content-submissions/${submissionId}/analysis`
      );
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis ?? null);
      }
    } catch {
      // Silently fail
    } finally {
      setRetriggerLoading(false);
    }
  }

  const a = analysis?.analysis;
  const overall = a?.overall;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {creatorHandle && (
              <span className="font-handle">@{creatorHandle}</span>
            )}
            <span className="text-muted-foreground font-normal">
              Content Analysis
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* No analysis yet */}
          {!loading && !analysis && (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">
                No analysis available yet.
              </p>
              <Button size="sm" variant="outline" onClick={handleRetrigger} disabled={retriggerLoading}>
                {retriggerLoading ? (
                  <Loader2 className="size-3 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="size-3 mr-1" />
                )}
                Trigger Analysis
              </Button>
            </div>
          )}

          {/* In progress */}
          {!loading &&
            analysis &&
            !["completed", "failed", "skipped"].includes(analysis.status) && (
              <div className="text-center py-12 space-y-2">
                <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  {analysis.status === "transcribing"
                    ? "Transcribing video..."
                    : "Analyzing content..."}
                </p>
              </div>
            )}

          {/* Failed */}
          {!loading && analysis?.status === "failed" && (
            <div className="text-center py-12 space-y-2">
              <AlertTriangle className="size-6 mx-auto text-destructive" />
              <p className="text-sm text-destructive">Analysis failed</p>
              {analysis.error_message && (
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {analysis.error_message}
                </p>
              )}
              <Button size="sm" variant="outline" onClick={handleRetrigger} disabled={retriggerLoading}>
                <RotateCcw className="size-3 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {/* Completed analysis */}
          {!loading && analysis?.status === "completed" && a && (
            <>
              {/* ── Flags banner ── */}
              {a.guideline_compliance?.donts_violated?.length > 0 ||
              a.guideline_compliance?.disclosures_missing?.length > 0 ? (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-destructive shrink-0" />
                    <span className="text-xs font-medium text-destructive">
                      Issues Found
                    </span>
                  </div>
                  {a.guideline_compliance.disclosures_missing?.map(
                    (d: string, i: number) => (
                      <p
                        key={i}
                        className="text-xs text-destructive/80 ml-6"
                      >
                        Missing disclosure: {d}
                      </p>
                    )
                  )}
                  {a.guideline_compliance.donts_violated?.map(
                    (d: string, i: number) => (
                      <p
                        key={i}
                        className="text-xs text-destructive/80 ml-6"
                      >
                        Guideline violated: {d}
                      </p>
                    )
                  )}
                </div>
              ) : null}

              {/* ── Overall score ── */}
              <div className="flex items-start gap-4">
                <AnalysisScoreRing
                  score={overall?.score}
                  size="lg"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", tierColor(overall?.tier))}
                    >
                      {(overall?.tier ?? "unknown").replace("_", " ")}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px]",
                        recColor(overall?.recommendation)
                      )}
                    >
                      AI: {(overall?.recommendation ?? "unknown").replace("_", " ")}
                    </Badge>
                    {overall?.confidence && (
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(overall.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground">
                    {overall?.summary ?? "No summary available."}
                  </p>
                </div>
              </div>

              {/* ── Strengths & Improvements ── */}
              <div className="grid grid-cols-2 gap-3">
                {overall?.strengths?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Strengths
                    </p>
                    {overall.strengths.map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <CheckCircle className="size-3 text-success mt-0.5 shrink-0" />
                        <span className="text-xs">{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {overall?.improvement_areas?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      To Improve
                    </p>
                    {overall.improvement_areas.map(
                      (s: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <AlertTriangle className="size-3 text-warning mt-0.5 shrink-0" />
                          <span className="text-xs">{s}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Tabbed breakdown ── */}
              <Tabs defaultValue="scores">
                <TabsList>
                  <TabsTrigger value="scores">Scores</TabsTrigger>
                  <TabsTrigger value="compliance">Compliance</TabsTrigger>
                </TabsList>

                <TabsContent value="scores" className="mt-3 space-y-2">
                  {CATEGORIES.map((cat) => {
                    const data = a[cat.key];
                    if (!data) return null;
                    const Icon = cat.icon;
                    const score = data.score ?? 0;
                    const isExpanded = expandedCategories.has(cat.key);

                    return (
                      <div
                        key={cat.key}
                        className={cn(
                          "rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/30",
                          score < 50 && "border-l-3 border-l-destructive/50",
                          score >= 50 &&
                            score < 75 &&
                            "border-l-3 border-l-warning/50"
                        )}
                        onClick={() => toggleCategory(cat.key)}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="size-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">
                                {cat.label}
                              </span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "font-mono text-xs font-semibold",
                                    score >= 75 && "text-success",
                                    score >= 50 &&
                                      score < 75 &&
                                      "text-warning",
                                    score < 50 && "text-destructive"
                                  )}
                                >
                                  {score}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="size-3 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="size-3 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                            {/* Score bar */}
                            <div className="mt-1 h-1 rounded-full bg-muted/50 w-full">
                              <div
                                className={cn(
                                  "h-1 rounded-full transition-all",
                                  scoreBarColor(score)
                                )}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && data.assessment && (
                          <p className="mt-2 text-xs text-muted-foreground ml-7">
                            {data.assessment}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="compliance" className="mt-3 space-y-4">
                  {/* Brief requirements checklist */}
                  {a.brief_compliance?.requirements?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">
                        Brief Requirements
                      </p>
                      {a.brief_compliance.requirements.map(
                        (
                          req: {
                            requirement: string;
                            met: boolean;
                            evidence: string;
                          },
                          i: number
                        ) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded border p-2"
                          >
                            {req.met ? (
                              <CheckCircle className="size-3.5 text-success mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="size-3.5 text-destructive mt-0.5 shrink-0" />
                            )}
                            <div>
                              <p className="text-xs font-medium">
                                {req.requirement}
                              </p>
                              {req.evidence && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {req.evidence}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Guideline compliance */}
                  {a.guideline_compliance && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">
                        Brand Guidelines
                      </p>

                      {/* Disclosures */}
                      {a.guideline_compliance.disclosures_present?.length >
                        0 && (
                        <div className="flex flex-wrap gap-1">
                          {a.guideline_compliance.disclosures_present.map(
                            (d: string, i: number) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[9px] bg-success/10 text-success"
                              >
                                &#10003; {d}
                              </Badge>
                            )
                          )}
                          {a.guideline_compliance.disclosures_missing?.map(
                            (d: string, i: number) => (
                              <Badge
                                key={`m-${i}`}
                                variant="secondary"
                                className="text-[9px] bg-destructive/10 text-destructive"
                              >
                                &#10007; {d}
                              </Badge>
                            )
                          )}
                        </div>
                      )}

                      {/* Dos followed */}
                      {a.guideline_compliance.dos_followed?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">
                            Guidelines followed:
                          </p>
                          {a.guideline_compliance.dos_followed.map(
                            (d: string, i: number) => (
                              <p key={i} className="text-xs ml-3">
                                &#10003; {d}
                              </p>
                            )
                          )}
                        </div>
                      )}

                      {/* Don'ts violated */}
                      {a.guideline_compliance.donts_violated?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-destructive">
                            Guidelines violated:
                          </p>
                          {a.guideline_compliance.donts_violated.map(
                            (d: string, i: number) => (
                              <p
                                key={i}
                                className="text-xs text-destructive ml-3"
                              >
                                &#10007; {d}
                              </p>
                            )
                          )}
                        </div>
                      )}

                      {a.guideline_compliance.assessment && (
                        <p className="text-xs text-muted-foreground">
                          {a.guideline_compliance.assessment}
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <Separator />

              {/* ── Transcript ── */}
              {analysis.transcript_text && (
                <div>
                  <button
                    onClick={() => setShowTranscript(!showTranscript)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <FileText className="size-3" />
                    {showTranscript ? "Hide" : "Show"} Transcript
                    {analysis.detected_language && (
                      <Badge variant="secondary" className="text-[9px]">
                        {analysis.detected_language}
                      </Badge>
                    )}
                    {analysis.is_likely_music && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] bg-warning/10 text-warning"
                      >
                        Likely music
                      </Badge>
                    )}
                  </button>
                  {showTranscript && (
                    <div className="mt-2 rounded-lg border bg-muted/30 p-3">
                      {analysis.hook_text && (
                        <p className="text-xs mb-2">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase">
                            Hook (first 3s):
                          </span>{" "}
                          {analysis.hook_text}
                        </p>
                      )}
                      <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                        {analysis.transcript_text}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Review actions ── */}
              {onReview && submissionStatus === "submitted" && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const feedback =
                          overall?.improvement_areas?.join("; ") ?? "";
                        onReview("approve", "");
                      }}
                    >
                      <CheckCircle className="size-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => {
                        const feedback =
                          overall?.improvement_areas?.join("\n- ") ?? "";
                        onReview(
                          "revision_requested",
                          feedback ? `Please address:\n- ${feedback}` : ""
                        );
                      }}
                    >
                      <RotateCcw className="size-3 mr-1" />
                      Request Revision
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive"
                      onClick={() => onReview("reject", "")}
                    >
                      <XCircle className="size-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
