"use client";

import type {
  CreatorScore,
  TranscriptIntelligence,
  Post,
} from "@/lib/types/database";
import { PerformanceTab } from "./performance-tab";
import { ReelsQualityGrid } from "./reels-quality-grid";
import { BestTimeHeatmap } from "./best-time-heatmap";

interface ImpactTabProps {
  scores: CreatorScore | null;
  transcript: TranscriptIntelligence | null;
  posts: Post[];
}

export function ImpactTab({ scores, transcript, posts }: ImpactTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <ReelsQualityGrid scores={scores} transcript={transcript} />
        <BestTimeHeatmap scores={scores} />
      </div>
      <PerformanceTab scores={scores} posts={posts} />
    </div>
  );
}
