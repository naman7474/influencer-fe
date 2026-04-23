"use client";

import { Mic } from "lucide-react";
import type {
  CaptionIntelligence,
  TranscriptIntelligence,
} from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleSection } from "./collapsible-section";
import { cn } from "@/lib/utils";

interface VoiceProfileProps {
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
}

interface Row {
  label: string;
  lowLabel?: string;
  highLabel?: string;
  value: number;
  inverted?: boolean;
}

function toUnit(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v > 1 ? v / 100 : v;
}

export function VoiceProfile({ caption, transcript }: VoiceProfileProps) {
  const headline: Row[] = [];
  const detail: Row[] = [];

  const storytelling = toUnit(transcript?.storytelling_score);
  if (storytelling != null) {
    headline.push({
      label: "Storytelling",
      value: storytelling,
      lowLabel: "Bullet-style",
      highLabel: "Narrative",
    });
  }

  const authFeel = toUnit(caption?.authenticity_feel);
  if (authFeel != null) {
    headline.push({
      label: "Authenticity feel",
      value: authFeel,
      lowLabel: "Curated",
      highLabel: "Raw",
    });
  }

  const vulnerability = toUnit(caption?.vulnerability_openness);
  if (vulnerability != null) {
    headline.push({
      label: "Vulnerability",
      value: vulnerability,
      lowLabel: "Guarded",
      highLabel: "Open",
    });
  }

  const formality = toUnit(caption?.formality_score);
  if (formality != null) {
    detail.push({
      label: "Formality",
      value: formality,
      lowLabel: "Casual",
      highLabel: "Formal",
    });
  }

  const humor = toUnit(caption?.humor_score);
  if (humor != null) {
    detail.push({
      label: "Humor",
      value: humor,
      lowLabel: "Serious",
      highLabel: "Funny",
    });
  }

  const vocab = toUnit(transcript?.vocabulary_complexity);
  if (vocab != null) {
    detail.push({
      label: "Vocabulary",
      value: vocab,
      lowLabel: "Simple",
      highLabel: "Complex",
    });
  }

  const educational = toUnit(transcript?.educational_density);
  if (educational != null) {
    detail.push({
      label: "Educational density",
      value: educational,
      lowLabel: "Light",
      highLabel: "Dense",
    });
  }

  const filler = toUnit(transcript?.filler_word_frequency);
  if (filler != null) {
    detail.push({
      label: "Filler words",
      value: filler,
      lowLabel: "Clean",
      highLabel: "Frequent",
      inverted: true,
    });
  }

  if (headline.length === 0 && detail.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="size-4 text-primary" />
          Voice & Craft
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {headline.map((r) => (
          <BarRow key={r.label} row={r} />
        ))}

        {detail.length > 0 && (
          <div className="-mx-1">
            <CollapsibleSection title="More voice detail">
              <div className="space-y-3 pt-1">
                {detail.map((r) => (
                  <BarRow key={r.label} row={r} />
                ))}
              </div>
            </CollapsibleSection>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BarRow({ row }: { row: Row }) {
  const pct = Math.round(Math.min(1, Math.max(0, row.value)) * 100);
  const colorPct = row.inverted ? 100 - pct : pct;
  const bar =
    colorPct >= 70
      ? "bg-success"
      : colorPct >= 40
        ? "bg-warning"
        : "bg-destructive";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{row.label}</span>
        <span className="font-medium text-foreground">{pct}%</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(row.lowLabel || row.highLabel) && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{row.lowLabel}</span>
          <span>{row.highLabel}</span>
        </div>
      )}
    </div>
  );
}
