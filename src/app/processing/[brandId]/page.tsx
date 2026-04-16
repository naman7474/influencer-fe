"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2Icon, AlertTriangleIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Phase =
  | "queued"
  | "scraping_brand"
  | "extracting_collaborators"
  | "scoring_creators"
  | "ranking"
  | "complete"
  | "failed";

type StatusResponse = {
  phase: Phase;
  progress: number;
  collaborators_count: number;
  creator_jobs_total: number;
  creator_jobs_done: number;
  instagram_handle: string | null;
  error: string | null;
};

const POLL_INTERVAL_MS = 4000;
const COPY_ROTATE_MS = 3000;

const PHASE_TITLES: Record<Phase, string> = {
  queued: "Warming up",
  scraping_brand: "Studying your Instagram",
  extracting_collaborators: "Mapping your creator network",
  scoring_creators: "Analyzing your past collaborators",
  ranking: "Finding your best-fit creators",
  complete: "You're all set",
  failed: "Something went wrong",
};

const PHASE_COPY: Record<Phase, string[]> = {
  queued: [
    "Warming up the recommendation engine…",
    "Reserving a slot on our scraping pipeline…",
  ],
  scraping_brand: [
    "Reading your last 20 Instagram posts…",
    "Studying your tone and content themes…",
    "Looking at what your audience cares about…",
    "Extracting visual and messaging signals from your reels…",
  ],
  extracting_collaborators: [
    "Mapping your past brand collaborations…",
    "Cross-referencing tagged creators across your posts…",
    "Building your creator-network graph…",
  ],
  scoring_creators: [
    "Analyzing past collaborators for content DNA…",
    "Running creator personality signals through our scoring models…",
    "Computing audience overlap and authenticity scores…",
  ],
  ranking: [
    "Embedding your brand's content fingerprint…",
    "Comparing against our creator index…",
    "Surfacing creators who look like the ones you've already worked with…",
    "Finalizing your brand-fit scores…",
  ],
  complete: ["Your recommendations are ready."],
  failed: ["We couldn't complete the analysis."],
};

function phaseLineFor(status: StatusResponse | null, phase: Phase): string[] {
  const base = [...PHASE_COPY[phase]];
  if (!status) return base;

  if (phase === "extracting_collaborators" && status.collaborators_count) {
    return [
      `Found ${status.collaborators_count} past collaborator${
        status.collaborators_count === 1 ? "" : "s"
      } from @${status.instagram_handle}…`,
      ...base,
    ];
  }
  if (phase === "scoring_creators" && status.creator_jobs_total) {
    return [
      `Analyzing ${status.creator_jobs_done}/${status.creator_jobs_total} past collaborators for content DNA…`,
      ...base.slice(1),
    ];
  }
  return base;
}

export default function ProcessingPage() {
  const router = useRouter();
  const params = useParams<{ brandId: string }>();
  const brandId = params?.brandId;

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [copyIndex, setCopyIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const navigatedRef = useRef(false);

  const phase: Phase = status?.phase ?? "queued";
  const progress = status?.progress ?? 4;
  const lines = phaseLineFor(status, phase);
  const activeLine = lines[copyIndex % lines.length];

  // Poll status
  const poll = useCallback(async () => {
    if (!brandId) return;
    try {
      const resp = await fetch(`/api/brands/${brandId}/ig-analyze/status`, {
        cache: "no-store",
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as StatusResponse;
      setStatus(data);
      if (data.phase === "complete" && !navigatedRef.current) {
        navigatedRef.current = true;
        // Small pause so the user sees the 100% bar land.
        setTimeout(() => router.push("/dashboard"), 700);
      }
      if (data.phase === "failed") {
        setError(data.error ?? "Pipeline failed");
      }
    } catch (err) {
      console.error("[processing] poll error", err);
    }
  }, [brandId, router]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [poll]);

  // Rotate sub-copy every 3s within a phase. Reset counter on phase change.
  useEffect(() => {
    setCopyIndex(0);
  }, [phase]);

  useEffect(() => {
    if (phase === "complete" || phase === "failed") return;
    const t = setInterval(() => setCopyIndex((n) => n + 1), COPY_ROTATE_MS);
    return () => clearInterval(t);
  }, [phase]);

  const handleRetry = useCallback(async () => {
    if (!brandId) return;
    setRetrying(true);
    setError(null);
    try {
      const resp = await fetch(`/api/brands/${brandId}/ig-analyze`, {
        method: "POST",
      });
      if (!resp.ok) throw new Error("Enqueue failed");
      setStatus(null);
      navigatedRef.current = false;
    } catch (err) {
      console.error("[processing] retry error", err);
      setError("Couldn't retry. Please try again in a moment.");
    } finally {
      setRetrying(false);
    }
  }, [brandId]);

  const handleSkip = useCallback(() => {
    navigatedRef.current = true;
    router.push("/dashboard");
  }, [router]);

  const isFailed = phase === "failed" || !!error;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-xl flex-col items-center gap-10">
        {/* Icon */}
        <div
          className={cn(
            "flex size-20 items-center justify-center rounded-full transition-colors",
            isFailed
              ? "bg-destructive/10 text-destructive"
              : phase === "complete"
              ? "bg-primary/10 text-primary"
              : "bg-primary/5 text-primary"
          )}
        >
          {isFailed ? (
            <AlertTriangleIcon className="size-9" />
          ) : phase === "complete" ? (
            <SparklesIcon className="size-9" />
          ) : (
            <Loader2Icon className="size-9 animate-spin" />
          )}
        </div>

        {/* Title + rotating copy */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-heading font-semibold tracking-tight">
            {isFailed ? "Something went wrong" : PHASE_TITLES[phase]}
          </h1>
          <p
            key={activeLine /* re-mount → triggers fade */}
            className={cn(
              "min-h-[1.75rem] text-base text-muted-foreground transition-opacity duration-500",
              isFailed && "text-destructive"
            )}
          >
            {isFailed
              ? error ?? "We couldn't complete the analysis."
              : activeLine}
          </p>
        </div>

        {/* Progress */}
        {!isFailed && phase !== "complete" && (
          <div className="w-full max-w-sm">
            <Progress value={progress} className="gap-2" />
            <p className="mt-3 text-center text-xs text-muted-foreground tabular-nums">
              {Math.round(progress)}% — this usually takes a couple of minutes
            </p>
          </div>
        )}

        {/* Failure CTAs */}
        {isFailed && (
          <div className="flex flex-col items-center gap-3">
            <Button onClick={handleRetry} disabled={retrying}>
              {retrying ? "Retrying…" : "Try again"}
            </Button>
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Reassurance footer */}
        {!isFailed && (
          <p className="text-xs text-muted-foreground">
            You can close this tab — we&apos;ll have your recommendations ready
            when you come back.
          </p>
        )}
      </div>
    </div>
  );
}
