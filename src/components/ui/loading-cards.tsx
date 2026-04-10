"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  CreatorCardSkeleton — matches creator-card.tsx layout              */
/* ------------------------------------------------------------------ */

export function CreatorCardSkeleton() {
  return (
    <Card className="border-l-3 border-l-transparent">
      <CardContent className="space-y-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>

        {/* Followers + tier */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>

        {/* CPI + engagement */}
        <div className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Niche + tone badges */}
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Location */}
        <Skeleton className="h-4 w-32" />

        {/* Match bar */}
        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  CampaignCardSkeleton — matches compact campaign card              */
/* ------------------------------------------------------------------ */

export function CampaignCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3">
        {/* Title + status */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Description */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />

        {/* Stats row */}
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  ProfileHeaderSkeleton — matches creator profile header            */
/* ------------------------------------------------------------------ */

export function ProfileHeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6">
        <Skeleton className="h-16 w-24 rounded-lg" />
        <Skeleton className="h-16 w-24 rounded-lg" />
        <Skeleton className="h-16 w-24 rounded-lg" />
        <Skeleton className="h-16 w-24 rounded-lg" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatCardSkeleton — simple stat card with label + number           */
/* ------------------------------------------------------------------ */

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-7 w-16" />
      </CardContent>
    </Card>
  );
}
