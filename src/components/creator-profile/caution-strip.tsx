"use client";

import { AlertTriangle } from "lucide-react";
import type {
  CreatorScore,
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
  Creator,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface CautionStripProps {
  creator: Creator;
  scores: CreatorScore | null;
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
  audience: AudienceIntelligence | null;
}

type Severity = "warn" | "danger";

interface Flag {
  label: string;
  severity: Severity;
}

/* ------------------------------------------------------------------ */
/*  Normalisers — metrics may be stored as 0-1 or 0-100                */
/* ------------------------------------------------------------------ */

function toPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v > 1 ? v : v * 100;
}

/* ------------------------------------------------------------------ */
/*  Trigger logic                                                       */
/* ------------------------------------------------------------------ */

function computeFlags({
  creator,
  scores,
  caption,
  transcript,
  audience,
}: CautionStripProps): Flag[] {
  const flags: Flag[] = [];

  const authenticity = toPct(audience?.authenticity_score ?? scores?.audience_authenticity ?? null);
  if (authenticity != null && authenticity < 60) {
    flags.push({
      label: `Low audience authenticity (${Math.round(authenticity)}%)`,
      severity: authenticity < 40 ? "danger" : "warn",
    });
  }

  const bait = toPct(caption?.engagement_bait_score ?? null);
  if (bait != null && bait > 60) {
    flags.push({ label: "High engagement bait", severity: "warn" });
  }

  if (audience?.suspicious_patterns && audience.suspicious_patterns.length > 0) {
    for (const pattern of audience.suspicious_patterns.slice(0, 3)) {
      flags.push({ label: pattern, severity: "danger" });
    }
  }

  const delta = toPct(scores?.sponsored_vs_organic_delta ?? null);
  if (delta != null && delta < -30) {
    flags.push({
      label: `Sponsored posts underperform ${Math.round(delta)}%`,
      severity: "warn",
    });
  }

  const emoji = toPct(audience?.emoji_only_percentage ?? null) ?? 0;
  const generic = toPct(audience?.generic_comment_percentage ?? null) ?? 0;
  if (emoji + generic > 70) {
    flags.push({ label: "Low-quality comments", severity: "warn" });
  }

  if (transcript?.caption_vs_spoken_mismatch === true) {
    flags.push({
      label: "Caption/spoken language mismatch",
      severity: "warn",
    });
  }

  if (
    creator.follower_following_ratio != null &&
    creator.follower_following_ratio < 1 &&
    creator.tier !== "nano"
  ) {
    flags.push({ label: "Unusual follow ratio", severity: "warn" });
  }

  return flags;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CautionStrip(props: CautionStripProps) {
  const flags = computeFlags(props);
  if (flags.length === 0) return null;

  const hasDanger = flags.some((f) => f.severity === "danger");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ring-1",
        hasDanger
          ? "bg-destructive/10 ring-destructive/25"
          : "bg-warning/10 ring-warning/25",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
          hasDanger ? "text-destructive" : "text-warning",
        )}
      >
        <AlertTriangle className="size-3.5" />
        Caution
      </span>
      <div className="flex flex-wrap gap-1.5">
        {flags.map((f, i) => (
          <span
            key={`${f.label}-${i}`}
            className={cn(
              "inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[11px] font-medium ring-1",
              f.severity === "danger"
                ? "text-destructive ring-destructive/30"
                : "text-warning ring-warning/30",
            )}
          >
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}
