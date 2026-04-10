"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  Zap,
  Users,
  TrendingUp,
  Heart,
  Star,
  RefreshCw,
  Bell,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ── Automation definitions ─────────────────────────────── */

interface AutomationTask {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AutomationJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  scheduleHuman: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  tasks: AutomationTask[];
  enabled: boolean;
}

const AUTOMATIONS: AutomationJob[] = [
  {
    id: "weekly",
    name: "Weekly Intelligence Scan",
    description:
      "Proactive analysis that discovers new creator matches, re-engagement opportunities, and ambassador candidates every week.",
    schedule: "0 9 * * 1",
    scheduleHuman: "Every Monday at 9:00 AM",
    icon: Calendar,
    color: "blue",
    enabled: true,
    tasks: [
      {
        id: "new_matches",
        name: "New Creator Matches",
        description:
          "Scan for high-match creators (70%+) added in the last 7 days and notify the brand.",
        icon: Users,
      },
      {
        id: "reengagement",
        name: "Re-engagement Opportunities",
        description:
          "Find creators inactive for 90+ days who had 2x+ ROI — worth reconnecting.",
        icon: RefreshCw,
      },
      {
        id: "ambassadors",
        name: "Ambassador Candidates",
        description:
          "Identify creators with 3+ campaigns and 3x+ ROI as potential brand ambassadors.",
        icon: Star,
      },
    ],
  },
  {
    id: "monthly",
    name: "Monthly Health Report",
    description:
      "Monthly aggregation of relationship health and campaign performance trends across all creators.",
    schedule: "0 9 1 * *",
    scheduleHuman: "1st of every month at 9:00 AM",
    icon: TrendingUp,
    color: "emerald",
    enabled: true,
    tasks: [
      {
        id: "relationship_health",
        name: "Relationship Health Summary",
        description:
          "Count total active creators, flag at-risk relationships (inactive 120+ days or <1x ROI).",
        icon: Heart,
      },
      {
        id: "performance_trends",
        name: "Performance Trends",
        description:
          "Summarize active campaign orders, revenue, and performance trends for the month.",
        icon: TrendingUp,
      },
    ],
  },
  {
    id: "maintenance",
    name: "Daily Maintenance",
    description:
      "Background maintenance that decays old knowledge confidence and reminds about stale pending approvals.",
    schedule: "0 2 * * *",
    scheduleHuman: "Every day at 2:00 AM",
    icon: RefreshCw,
    color: "amber",
    enabled: true,
    tasks: [
      {
        id: "knowledge_decay",
        name: "Knowledge Confidence Decay",
        description:
          "Gradually reduce confidence of old knowledge facts so fresh evidence gets priority.",
        icon: Timer,
      },
      {
        id: "stale_approvals",
        name: "Stale Approval Reminders",
        description:
          "Find pending approvals older than 24 hours and send reminder notifications.",
        icon: Bell,
      },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  blue: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
  emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
  amber: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
};

/* ── Main Page ──────────────────────────────────────────── */

export default function AutomationsPage() {
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(
    new Set(AUTOMATIONS.map((a) => a.id))
  );

  const toggleJob = (id: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Automations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your agent runs proactive scans on a schedule to discover opportunities and maintain data quality.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{AUTOMATIONS.length}</p>
                <p className="text-xs text-muted-foreground">Active automations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {AUTOMATIONS.reduce((n, a) => n + a.tasks.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-xs text-muted-foreground">Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automation jobs */}
      <div className="flex flex-col gap-4">
        {AUTOMATIONS.map((job) => {
          const Icon = job.icon;
          const isExpanded = expandedJobs.has(job.id);
          const colorClasses = COLOR_MAP[job.color];

          return (
            <div key={job.id} className="rounded-xl border bg-background">
              {/* Job header */}
              <button
                onClick={() => toggleJob(job.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-xl"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                    colorClasses
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{job.name}</h2>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    >
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {job.description}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {job.scheduleHuman}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                      {job.schedule}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Tasks */}
              {isExpanded && (
                <div className="border-t px-5 py-4">
                  <div className="flex flex-col gap-3">
                    {job.tasks.map((task, idx) => {
                      const TaskIcon = task.icon;
                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border">
                            <TaskIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{task.name}</p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Step {idx + 1}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              {task.description}
                            </p>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        </div>
                      );
                    })}
                  </div>

                  {/* What it generates */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Bell className="h-3 w-3" />
                      Results are delivered as notifications and stored in agent memory
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            How Automations Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-medium">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  1
                </div>
                Scheduled Trigger
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                Cron jobs run on their configured schedule automatically.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-medium">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  2
                </div>
                Agent Analysis
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                Each task queries your data, scores creators, and surfaces insights.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-medium">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  3
                </div>
                Notification
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                Results become notifications and enrich the agent&apos;s memory for future conversations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
