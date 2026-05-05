"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Send,
  Search,
  ShieldCheck,
  ClipboardList,
  Inbox,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Brand } from "@/lib/types/database";
import { RecentActivityFeed } from "./recent-activity";

export interface DashboardStats {
  activeCampaigns: number;
  pendingApprovals: number;
  activeThreads: number;
  contentLive: number;
}

interface DashboardClientProps {
  brand: Brand;
  stats: DashboardStats;
  userDisplayName?: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface ActionCard {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
}

const ACTIONS: ActionCard[] = [
  {
    href: "/campaigns",
    title: "Campaigns",
    subtitle: "Plan, run, and track campaigns",
    icon: Megaphone,
    accent: "text-canva-purple bg-canva-purple/10",
  },
  {
    href: "/outreach",
    title: "Outreach",
    subtitle: "Message creators and manage replies",
    icon: Send,
    accent: "text-canva-pink bg-canva-pink/10",
  },
  {
    href: "/discover",
    title: "Discover",
    subtitle: "Find creators that match your brand",
    icon: Search,
    accent: "text-info bg-info/10",
  },
  {
    href: "/approvals",
    title: "Approvals",
    subtitle: "Review pending agent actions",
    icon: ShieldCheck,
    accent: "text-success bg-success/10",
  },
];

interface StatTile {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  accent: string;
}

export function DashboardClient({ brand, stats, userDisplayName }: DashboardClientProps) {
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const statTiles: StatTile[] = [
    {
      label: "Active campaigns",
      value: stats.activeCampaigns,
      href: "/campaigns",
      icon: ClipboardList,
      accent: "text-canva-purple bg-canva-purple/10",
    },
    {
      label: "Approvals pending",
      value: stats.pendingApprovals,
      href: "/approvals",
      icon: ShieldCheck,
      accent: "text-warning bg-warning/15",
    },
    {
      label: "Active threads",
      value: stats.activeThreads,
      href: "/outreach",
      icon: Inbox,
      accent: "text-info bg-info/15",
    },
    {
      label: "Content live",
      value: stats.contentLive,
      href: "/campaigns",
      icon: Video,
      accent: "text-success bg-success/15",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome banner */}
      <section>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
          {greeting}, {userDisplayName ?? brand.brand_name}
        </h1>
        {userDisplayName && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {brand.brand_name}
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          What would you like to do today?
        </p>
      </section>

      {/* Stats row */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          At a glance
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statTiles.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="transition-shadow hover:shadow-md">
              <Link href={s.href} className="block">
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className={cn(
                      "inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
                      s.accent,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading text-2xl font-extrabold leading-none text-foreground">
                      {s.value}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
        </div>
      </section>

      {/* Action cards */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Jump back in
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Card
              key={a.href}
              className="transition-shadow hover:shadow-md"
            >
              <Link href={a.href} className="block">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-lg",
                      a.accent,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="font-heading text-base font-extrabold text-foreground">
                    {a.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.subtitle}
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="font-heading text-lg font-extrabold text-foreground">
            Recent activity
          </h2>
          <span className="text-xs text-muted-foreground">
            Actions Ilaya and you have taken recently
          </span>
        </div>
        <RecentActivityFeed />
      </section>
    </div>
  );
}
