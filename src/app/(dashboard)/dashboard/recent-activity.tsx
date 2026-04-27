"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AgentTrace {
  id: string;
  trace_type: string;
  tool_name: string | null;
  created_at: string;
  session_id: string | null;
  input_summary?: string | null;
  output_summary?: string | null;
  error_message?: string | null;
}

function humanizeToolName(name: string | null): string {
  if (!name) return "Action";
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function describeTrace(t: AgentTrace): string {
  if (t.trace_type === "tool_error") {
    return t.error_message || `${humanizeToolName(t.tool_name)} failed`;
  }
  if (t.input_summary) return t.input_summary;
  if (t.output_summary) return t.output_summary;
  return humanizeToolName(t.tool_name);
}

function iconFor(t: AgentTrace): { Icon: LucideIcon; cls: string } {
  if (t.trace_type === "tool_error") {
    return { Icon: AlertCircle, cls: "text-destructive bg-destructive/10" };
  }
  if (t.trace_type === "tool_call") {
    return { Icon: CheckCircle2, cls: "text-success bg-success/10" };
  }
  return { Icon: Sparkles, cls: "text-canva-purple bg-canva-purple/10" };
}

function relativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diffMs = Date.now() - ts;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

export function RecentActivityFeed() {
  const [traces, setTraces] = useState<AgentTrace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/agent/traces?view=recent&limit=10");
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        if (!cancelled) setTraces((json?.traces ?? []) as AgentTrace[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setTraces([]);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (traces == null) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading recent activity...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (traces.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-1 p-8 text-center">
          <Sparkles className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Nothing yet
          </p>
          <p className="text-xs text-muted-foreground">
            Ilaya&apos;s actions will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col p-0">
        {traces.map((t, idx) => {
          const { Icon, cls } = iconFor(t);
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3",
                idx > 0 && "border-t border-border",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
                  cls,
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {humanizeToolName(t.tool_name)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {describeTrace(t)}
                </div>
              </div>
              <div className="shrink-0 text-[11px] font-medium text-muted-foreground">
                {relativeTime(t.created_at)}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
