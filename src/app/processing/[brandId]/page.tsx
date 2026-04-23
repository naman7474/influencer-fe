"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  scoring_creators: "Analyzing past collaborators",
  ranking: "Finding your best-fit creators",
  complete: "You\u2019re in.",
  failed: "Something went wrong",
};

const PHASE_COPY: Record<Phase, string[]> = {
  queued: [
    "Warming up the recommendation engine\u2026",
    "Reserving a slot on our scraping pipeline\u2026",
  ],
  scraping_brand: [
    "Reading your last 20 Instagram posts\u2026",
    "Studying your tone and content themes\u2026",
    "Looking at what your audience cares about\u2026",
    "Extracting visual and messaging signals from your reels\u2026",
  ],
  extracting_collaborators: [
    "Mapping your past brand collaborations\u2026",
    "Cross-referencing tagged creators across your posts\u2026",
    "Building your creator-network graph\u2026",
  ],
  scoring_creators: [
    "Analyzing past collaborators for content DNA\u2026",
    "Running creator personality signals through our scoring models\u2026",
    "Computing audience overlap and authenticity scores\u2026",
  ],
  ranking: [
    "Embedding your brand\u2019s content fingerprint\u2026",
    "Comparing against our creator index\u2026",
    "Surfacing creators who look like the ones you\u2019ve already worked with\u2026",
    "Finalizing your brand-fit scores\u2026",
  ],
  complete: ["Your recommendations are ready."],
  failed: ["We couldn\u2019t complete the analysis."],
};

function phaseLineFor(status: StatusResponse | null, phase: Phase): string[] {
  const base = [...PHASE_COPY[phase]];
  if (!status) return base;

  if (phase === "extracting_collaborators" && status.collaborators_count) {
    return [
      `Found ${status.collaborators_count} past collaborator${
        status.collaborators_count === 1 ? "" : "s"
      } from @${status.instagram_handle}\u2026`,
      ...base,
    ];
  }
  if (phase === "scoring_creators" && status.creator_jobs_total) {
    return [
      `Analyzing ${status.creator_jobs_done}/${status.creator_jobs_total} past collaborators for content DNA\u2026`,
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
      setError("Couldn\u2019t retry. Please try again in a moment.");
    } finally {
      setRetrying(false);
    }
  }, [brandId]);

  const handleSkip = useCallback(() => {
    navigatedRef.current = true;
    router.push("/dashboard");
  }, [router]);

  const isFailed = phase === "failed" || !!error;
  const isComplete = phase === "complete";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[oklch(98%_0.006_80)] px-6 py-16">
      {/* Radial glow for the complete state */}
      {isComplete && (
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, oklch(94% 0.035 45) 0%, transparent 60%)",
          }}
        />
      )}

      <div className="relative flex w-full max-w-lg flex-col items-center gap-8 text-center">
        {/* Icon */}
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full transition-all",
            isFailed
              ? "bg-red-100 text-red-600"
              : isComplete
              ? "bg-[oklch(62%_0.17_38)] text-white shadow-[0_20px_60px_-10px_oklch(62%_0.17_38)]"
              : "bg-[oklch(94%_0.035_45)]"
          )}
        >
          {isFailed ? (
            <svg
              className="h-9 w-9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : isComplete ? (
            <svg
              className="h-10 w-10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.5l3.5 3.5L13 4.5" />
            </svg>
          ) : (
            <svg
              className="h-8 w-8"
              viewBox="0 0 16 16"
              fill="none"
              style={{ animation: "spin 0.8s linear infinite" }}
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="oklch(62% 0.17 38)"
                strokeOpacity="0.2"
                strokeWidth="1.6"
              />
              <path
                d="M8 2a6 6 0 016 6"
                stroke="oklch(62% 0.17 38)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1
            className={cn(
              "font-serif text-4xl leading-tight tracking-tight md:text-5xl",
              isComplete && "text-[oklch(18%_0.02_70)]"
            )}
            style={{ color: isFailed ? undefined : "oklch(18% 0.02 70)" }}
          >
            {isFailed
              ? "Something went wrong"
              : isComplete
              ? "You\u2019re in."
              : PHASE_TITLES[phase]}
          </h1>

          <p
            key={activeLine}
            className={cn(
              "min-h-[1.75rem] text-base transition-opacity duration-500",
              isFailed ? "text-red-600" : "text-[oklch(38%_0.015_75)]"
            )}
          >
            {isFailed
              ? error ?? "We couldn\u2019t complete the analysis."
              : activeLine}
          </p>
        </div>

        {/* Progress bar */}
        {!isFailed && !isComplete && (
          <div className="w-full max-w-sm">
            <div className="h-1 overflow-hidden rounded-full bg-[oklch(90%_0.008_75)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${progress}%`,
                  background: "oklch(62% 0.17 38)",
                }}
              />
            </div>
            <p className="mt-3 font-mono text-[11px] tabular-nums text-[oklch(58%_0.012_75)]">
              {Math.round(progress)}% &mdash; this usually takes a couple of
              minutes
            </p>
          </div>
        )}

        {/* Failure CTAs */}
        {isFailed && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-lg bg-[oklch(18%_0.02_70)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {retrying ? "Retrying\u2026" : "Try again"}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-[oklch(58%_0.012_75)] underline underline-offset-4 transition-colors hover:text-[oklch(38%_0.015_75)]"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Footer */}
        {!isFailed && !isComplete && (
          <p className="font-mono text-[11px] text-[oklch(58%_0.012_75)]">
            You can close this tab &mdash; we&apos;ll have your recommendations
            ready when you come back.
          </p>
        )}

        {/* Complete state CTA */}
        {isComplete && (
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2.5 rounded-lg bg-[oklch(18%_0.02_70)] px-7 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Take me to my matches
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M2 7h10M8 3l4 4-4 4" />
            </svg>
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
