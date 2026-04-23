"use client";

import { Mail, Phone, Megaphone, Target, ExternalLink } from "lucide-react";
import type {
  Creator,
  CreatorScore,
  CaptionIntelligence,
} from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BrandAffinityPanel } from "./brand-affinity-panel";

interface CommerceTabProps {
  creator: Creator;
  scores: CreatorScore | null;
  caption: CaptionIntelligence | null;
}

function toPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v > 1 ? v : v * 100;
}

export function CommerceTab({
  creator,
  scores,
  caption,
}: CommerceTabProps) {
  return (
    <div className="space-y-4">
      <BrandAffinityPanel caption={caption} scores={scores} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SponsoredPerformanceCard scores={scores} />
        <CtaConversionCard caption={caption} />
      </div>

      <OutreachCard creator={creator} scores={scores} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sponsored performance                                              */
/* ------------------------------------------------------------------ */

function SponsoredPerformanceCard({
  scores,
}: {
  scores: CreatorScore | null;
}) {
  const rate = toPct(scores?.sponsored_post_rate);
  const delta = toPct(scores?.sponsored_vs_organic_delta);
  if (rate == null && delta == null) return null;

  let sentence: string | null = null;
  let sentenceColor = "text-foreground";
  if (delta != null) {
    if (delta >= 10) {
      sentence = `Sponsored posts outperform organic by ${delta.toFixed(0)}% — audience reliably engages with paid content.`;
      sentenceColor = "text-success";
    } else if (delta >= -15) {
      sentence = `Sponsored and organic posts perform within ${Math.abs(delta).toFixed(0)}% of each other — audience trusts paid recommendations.`;
      sentenceColor = "text-success";
    } else if (delta >= -30) {
      sentence = `Sponsored posts perform ${Math.abs(delta).toFixed(0)}% below organic — minor drop, generally acceptable.`;
      sentenceColor = "text-warning";
    } else {
      sentence = `Sponsored posts underperform organic by ${Math.abs(delta).toFixed(0)}% — audience distrusts paid content.`;
      sentenceColor = "text-destructive";
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-primary" />
          Sponsored Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rate != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sponsored rate</span>
            <span className="font-medium text-foreground">
              {rate.toFixed(0)}% of posts
            </span>
          </div>
        )}
        {delta != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">vs organic</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                delta >= 0 ? "text-success" : delta > -30 ? "text-warning" : "text-destructive",
              )}
            >
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(0)}%
            </span>
          </div>
        )}
        {sentence && (
          <p
            className={cn(
              "rounded-lg bg-muted/40 p-3 text-xs leading-relaxed",
              sentenceColor,
            )}
          >
            {sentence}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  CTA & conversion                                                   */
/* ------------------------------------------------------------------ */

function CtaConversionCard({
  caption,
}: {
  caption: CaptionIntelligence | null;
}) {
  if (
    !caption?.dominant_cta_style &&
    caption?.cta_frequency == null &&
    caption?.is_conversion_oriented == null
  ) {
    return null;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-4 text-primary" />
          CTA & Conversion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {caption.dominant_cta_style && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Dominant CTA</span>
            <Badge variant="secondary" className="capitalize">
              {caption.dominant_cta_style}
            </Badge>
          </div>
        )}
        {caption.cta_frequency != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">CTA frequency</span>
            <span className="font-medium text-foreground">
              {formatPercent(caption.cta_frequency)} of posts
            </span>
          </div>
        )}
        {caption.is_conversion_oriented != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Conversion oriented</span>
            {caption.is_conversion_oriented ? (
              <Badge variant="default">Yes</Badge>
            ) : (
              <Badge variant="outline">No</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Reach-out card                                                     */
/* ------------------------------------------------------------------ */

function OutreachCard({
  creator,
  scores,
}: {
  creator: Creator;
  scores: CreatorScore | null;
}) {
  const email = creator.contact_email;
  const phone = creator.contact_phone;
  const replyRate = scores?.creator_reply_rate;

  if (!email && !phone && !creator.external_url && replyRate == null) {
    return null;
  }

  const replyLabel =
    replyRate == null
      ? null
      : replyRate >= 0.3
        ? { text: "Very responsive", color: "text-success" }
        : replyRate >= 0.15
          ? { text: "Responsive", color: "text-success" }
          : replyRate >= 0.05
            ? { text: "Occasional replies", color: "text-warning" }
            : { text: "Rarely replies", color: "text-destructive" };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-primary" />
          Ready to reach out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Mail className="size-4" />
            {email}
          </a>
        )}
        {phone && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Phone className="size-4 text-muted-foreground" />
            {phone}
          </div>
        )}
        {creator.external_url && (
          <a
            href={creator.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-4" />
            {(() => {
              try {
                return new URL(creator.external_url!).hostname;
              } catch {
                return creator.external_url;
              }
            })()}
          </a>
        )}
        {replyLabel && (
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Reply rate</span>
            <span className={cn("font-medium", replyLabel.color)}>
              {formatPercent(replyRate!)} — {replyLabel.text}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
